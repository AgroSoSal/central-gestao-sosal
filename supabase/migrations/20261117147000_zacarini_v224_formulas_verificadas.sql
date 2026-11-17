-- Zacarini 2.2.24: traduções SQL de fórmulas EXPRESSAMENTE VISÍVEIS no XLSX.
-- Fonte: Gestão Zacarini - Painel 2.2.24(8).xlsx (usuário, 17/11/2026).
-- SOMENTE HOMOLOGAÇÃO. Não presumir que estas regras sejam a revisão 2.3.1.
-- Objetos ficam em schema privado, sem concessões à Data API.
create schema if not exists painel_interno;
revoke all on schema painel_interno from PUBLIC,authenticated;

-- ABCEstoque_DDE!M22: MIN(MAX(IF(J22<>"",J22,IF(K22<>"",K22,1)),B13),B14)
-- B13=0 e B14=4 na referência, mas argumentos explícitos evitam hardcode
-- de parâmetros vigentes no cálculo SQL.
create or replace function painel_interno.zac_v224_crescimento_limitado(
  p_fator_produto numeric, p_fator_subgrupo numeric,
  p_piso numeric, p_teto numeric
) returns numeric
language sql immutable set search_path=''
as $$
  select case when p_piso is null or p_teto is null or p_piso>p_teto
    then null
    else least(greatest(coalesce(p_fator_produto,p_fator_subgrupo,1),p_piso),p_teto)
  end
$$;

-- ABCEstoque_DDE!N22:
-- crescimento * (qtd próximos 90d AA + ajuste outras lojas) + qtd janela extra.
-- O chamador deve fornecer os 3 componentes legítimos; valores ausentes geram NULL.
create or replace function painel_interno.zac_v224_previsao_90d(
  p_crescimento numeric, p_qtd_aa_prox90 numeric,
  p_ajuste_outras_lojas numeric, p_qtd_janela_extra numeric
) returns numeric
language sql immutable strict set search_path=''
as $$
  select p_crescimento*(p_qtd_aa_prox90+p_ajuste_outras_lojas)+p_qtd_janela_extra
$$;

-- ABCEstoque_DDE!S22/T22:
-- demanda diária prevista = quantidade projetada / dias da janela;
-- DDE físico = quantidade em estoque / demanda diária.
-- Sem demanda positiva o Excel devolve célula vazia, portanto NULL.
create or replace function painel_interno.zac_v224_dde(
  p_qtd_estoque numeric, p_qtd_prevista numeric, p_dias numeric
) returns numeric
language sql immutable strict set search_path=''
as $$
  select case when p_qtd_prevista>0 and p_dias>0
    then p_qtd_estoque / (p_qtd_prevista / p_dias)
    else null end
$$;

-- ABCEstoque_DDE!V22: MP fora do ABC;
-- classificação A <= 0,80, B <= 0,95, C demais.
-- percentuais explicitamente parametrizados e margem acumulada fornecida
-- por um processo de ranking de margem previsto já conciliado.
create or replace function painel_interno.zac_v224_curva(
  p_materia_prima boolean, p_percentual_acumulado numeric,
  p_limite_a numeric, p_limite_b numeric
) returns text
language sql immutable set search_path=''
as $$
  select case
    when p_materia_prima is true then 'MP'
    when p_percentual_acumulado is null then 'C'
    when p_limite_a is null or p_limite_b is null or p_limite_a>p_limite_b then null
    when p_percentual_acumulado<=p_limite_a then 'A'
    when p_percentual_acumulado<=p_limite_b then 'B'
    else 'C' end
$$;

-- OTB!S48: necessidade do subgrupo comprável.
-- OTB!Q48 = previsão da venda mensal * CMV%;
-- OTB!K48 = ajuste positivo de estoque-alvo;
-- OTB!R48 = estoque líquido + pedidos anteriores.
-- Natureza diferente de 'S' retorna 0, exatamente como planilha.
create or replace function painel_interno.zac_v224_necessidade_otb(
  p_tipo text,p_venda_prevista_mes numeric,p_cmv_fracao numeric,
  p_ajuste_estoque_alvo numeric,p_estoque_e_pedidos numeric
) returns numeric
language sql immutable strict set search_path=''
as $$
  select case when p_tipo='S'
    then greatest(0,p_venda_prevista_mes*p_cmv_fracao+
                    p_ajuste_estoque_alvo-p_estoque_e_pedidos)
    else 0 end
$$;

-- OTB!T48 (mes 1), AC48 (mes 2), AL48 (mes 3).
-- Prioridade MP: OTB!B31=MAX(0,B21-S173).
-- B22 inclui a necessidade total, B23 a necessidade de curva A.
-- Excel usa IFERROR(...,0) separadamente nas duas parcelas.
create or replace function painel_interno.zac_v224_liberacao_subgrupo(
  p_necessidade numeric,p_peso_curva_a numeric,
  p_teto_mes numeric,p_necessidade_mp numeric,
  p_necessidade_total numeric,p_necessidade_a_total numeric
) returns numeric
language sql immutable strict set search_path=''
as $$
  select
    p_necessidade * p_peso_curva_a
      * case when (p_necessidade_a_total)<>0
          then least(1,
            greatest(0,p_teto_mes-p_necessidade_mp)/p_necessidade_a_total)
          else 0 end
    +
    p_necessidade * (1-p_peso_curva_a)
      * case when (p_necessidade_total-p_necessidade_a_total)<>0
          then greatest(0,least(1,
            (greatest(0,p_teto_mes-p_necessidade_mp)-p_necessidade_a_total)/
            (p_necessidade_total-p_necessidade_a_total)))
          else 0 end
