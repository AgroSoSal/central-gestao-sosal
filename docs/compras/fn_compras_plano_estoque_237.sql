-- Metas seis meses da Gestão Zacarini 2.3.7, posição a custo factual.
-- NÃO calcula verba futura nem presume custos projetados.
create or replace function public.fn_compras_plano_estoque_237(
  p_busca text default null, p_competencia date default null,
  p_pagina integer default 1, p_tamanho integer default 50
)
returns table (
  grupo_subgrupo text, competencia date, dde_meta integer, versao text,
  valor_estoque numeric, cmv_90d numeric, dde_observado numeric,
  itens_estoque bigint, total_itens bigint
)
language plpgsql stable security definer
set search_path to ''
set statement_timeout to '8s'
set lock_timeout to '2s'
as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.role='master' and p.ativo
  ) then
    raise exception 'Acesso permitido apenas a Master ativo' using errcode='42501';
  end if;
  if length(coalesce(p_busca,''))>80 or p_pagina not between 1 and 100 or
     p_tamanho not between 1 and 100 or
     (p_competencia is not null and extract(day from p_competencia)<>1) then
    raise exception 'Filtros inválidos' using errcode='22023';
  end if;
  return query
  with estoque as (
    select p.grupo_subgrupo, sum(e.valor) as valor, count(*)::bigint as itens
    from painel.estoque e join painel.produtos p on p.produto_cod=e.produto_cod
    group by p.grupo_subgrupo
  ),
  abc as (
    select p.grupo_subgrupo, sum(a.custo_90d) as cmv
    from painel.mv_abc_janelas a
    join painel.produtos p on p.produto_cod=a.produto_cod
    group by p.grupo_subgrupo
  )
  select m.grupo_subgrupo, m.competencia, m.dde_meta, m.versao,
         e.valor, a.cmv,
         case when a.cmv>0 then e.valor*90::numeric/a.cmv else null end,
         e.itens, count(*) over ()::bigint
  from public.compras_dde_plano_237 m
  left join estoque e on e.grupo_subgrupo=m.grupo_subgrupo
  left join abc a on a.grupo_subgrupo=m.grupo_subgrupo
  where (p_competencia is null or m.competencia=p_competencia)
    and (nullif(trim(p_busca),'') is null or m.grupo_subgrupo ilike '%'||trim(p_busca)||'%')
  order by m.competencia, m.grupo_subgrupo
  limit p_tamanho offset (p_pagina-1)*p_tamanho;
end
$$;

revoke all on function public.fn_compras_plano_estoque_237(text,date,integer,integer) from public, anon;
grant execute on function public.fn_compras_plano_estoque_237(text,date,integer,integer) to authenticated;
