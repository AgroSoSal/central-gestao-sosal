-- Segurança da Data API: três views públicas executam como SECURITY INVOKER,
-- lendo apenas materialized views agregadas (sem dados identificáveis de clientes).
-- O papel anon NUNCA recebe acesso às tabelas de comissão, RPA ou representantes.
-- Refresh ocorre atomicamente no ato da publicação do mês.
-- As materialized views ficam em schema NÃO EXPOSTO pela Data API;
-- o anon só acessa as três views de apresentação do painel via REST.
create schema if not exists painel_interno;
revoke all on schema painel_interno from PUBLIC,authenticated;
grant usage on schema painel_interno to anon;

create materialized view if not exists painel_interno.mv_conferencia_comissao as
with ultimo as (
  select distinct on (mes_comercial) *
    from painel.comissao_lotes order by mes_comercial,id desc
), soma as (
  select l.id,l.mes_comercial,l.situacao,l.erro_validacao,
    l.total_venda_oficial,l.total_margem_oficial,l.total_comissao_oficial,
    l.total_vendedores_oficial,l.linhas_oficiais,
    count(i.linha_relatorio) linhas_importadas,
    coalesce(sum(i.vl_nota),0) venda_importada,
    coalesce(sum(i.margem),0) margem_importada,
    coalesce(sum(i.comissao),0) comissao_importada,
    count(distinct nullif(btrim(i.vendedor_cod),'')) vendedores_importados
  from ultimo l left join painel.comissao_linhas_importadas i on i.lote_id=l.id
  group by l.id,l.mes_comercial,l.situacao,l.erro_validacao,
    l.total_venda_oficial,l.total_margem_oficial,l.total_comissao_oficial,
    l.total_vendedores_oficial,l.linhas_oficiais
)
select mes_comercial,situacao,erro_validacao,
  total_venda_oficial,venda_importada,venda_importada-total_venda_oficial diferenca_venda,
  total_margem_oficial,margem_importada,margem_importada-total_margem_oficial diferenca_margem,
  total_comissao_oficial,comissao_importada,comissao_importada-total_comissao_oficial diferenca_comissao,
  linhas_oficiais,linhas_importadas,total_vendedores_oficial,vendedores_importados,
  case when situacao='publicado' and venda_importada=total_venda_oficial
       and margem_importada=total_margem_oficial
       and comissao_importada=total_comissao_oficial
       and linhas_importadas=linhas_oficiais
       and (total_vendedores_oficial is null or vendedores_importados=total_vendedores_oficial)
       then 'OK'
       when situacao='erro' then 'ERRO'
       else 'PENDENTE' end as resultado
from soma;
create unique index if not exists ux_mv_conf_comissao_mes on painel_interno.mv_conferencia_comissao(mes_comercial);

create materialized view if not exists painel_interno.mv_margem_filial_mes as
select mes_comercial,filial,
  sum(vl_nota) venda,sum(margem) margem,
  case when sum(vl_nota)<>0 then round(100*sum(margem)/sum(vl_nota),4) end percentual_margem
from painel.comissao_notas
where tipo <> 'CONJUGADA_2'
group by mes_comercial,filial;
create unique index if not exists ux_mv_margem_filial_mes on painel_interno.mv_margem_filial_mes(mes_comercial,filial);

create materialized view if not exists painel_interno.mv_margem_loja_mes as
with pares as (
 select mes_comercial,filial,chave_conjugada,
   count(distinct representante_cod) qtd_representantes,
   min(representante_cod) representante_unico
 from painel.comissao_notas
 where tipo in ('CONJUGADA_1','CONJUGADA_2')
 group by mes_comercial,filial,chave_conjugada
), atribuidas as (
 select n.mes_comercial,n.filial,n.tipo,n.vl_nota,n.margem,
   case when n.tipo='CONJUGADA_1'
     then case when p.qtd_representantes=1 then p.representante_unico else a.representante_cod end
     else n.representante_cod end as representante_cod
 from painel.comissao_notas n
 left join pares p on n.tipo='CONJUGADA_1'
    and p.mes_comercial=n.mes_comercial and p.filial=n.filial
    and p.chave_conjugada=n.chave_conjugada
 left join painel.comissao_conjugadas_atribuicao a on n.tipo='CONJUGADA_1'
    and a.mes_comercial=n.mes_comercial and a.filial=n.filial
    and a.chave_conjugada=n.chave_conjugada
 where n.tipo <> 'CONJUGADA_2'
), meses_incompletos as (
 select distinct a.mes_comercial from atribuidas a
 left join painel.representantes r on r.representante_cod=a.representante_cod
 where a.representante_cod is null or r.representante_cod is null
)
select a.mes_comercial,a.representante_cod,r.nome representante,r.loja,r.tipo categoria,
  sum(a.vl_nota) venda,sum(a.margem) margem,
  case when sum(a.vl_nota)<>0 then round(100*sum(a.margem)/sum(a.vl_nota),4) end percentual_margem
