-- RPC de leitura diagnóstica. Zero importações de arquivos e nenhuma gravação.
-- Não produz orçamento nem estima CMV futuro: estoque atual e CMV saído 90 dias.
create or replace function public.fn_otb_posicao_subgrupos(p_data_base date)
returns table (
  linha integer, grupo_subgrupo text, estoque_custo numeric,
  cmv_90d numeric, sku_count bigint, ultima_atualizacao timestamptz
)
language plpgsql stable security definer set search_path = ''
as $fn$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles pr
    where pr.id = (select auth.uid()) and pr.role = 'master' and pr.ativo = true
  ) then
    raise exception 'Acesso restrito ao Master ativo' using errcode = '42501';
  end if;

  if p_data_base is null or p_data_base < current_date - 62
     or p_data_base > current_date + 1 then
    raise exception 'Data-base fora da janela permitida' using errcode = '22023';
  end if;

  return query
  with cadastro as (
    select p.produto_cod, p.grupo_subgrupo,
           case when c.categoria = 'fora_otb' then -1
                when c.categoria = 'linha' then c.linha
                when p.linha in (1,2,3,4) then p.linha
                else 0 end as linha
    from painel.produtos p
    left join public.otb_classificacao_complementar_produto c on c.produto_cod = p.produto_cod
  ),
  estoques as (
    select c.linha, c.grupo_subgrupo,
           case when count(*) filter (where e.valor is null) > 0 then null::numeric
                else sum(e.valor) end as estoque_custo,
           count(distinct e.produto_cod) as sku_count
    from painel.estoque e
    join cadastro c on c.produto_cod = e.produto_cod
    group by c.linha, c.grupo_subgrupo
  ),
  vendas_90d as (
    select coalesce(c.linha, 0) as linha,
           coalesce(c.grupo_subgrupo, 'SEM CADASTRO') as grupo_subgrupo,
           case when count(*) filter (where v.custo_medio is null) > 0 then null::numeric
                else sum(v.custo_medio) end as cmv_90d
    from painel.vendas v
    left join cadastro c on c.produto_cod = v.produto_cod
    where v.visao = 'saida'
      and v.data >= p_data_base - 90 and v.data < p_data_base
    group by coalesce(c.linha, 0), coalesce(c.grupo_subgrupo, 'SEM CADASTRO')
  ),
  foto as (select max(e.atualizado_em) as atualizacao from painel.estoque e)
  select coalesce(e.linha, v.linha) as linha,
         coalesce(e.grupo_subgrupo, v.grupo_subgrupo) as grupo_subgrupo,
         case when e.grupo_subgrupo is null then 0::numeric else e.estoque_custo end as estoque_custo,
         case when v.grupo_subgrupo is null then 0::numeric else v.cmv_90d end as cmv_90d,
         coalesce(e.sku_count, 0)::bigint as sku_count,
         f.atualizacao as ultima_atualizacao
  from estoques e
  full join vendas_90d v on v.linha = e.linha and v.grupo_subgrupo = e.grupo_subgrupo
  cross join foto f
  order by coalesce(e.linha, v.linha), coalesce(e.grupo_subgrupo, v.grupo_subgrupo);
end;
$fn$;

revoke all on function public.fn_otb_posicao_subgrupos(date) from public, anon, authenticated;
grant execute on function public.fn_otb_posicao_subgrupos(date) to authenticated;

comment on function public.fn_otb_posicao_subgrupos(date) is
  'OTB: foto de estoque a custo e CMV real de saídas dos 90 dias anteriores, somente Master ativo. Não calcula verba financeira nem DDE-alvo.';
