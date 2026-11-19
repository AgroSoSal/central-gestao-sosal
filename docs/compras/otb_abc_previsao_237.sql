-- Projeção ABC de 90 dias conforme ABCEstoque_DDE, versão 2.3.7.
-- Somente leitura: painel.mv_abc_janelas e painel.produtos. Não usa Excel em execução.
-- Os custos próprios são lidos de compras_dashboard_config_237: valores
-- versionados da aba Produção Própria, sem acesso ao Excel em execução.
-- Premissas de referência não homologam preço/custo nem autorizam compra.
-- Coxim: base ano passado, mas não comparável para crescimento.
-- Anastácio: base últimos 90 dias, não comparável.
-- Bandeirantes/Campo Grande/Pedro Gomes/Rio Verde: comparáveis.

create or replace function public.fn_otb_abc_previsao_237(p_data_base date)
returns table (
  linha integer,grupo_subgrupo text,venda_projetada_90d numeric,
  cmv_projetado_90d numeric,venda_curva_a_90d numeric,skus bigint,
  data_fim date,custos_producao_pendentes bigint
)
language plpgsql stable security definer
set search_path to ''
set statement_timeout to '8s'
as $function$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles pr
    where pr.id = (select auth.uid()) and pr.role='master' and pr.ativo
  ) then
    raise exception 'Acesso restrito ao Master ativo' using errcode='42501';
  end if;
  if p_data_base is null or p_data_base < date '2022-01-01'
    or p_data_base > current_date+interval '30 days' then
    raise exception 'Data-base inválida' using errcode='22023';
  end if;

  return query
  with custo_proprio as (
    select c.dimensao as produto_cod, c.valor as custo_extra_unidade
    from public.compras_dashboard_config_237 c
    where c.grupo = 'producao_referencia'
      and c.codigo = 'producao_custo_extra_un_' || c.dimensao
      and c.competencia is null
      and c.versao = '2.3.7'
      and c.situacao in ('referencia','homologado')
      and c.origem_aba = 'Produção Própria'
      and c.valor >= 0
  ), fonte as (
    select a.produto_cod, a.grupo_subgrupo, a.loja,a.qtde_90d,a.venda_90d,
      a.custo_90d,a.qtde_base_aa,a.qtde_prox_aa,a.venda_prox_aa,
      a.custo_prox_aa,a.data_fim
    from painel.mv_abc_janelas a
    where left(a.grupo_subgrupo,2) in ('1.','2.','3.','4.')
      and a.data_fim <= p_data_base
  ), por_sku as (
    select f.produto_cod,f.grupo_subgrupo,
      sum(f.qtde_90d) as d,
      sum(f.venda_90d) as e,
      sum(f.custo_90d) as custo,
      sum(f.qtde_prox_aa) filter (where f.loja<>'Anastácio') as h,
      sum(f.qtde_90d) filter (where f.loja='Anastácio') as i,
      sum(f.venda_prox_aa) as vda_prox,
      sum(f.custo_prox_aa) as custo_prox,
      sum(f.qtde_prox_aa) as qtd_prox,
      sum(f.qtde_90d) filter (where f.loja in ('Bandeirantes','Campo Grande','Pedro Gomes','Rio Verde')) as comp_90,
      sum(f.qtde_base_aa) filter (where f.loja in ('Bandeirantes','Campo Grande','Pedro Gomes','Rio Verde')) as comp_base,
      max(f.data_fim) as fim
    from fonte f group by f.produto_cod,f.grupo_subgrupo
  ), por_subgrupo as (
    select f.grupo_subgrupo,
      sum(f.qtde_90d) filter (where f.loja in ('Bandeirantes','Campo Grande','Pedro Gomes','Rio Verde'))
      /nullif(sum(f.qtde_base_aa) filter (where f.loja in ('Bandeirantes','Campo Grande','Pedro Gomes','Rio Verde')),0) as crescimento
    from fonte f group by f.grupo_subgrupo
  ), entradas as (
    select s.*,coalesce(c.custo_extra_unidade,0) as custo_extra,
      case when p.descricao ilike '%SO SAL%' and s.grupo_subgrupo like '1.%'
        and c.produto_cod is null then 1 else 0 end as sem_custo_proprio,
      greatest(0,least(4,coalesce(s.comp_90/nullif(s.comp_base,0),g.crescimento,1))) as m
    from por_sku s
    left join por_subgrupo g using (grupo_subgrupo)
    left join custo_proprio c on c.produto_cod=s.produto_cod
    left join painel.produtos p on p.produto_cod=s.produto_cod
  ), projecao as (
    select x.produto_cod,x.grupo_subgrupo,x.fim,x.sem_custo_proprio,
      (x.m*coalesce(x.h,0)+coalesce(x.i,0)) as qty_prev,
      (x.m*coalesce(x.h,0)+coalesce(x.i,0))*
        (case when x.d>0 then x.e/x.d else coalesce(x.vda_prox/nullif(x.qtd_prox,0),0) end) as vendas,
      (x.m*coalesce(x.h,0)+coalesce(x.i,0))*
        (case when x.d>0 then (x.e-x.custo-x.d*x.custo_extra)/x.d
          else coalesce((x.vda_prox-x.custo_prox)/nullif(x.qtd_prox,0),0)-x.custo_extra end) as margem
    from entradas x
  ), abc as (
    select p.*,
      case when p.margem>0 and p.grupo_subgrupo<>'1.LINHA NUTRIÇÃO / MATERIA PRIMA'
        then sum(case when p.margem>0 and p.grupo_subgrupo<>'1.LINHA NUTRIÇÃO / MATERIA PRIMA'
          then p.margem else 0 end)
          over (order by p.margem desc range between unbounded preceding and current row)
        else null end as acum_margem,
      sum(case when p.margem>0 and p.grupo_subgrupo<>'1.LINHA NUTRIÇÃO / MATERIA PRIMA'
        then p.margem else 0 end) over () as total_margem
    from projecao p
  )
  select substring(a.grupo_subgrupo,1,1)::integer as linha,
    a.grupo_subgrupo::text,sum(a.vendas)::numeric as venda_projetada_90d,
    sum(a.vendas-a.margem)::numeric as cmv_projetado_90d,
    coalesce(sum(a.vendas) filter (where a.acum_margem/nullif(a.total_margem,0)<=0.8),0)::numeric as venda_curva_a_90d,
    count(*)::bigint as skus,max(a.fim)::date as data_fim,
    sum(a.sem_custo_proprio)::bigint as custos_producao_pendentes
  from abc a
  group by a.grupo_subgrupo
  order by 1,2;
end;
$function$;

revoke all on function public.fn_otb_abc_previsao_237(date) from public,anon;
grant execute on function public.fn_otb_abc_previsao_237(date) to authenticated;