$$;

-- OTB!T173: matéria-prima tem prioridade até o teto mensal.
create or replace function painel_interno.zac_v224_liberacao_mp(
  p_necessidade_mp numeric,p_teto_mes numeric
) returns numeric
language sql immutable strict set search_path=''
as $$
  select least(p_necessidade_mp,p_teto_mes)
$$;

-- OTB!W48: T + U - V, sem truncar saldo negativo.
create or replace function painel_interno.zac_v224_saldo_otb(
  p_liberado numeric,p_venda_casada_aprovada numeric,p_pedido_gravado numeric
) returns numeric
language sql immutable strict set search_path=''
as $$
  select p_liberado+p_venda_casada_aprovada-p_pedido_gravado
$$;

-- OTB!B29: situação por mês.
create or replace function painel_interno.zac_v224_situacao_otb(
  p_teto numeric,p_necessidade_total numeric,p_necessidade_curva_a numeric
) returns text
language sql immutable strict set search_path=''
as $$
 select case
   when round(p_necessidade_total,2)=0 then 'SEM NECESSIDADE'
   when round(p_teto,2)>=round(p_necessidade_total,2) then 'LIBERADO'
   when round(p_teto,2)>=round(p_necessidade_curva_a,2) then 'SÓ CURVA A + PARTE'
   else 'TRAVADO' end
$$;

-- Verba Comprador!C8: protegido com DDE < 30 dias não recebe
-- o fator de corte aplicado aos demais, caso a trava seja insuficiente.
create or replace function painel_interno.zac_v224_fator_comprador(
  p_teto numeric,p_nec_85_total numeric,p_protegidos_85 numeric
) returns numeric
language sql immutable strict set search_path=''
as $$
 select case when p_nec_85_total<=p_teto then 1
    when p_nec_85_total-p_protegidos_85<>0
      then greatest(0,least(1,
        (p_teto-p_protegidos_85)/(p_nec_85_total-p_protegidos_85)))
    else 0 end
$$;

-- Verba Comprador!E20/F20: 85% de S48; manter protegidos;
-- limite de DDE é argumento, não uma inferência sobre o Siscom.
create or replace function painel_interno.zac_v224_necessidade_comprador(
  p_necessidade_otb numeric,p_fracao_comprador numeric,
  p_dde_inicio numeric,p_limite_protecao numeric,p_fator_corte numeric
) returns numeric
language sql immutable strict set search_path=''
as $$
 select p_necessidade_otb*p_fracao_comprador*
    case when p_dde_inicio is not null and p_dde_inicio<p_limite_protecao
      then 1 else p_fator_corte end
$$;

-- Rem Parâmetros!C23:D26: 0 a <80%=0; 80 a <100%=0,5;
-- 100 a <120%=1; 120%+=1,5.
create or replace function painel_interno.zac_v224_multiplicador_premio(
  p_atingimento numeric
) returns numeric
language sql immutable strict set search_path=''
as $$
 select case
   when p_atingimento<0.80 then 0
   when p_atingimento<1.00 then 0.5
   when p_atingimento<1.20 then 1
   else 1.5 end
$$;

-- Rem Parâmetros!E13:G18: prêmio KPI = variável-meta * peso * fator;
-- não calcula salário/remuneração sem as fontes homologadas de cada KPI.
create or replace function painel_interno.zac_v224_premio_kpi(
  p_variavel_meta numeric,p_peso_kpi numeric,p_atingimento numeric
) returns numeric
language sql immutable strict set search_path=''
as $$
  select p_variavel_meta*p_peso_kpi*
    painel_interno.zac_v224_multiplicador_premio(p_atingimento)
$$;

-- Nenhuma dessas rotinas deve ser chamada pelo browser ou concedida em massa.
revoke all on function painel_interno.zac_v224_crescimento_limitado(numeric,numeric,numeric,numeric),
  painel_interno.zac_v224_previsao_90d(numeric,numeric,numeric,numeric),
  painel_interno.zac_v224_dde(numeric,numeric,numeric),
  painel_interno.zac_v224_curva(boolean,numeric,numeric,numeric),
  painel_interno.zac_v224_necessidade_otb(text,numeric,numeric,numeric,numeric),
  painel_interno.zac_v224_liberacao_subgrupo(numeric,numeric,numeric,numeric,numeric,numeric),
  painel_interno.zac_v224_liberacao_mp(numeric,numeric),
  painel_interno.zac_v224_saldo_otb(numeric,numeric,numeric),
  painel_interno.zac_v224_situacao_otb(numeric,numeric,numeric),
  painel_interno.zac_v224_fator_comprador(numeric,numeric,numeric),
  painel_interno.zac_v224_necessidade_comprador(numeric,numeric,numeric,numeric,numeric),
  painel_interno.zac_v224_multiplicador_premio(numeric),
  painel_interno.zac_v224_premio_kpi(numeric,numeric,numeric)
from PUBLIC,anon,authenticated;
