-- Corrige o timeout da fonte de vendas/CMV no OTB sem refresh ou leitura integral
-- de painel.vendas. A carga diária já mantém painel.mv_venda_dia_linha.
-- A materialização guarda 'itens' (soma de n_linhas), não COUNT(*) da tabela bruta.
-- Mantemos o contrato de saída da RPC, mas o campo registros representa itens da
-- extração; a interface explicita essa unidade para não induzir a erro.
-- Apenas os produtos com classificação complementar exigem ajuste sobre o resumo.

create or replace function public.fn_otb_historico_mensal(p_inicio date, p_fim date)
returns table (
  mes date,
  linha integer,
  visao text,
  venda_bruta numeric,
  cmv numeric,
  lucro numeric,
  registros bigint
)
language plpgsql stable security definer
set search_path to ''
set statement_timeout to '5s'
as $function$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles pr
    where pr.id = (select auth.uid())
      and pr.role = 'master' and pr.ativo
  ) then
    raise exception 'Acesso restrito ao Master ativo' using errcode='42501';
  end if;

  if p_inicio is null or p_fim is null
    or p_inicio <> date_trunc('month',p_inicio)::date
    or p_fim <> date_trunc('month',p_fim)::date
    or p_fim < p_inicio
    or p_fim >= (p_inicio + interval '24 months')::date
  then
    raise exception 'Intervalo inválido: informar dois inícios de mês em até 24 competências'
      using errcode='22023';
  end if;

  return query
  with base as (
    select date_trunc('month',d.data)::date as mes,
      d.linha, d.visao,
      sum(d.vda_bruta) as venda_bruta,
      sum(d.custo_medio) as cmv,
      sum(d.lucro_medio) as lucro,
      sum(coalesce(d.itens,0))::bigint as registros
    from painel.mv_venda_dia_linha d
    where d.data >= p_inicio
      and d.data < (p_fim + interval '1 month')::date
      and d.visao in ('vendido','saida')
    group by 1,2,3
  ),
  complementares as (
    select date_trunc('month',v.data)::date as mes,
      v.visao,
      case when p.linha in (1,2,3,4) then p.linha else 0 end as linha_original,
      case when c.categoria='fora_otb' then -1
        when c.categoria='linha' then c.linha
        when p.linha in (1,2,3,4) then p.linha else 0 end as linha_otb,
      coalesce(sum(v.vda_bruta),0) as venda_bruta,
      coalesce(sum(v.custo_medio),0) as cmv,
      coalesce(sum(v.lucro_medio),0) as lucro,
      sum(coalesce(v.n_linhas,0))::bigint as registros
    from painel.vendas v
    join public.otb_classificacao_complementar_produto c on c.produto_cod=v.produto_cod
    left join painel.produtos p on p.produto_cod=v.produto_cod
    where v.data >= p_inicio
      and v.data < (p_fim + interval '1 month')::date
      and v.visao in ('vendido','saida')
    group by 1,2,3,4
  ),
  movimentos as (
    select b.mes,b.linha,b.visao,b.venda_bruta,b.cmv,b.lucro,b.registros from base b
    union all
    select c.mes,c.linha_original,c.visao,-c.venda_bruta,-c.cmv,-c.lucro,-c.registros
    from complementares c where c.linha_original is distinct from c.linha_otb
    union all
    select c.mes,c.linha_otb,c.visao,c.venda_bruta,c.cmv,c.lucro,c.registros
    from complementares c where c.linha_original is distinct from c.linha_otb
  )
  select m.mes,m.linha,m.visao,
    sum(m.venda_bruta),sum(m.cmv),sum(m.lucro),sum(m.registros)::bigint
  from movimentos m
  group by m.mes,m.linha,m.visao
  having sum(m.registros)>0
  order by 1,2,3;
end;
$function$;

revoke all on function public.fn_otb_historico_mensal(date,date) from public,anon;
grant execute on function public.fn_otb_historico_mensal(date,date) to authenticated;
