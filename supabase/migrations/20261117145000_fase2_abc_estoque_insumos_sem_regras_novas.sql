-- Fase 2: insumos estruturados para Curva ABC, DDE, estoque parado.
-- Não classificar A/B/C, "parado", ruptura ou DDE sem fórmulas da versão 2.3.1.
-- Aqui "loja" da estrutura antiga é apelido de FILIAL física, e NÃO
-- representante comercial. Mapeamento entre estoque e representante requer
-- decisão formal. Nenhuma view nova consulta JSON bruto.

create or replace view painel.v_abc_dde_insumos_filial
with (security_invoker=true,security_barrier=true)
as
select e.filial,
       l.loja as descricao_filial,
       e.produto_cod,
       p.descricao as produto,
       p.linha,
       p.grupo_subgrupo,
       p.fornecedor,
       e.qtde as estoque_qtde,
       e.valor as estoque_valor,
       e.atualizado_em as estoque_atualizado_em,
       a.qtde_90d,
       a.venda_90d,
       a.custo_90d,
       a.qtde_base_aa,
       a.venda_base_aa,
       a.custo_base_aa,
       a.qtde_prox_aa,
       a.venda_prox_aa,
       a.custo_prox_aa,
       a.data_fim as demanda_data_fim,
       (a.produto_cod is not null) as tem_dados_demanda
from painel.estoque e
left join painel.produtos p on p.produto_cod=e.produto_cod
left join painel.lojas l on l.filial=e.filial
left join painel.v_abc_janelas a
  on a.produto_cod=e.produto_cod and a.loja=l.loja;

-- Soma física única da rede. Não multiplica por vendedor/representante.
create or replace view painel.v_estoque_insumos_rede
with (security_invoker=true,security_barrier=true)
as
select e.produto_cod,
       max(p.descricao) as produto,
       max(p.linha) as linha,
       sum(e.qtde) as estoque_qtde_rede,
       sum(e.valor) as estoque_valor_rede,
       count(distinct e.filial) as filiais_com_registro,
       max(e.atualizado_em) as atualizado_em_recente,
       min(e.atualizado_em) as atualizado_em_mais_antigo
from painel.estoque e
left join painel.produtos p on p.produto_cod=e.produto_cod
group by e.produto_cod;

-- Somente diagnóstico de disponibilidade; não transforma ausências
-- em "demanda zero" e não toma decisões sobre estoque parado.
create or replace view painel.v_abc_dde_diagnostico
with (security_invoker=true,security_barrier=true)
as
select filial,descricao_filial,
  count(*) skus_estoque,
  count(*) filter(where tem_dados_demanda) skus_com_demanda_abc,
  count(*) filter(where not tem_dados_demanda) skus_sem_demanda_abc,
  count(*) filter(where estoque_atualizado_em is null) skus_sem_snapshot,
  min(estoque_atualizado_em) snapshot_mais_antigo,
  max(estoque_atualizado_em) snapshot_mais_recente,
  max(demanda_data_fim) ultima_data_demanda
from painel.v_abc_dde_insumos_filial
group by filial,descricao_filial;

-- Todas essas fontes são internas e não fazem parte dos KPIs aprovados.
revoke all on painel.v_abc_dde_insumos_filial,
 painel.v_estoque_insumos_rede,
 painel.v_abc_dde_diagnostico from PUBLIC,anon,authenticated;
