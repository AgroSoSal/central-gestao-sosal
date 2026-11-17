-- Visibilidade de margem: nunca exibir resultado de um mês cuja última
-- tentativa oficial foi marcada ERRO ou PENDENTE na v_conferencia_comissao.
-- Usa materialized view de conferência já acessível ao anon via schema interno;
-- NÃO concede acesso à tabela de lotes ou a dados de clientes.

create or replace view painel.v_margem_loja_mes
with (security_invoker=true,security_barrier=true)
as select m.mes_comercial,m.representante_cod,m.representante,
          m.loja,m.categoria,m.venda,m.margem,m.percentual_margem
from painel_interno.mv_margem_loja_mes m
join painel_interno.mv_conferencia_comissao c
  on c.mes_comercial=m.mes_comercial and c.resultado='OK';

create or replace view painel.v_margem_filial_mes
with (security_invoker=true,security_barrier=true)
as select m.mes_comercial,m.filial,m.venda,m.margem,m.percentual_margem
from painel_interno.mv_margem_filial_mes m
join painel_interno.mv_conferencia_comissao c
  on c.mes_comercial=m.mes_comercial and c.resultado='OK';

revoke all on painel.v_margem_loja_mes,painel.v_margem_filial_mes
  from PUBLIC,anon,authenticated;
grant select on painel.v_margem_loja_mes,painel.v_margem_filial_mes to anon;
