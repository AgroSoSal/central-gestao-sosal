-- Auditoria leve de pedidos que a Projeção 12M precisaria considerar.
-- NÃO transforma pedidos antigos em chegada amanhã e NÃO libera OTB.
-- Usa somente a carteira já conciliada/persistida, sem repetir o cruzamento de NFs.
create or replace function public.fn_compras_dashboard_pedidos_qualidade_237()
returns table (
  itens_pendentes bigint,
  pedidos_pendentes bigint,
  valor_pendente numeric,
  itens_sem_grupo bigint,
  valor_sem_grupo numeric,
  itens_sem_previsao bigint,
  itens_sem_condicao bigint,
  itens_com_previsao_futura bigint,
  data_pedido_mais_antigo date,
  ultima_conciliacao timestamptz
)
language plpgsql stable security definer
set search_path to ''
set statement_timeout to '5s'
as $function$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles p where p.id=(select auth.uid())
      and p.role='master' and p.ativo
  ) then
    raise exception 'Somente Master ativo' using errcode='42501';
  end if;
  return query
  select count(*)::bigint,
    count(distinct (o.loja,o.pedido))::bigint,
    coalesce(sum(o.valor_pendente),0)::numeric,
    count(*) filter (where o.grupo_subgrupo !~ '^[1-4]\.' or o.grupo_subgrupo is null)::bigint,
    coalesce(sum(o.valor_pendente) filter (where o.grupo_subgrupo !~ '^[1-4]\.' or o.grupo_subgrupo is null),0)::numeric,
    count(*) filter (where f.previsao_entrega is null)::bigint,
    count(*) filter (where nullif(btrim(o.condicao_pagamento),'') is null)::bigint,
    count(*) filter (where f.previsao_entrega >= current_date)::bigint,
    min(o.data_pedido), max(o.calculado_em)
  from painel.alex_pedidos_em_aberto o
  left join public.compras_pedido_decisoes d
    on d.loja=o.loja and d.pedido=o.pedido and d.produto_codigo=o.produto_codigo
  left join public.compras_pedido_followups f
    on f.loja=o.loja and f.pedido=o.pedido and f.produto_codigo=o.produto_codigo
  where o.quantidade_pendente>0 and o.valor_pendente>0
    and coalesce(d.decisao,o.decisao,'') not in ('Segurar','Cancelar','Já pago');
end;
$function$;

revoke all on function public.fn_compras_dashboard_pedidos_qualidade_237() from public,anon;
grant execute on function public.fn_compras_dashboard_pedidos_qualidade_237() to authenticated;