from atribuidas a
join painel.representantes r on r.representante_cod=a.representante_cod
where not exists (select 1 from meses_incompletos e where e.mes_comercial=a.mes_comercial)
group by a.mes_comercial,a.representante_cod,r.nome,r.loja,r.tipo;
create unique index if not exists ux_mv_margem_loja_mes on painel_interno.mv_margem_loja_mes(mes_comercial,representante_cod);

-- SECURITY INVOKER: a view pública vê somente projeções materializadas.
create or replace view painel.v_conferencia_comissao with (security_invoker=true, security_barrier=true)
as select * from painel_interno.mv_conferencia_comissao;
create or replace view painel.v_margem_filial_mes with (security_invoker=true, security_barrier=true)
as select * from painel_interno.mv_margem_filial_mes;
create or replace view painel.v_margem_loja_mes with (security_invoker=true, security_barrier=true)
as select * from painel_interno.mv_margem_loja_mes;

revoke all on painel_interno.mv_conferencia_comissao,painel_interno.mv_margem_filial_mes,
  painel_interno.mv_margem_loja_mes from PUBLIC,anon,authenticated;
grant select on painel_interno.mv_conferencia_comissao,painel_interno.mv_margem_filial_mes,
  painel_interno.mv_margem_loja_mes to anon;
-- Apenas leitura das três VIEWS de apresentação:
revoke all on painel.v_conferencia_comissao,painel.v_margem_filial_mes,
  painel.v_margem_loja_mes from PUBLIC,anon,authenticated;
grant select on painel.v_conferencia_comissao,painel.v_margem_filial_mes,
  painel.v_margem_loja_mes to anon;

-- Substituir a função para atualizar a projeção de KPI na mesma transação.
create or replace function painel.publicar_comissao_lote(p_lote_id bigint)
returns text
language plpgsql
security invoker
set search_path = ''
as $func$
declare
  l painel.comissao_lotes%rowtype;
  n bigint;
  v numeric(18,2);
  m numeric(18,2);
  c numeric(18,2);
  vend integer;
  problema text;
