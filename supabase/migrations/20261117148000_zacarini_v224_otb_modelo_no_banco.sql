-- Interface tipada no Supabase para executar as fórmulas já inspecionadas
-- na Zacarini 2.2.24. Nenhum arquivo XLSX é usado como banco e nenhum
-- valor financeiro é semeado. A extração/planilha externa envia as PREMISSAS
-- oficiais; as views devolvem resultados só após aprovação da fonte.
-- Não habilitar no ERP web. Não publicar em produção sem aprovação escrita.
create table if not exists painel.zac_v224_otb_mes (
  mes date primary key check (extract(day from mes)=1),
  modelo text not null default 'ZACARINI_2.2.24'
    check (modelo='ZACARINI_2.2.24'),
  teto_pior_caso numeric(20,2) not null check(teto_pior_caso>=0),
  necessidade_mp numeric(20,2) not null check(necessidade_mp>=0),
  fracao_comprador numeric(10,6) not null default 0.85
    check (fracao_comprador>=0 and fracao_comprador<=1),
  dde_protecao_dias numeric(12,3) not null default 30,
  fonte_teto text not null,
  fonte_mp text not null,
  fonte_vendas text not null,
  cargas_conciliadas boolean not null default false,
  aprovado_por text,
  aprovado_em timestamptz,
  registrado_em timestamptz not null default now(),
  constraint cenario_aceite_completo check (
    (not cargas_conciliadas)
    or (nullif(btrim(aprovado_por),'') is not null and aprovado_em is not null)
  )
);

-- Uma linha por mês e subgrupo, SEM multiplicar por filial ou vendedor.
-- Valores são saídas normalizadas da Projeção 12M, ABC/DDE e Pedidos;
-- os campos não podem ser inventados, nem vir de totais cacheados do Excel.
create table if not exists painel.zac_v224_otb_insumos (
  mes date not null references painel.zac_v224_otb_mes(mes),
  grupo_subgrupo text not null,
  linha text not null,
  tipo text not null check (tipo in ('S','P','M','N')),
  venda_prevista_mes numeric(20,4) not null,
  cmv_frac numeric(12,8) not null check(cmv_frac>=0),
  ajuste_estoque_alvo numeric(20,4) not null,
  estoque_e_pedidos numeric(20,4) not null,
  peso_curva_a numeric(12,8) not null check(peso_curva_a between 0 and 1),
  dde_inicio numeric(18,4),
  venda_casada_aprovada numeric(20,4) not null default 0,
  pedidos_gravados_mes numeric(20,4) not null default 0,
  excesso_descontado_linha numeric(20,4) not null default 0,
  fonte_registro text not null,
  registrado_em timestamptz not null default now(),
  primary key (mes,grupo_subgrupo)
);
create index if not exists ix_zac_otb_insumos_linha
  on painel.zac_v224_otb_insumos(mes,linha);

-- Tais tabelas contêm planejamento empresarial: são PRIVADAS.
alter table painel.zac_v224_otb_mes enable row level security;
alter table painel.zac_v224_otb_insumos enable row level security;
revoke all on painel.zac_v224_otb_mes,painel.zac_v224_otb_insumos
  from PUBLIC,anon,authenticated;

create or replace view painel.v_zac_v224_otb_previa
with (security_invoker=true,security_barrier=true)
as
with base as (
 select m.mes,m.teto_pior_caso,m.necessidade_mp,m.fracao_comprador,
        m.dde_protecao_dias,
        i.grupo_subgrupo,i.linha,i.tipo,
        i.venda_prevista_mes,i.cmv_frac,i.ajuste_estoque_alvo,
        i.estoque_e_pedidos,i.peso_curva_a,i.dde_inicio,
        i.venda_casada_aprovada,i.pedidos_gravados_mes,
        i.excesso_descontado_linha,
        painel_interno.zac_v224_necessidade_otb(
          i.tipo,i.venda_prevista_mes,i.cmv_frac,
          i.ajuste_estoque_alvo,i.estoque_e_pedidos) necessidade
 from painel.zac_v224_otb_mes m
 join painel.zac_v224_otb_insumos i on i.mes=m.mes
 where m.cargas_conciliadas=true and m.aprovado_em is not null
), totais as (
 select mes,
    max(teto_pior_caso) teto_pior_caso,
    max(necessidade_mp) necessidade_mp,
    max(fracao_comprador) fracao_comprador,
    max(dde_protecao_dias) dde_protecao_dias,
    sum(necessidade)+max(necessidade_mp) necessidade_total,
    sum(necessidade*peso_curva_a) necessidade_curva_a,
    sum(necessidade*fracao_comprador) necessidade_comprador_85,
    coalesce(sum(necessidade*fracao_comprador)
       filter(where dde_inicio<dde_protecao_dias),0) necessidade_protegida_85
 from base group by mes
), tranca as (
 select t.*,
    painel_interno.zac_v224_fator_comprador(
      teto_pior_caso,necessidade_comprador_85,necessidade_protegida_85
    ) fator_corte_comprador,
    painel_interno.zac_v224_situacao_otb(
      teto_pior_caso,necessidade_total,necessidade_curva_a
    ) situacao_mes
 from totais t
), distribuicao as (
 select b.*,t.necessidade_total,t.necessidade_curva_a,
   t.fator_corte_comprador,t.situacao_mes,
   painel_interno.zac_v224_liberacao_subgrupo(
     b.necessidade,b.peso_curva_a,
     b.teto_pior_caso,b.necessidade_mp,
     t.necessidade_total,t.necessidade_curva_a
   ) liberado_otb,
   painel_interno.zac_v224_necessidade_comprador(
     b.necessidade,b.fracao_comprador,
     b.dde_inicio,b.dde_protecao_dias,t.fator_corte_comprador
   ) verba_pre_corte_linha
 from base b join tranca t on t.mes=b.mes
), totais_linha as (
 select d.*,
   sum(d.liberado_otb+d.venda_casada_aprovada
       -d.pedidos_gravados_mes-d.excesso_descontado_linha)
       over(partition by mes,linha) saldo_linha,
   sum(verba_pre_corte_linha) over(partition by mes,linha)
       verba_pre_corte_total_linha,
   sum(case when dde_inicio<dde_protecao_dias
     then verba_pre_corte_linha else 0 end)
     over(partition by mes,linha) verba_protegida_linha
 from distribuicao d
), regra_comprador as (
 select z.*,
    greatest(verba_protegida_linha,
      least(verba_pre_corte_total_linha,greatest(0,saldo_linha)))
      verba_linha_limite
 from totais_linha z
)
select mes,linha,grupo_subgrupo,tipo,necessidade,peso_curva_a,
   liberado_otb,
   painel_interno.zac_v224_saldo_otb(
      liberado_otb,venda_casada_aprovada,pedidos_gravados_mes
   ) saldo_otb,
   excesso_descontado_linha,
   dde_inicio,
   case when tipo <> 'S' then 0::numeric
     when dde_inicio is not null and dde_inicio<dde_protecao_dias
       then verba_pre_corte_linha
     else verba_pre_corte_linha*coalesce(
       (verba_linha_limite-verba_protegida_linha)/
          nullif(verba_pre_corte_total_linha-verba_protegida_linha,0),
       0::numeric
     ) end verba_comprador,
   situacao_mes,teto_pior_caso,necessidade_mp,
   necessidade_total,necessidade_curva_a
from regra_comprador;

-- Não conceder SELECT ao frontend nem à chave pública.
revoke all on painel.v_zac_v224_otb_previa
from PUBLIC,anon,authenticated;