begin
  select * into l from painel.comissao_lotes where id = p_lote_id for update;
  if not found then raise exception 'Lote % inexistente',p_lote_id; end if;
  if l.situacao = 'publicado' then return 'ja_publicado'; end if;
  -- Critérios fixos do relatório; sem valores ou parâmetros estimados.
  if not (l.parametros_extracao @> '{
    "modalidade":"comissao_sobre_faturamento",
    "filiais":"todas",
    "vendedores":"todos",
    "representantes":"todos",
    "clientes":"todos",
    "produtos":"todos",
    "custo":"custo_liquido",
    "ignorar_empresas_grupo":true,
    "deduzir_bonificacoes":true,
    "acrescentar_custo_financeiro_prazo":true,
    "incluir_icms_st_internas":true,
    "conjugadas_comissao_percentuais":[50,50],
    "comissao_servicos":false,
    "apenas_servicos":false,
    "icms_st_interestaduais":false
  }'::jsonb) then
    update painel.comissao_lotes
      set situacao='erro',erro_validacao='Filtros do Siscom divergentes dos critérios oficiais'
    where id=p_lote_id;
    refresh materialized view painel_interno.mv_conferencia_comissao;
    return 'erro: filtros do Siscom divergentes';
  end if;


  select count(*),coalesce(sum(vl_nota),0),coalesce(sum(margem),0),
         coalesce(sum(comissao),0),count(distinct nullif(btrim(vendedor_cod),''))
    into n,v,m,c,vend
  from painel.comissao_linhas_importadas where lote_id=p_lote_id;

  if n <> l.linhas_oficiais or v <> l.total_venda_oficial
     or m <> l.total_margem_oficial or c <> l.total_comissao_oficial
     or (l.total_vendedores_oficial is not null and vend <> l.total_vendedores_oficial)
  then
    problema := format('TOTAL GERAL divergente: linhas %s/%s, venda %s/%s, margem %s/%s, comissao %s/%s, vendedores %s/%s',
      n,l.linhas_oficiais,v,l.total_venda_oficial,m,l.total_margem_oficial,
      c,l.total_comissao_oficial,vend,l.total_vendedores_oficial);
  end if;

  if problema is null and exists (
    select 1 from painel.comissao_linhas_importadas i
    where i.lote_id=p_lote_id
      and (i.data < ((l.mes_comercial - interval '1 month')::date + 25)
        or i.data > (l.mes_comercial + 24)
        or nullif(btrim(i.representante_cod),'') is null
        or nullif(btrim(i.nota),'') is null)
  ) then problema:='Período, representante ou nota ausente/inválido'; end if;

  -- Conjugadas precisam de ambos os lançamentos iguais em venda e margem.
  if problema is null and exists (
    select 1 from (
      select i.filial,i.chave_conjugada,
        count(*) filter(where tipo='CONJUGADA_1') n1,
        count(*) filter(where tipo='CONJUGADA_2') n2,
        coalesce(sum(vl_nota) filter(where tipo='CONJUGADA_1'),0) v1,
        coalesce(sum(vl_nota) filter(where tipo='CONJUGADA_2'),0) v2,
        coalesce(sum(margem) filter(where tipo='CONJUGADA_1'),0) m1,
        coalesce(sum(margem) filter(where tipo='CONJUGADA_2'),0) m2
      from painel.comissao_linhas_importadas i
      where i.lote_id=p_lote_id and i.tipo in ('CONJUGADA_1','CONJUGADA_2')
      group by i.filial,i.chave_conjugada
    ) p where p.n1=0 or p.n2=0 or p.v1<>p.v2 or p.m1<>p.m2
  ) then problema:='Conjugada sem par ou com venda/margem divergente'; end if;

  if problema is not null then
    update painel.comissao_lotes set situacao='erro', erro_validacao=problema
    where id=p_lote_id;
    refresh materialized view painel_interno.mv_conferencia_comissao;
    return 'erro: ' || problema;
  end if;

  -- DELETE e INSERT executam na mesma transação da chamada desta função.
  delete from painel.comissao_notas where mes_comercial=l.mes_comercial;
  insert into painel.comissao_notas (
    mes_comercial,lote_id,linha_relatorio,data,nota,filial,vendedor_cod,vendedor,
    representante_cod,representante,cliente_cod,razao_social,condicao_pagto,
    tipo,linha_produto,chave_conjugada,vl_nota,margem,perc_comissao,comissao
  )
  select l.mes_comercial,lote_id,linha_relatorio,data,nota,filial,vendedor_cod,vendedor,
    representante_cod,representante,cliente_cod,razao_social,condicao_pagto,
    tipo,linha_produto,chave_conjugada,vl_nota,margem,perc_comissao,comissao
  from painel.comissao_linhas_importadas where lote_id=p_lote_id;

  update painel.comissao_lotes set situacao='substituido'
    where mes_comercial=l.mes_comercial and id<>p_lote_id and situacao='publicado';
  update painel.comissao_lotes
    set situacao='publicado', erro_validacao=null,publicado_em=now()
    where id=p_lote_id;
  refresh materialized view painel_interno.mv_conferencia_comissao;
  refresh materialized view painel_interno.mv_margem_filial_mes;
  refresh materialized view painel_interno.mv_margem_loja_mes;
  return 'publicado';
end;
$func$;
revoke all on function painel.publicar_comissao_lote(bigint) from PUBLIC,anon,authenticated;
-- Somente proprietário postgres pode executar a publicação (sem abrir schema painel para service_role).

