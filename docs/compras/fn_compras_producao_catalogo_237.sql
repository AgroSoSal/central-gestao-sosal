-- Catálogo próprio: SKU/marca do SISCOM, sem inferir peso unitário de estoque.peso.
create or replace function public.fn_compras_producao_catalogo_237(
  p_busca text default null, p_pagina integer default 1, p_tamanho integer default 40
)
returns table(produto_cod text, descricao text, grupo_subgrupo text,
              marca text, qtde_estoque numeric, valor_estoque numeric, total_itens bigint)
language plpgsql stable security definer
set search_path to ''
set statement_timeout to '6s'
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
     p_tamanho not between 1 and 100 then
    raise exception 'Filtros inválidos' using errcode='22023';
  end if;
  return query
  with estoque as (
    select e.produto_cod, sum(e.qtde) qtde, sum(e.valor) valor
    from painel.estoque e group by e.produto_cod
  )
  select p.produto_cod,p.descricao,p.grupo_subgrupo,p.marca,
         e.qtde,e.valor,count(*) over ()::bigint
  from painel.produtos p
  left join estoque e on e.produto_cod=p.produto_cod
  where upper(trim(coalesce(p.marca,'')))='SO SAL'
    and (nullif(trim(p_busca),'') is null or
      p.produto_cod ilike '%'||trim(p_busca)||'%' or
      p.descricao ilike '%'||trim(p_busca)||'%' or
      p.grupo_subgrupo ilike '%'||trim(p_busca)||'%')
  order by p.grupo_subgrupo,p.descricao,p.produto_cod
  limit p_tamanho offset (p_pagina-1)*p_tamanho;
end
$$;

revoke all on function public.fn_compras_producao_catalogo_237(text,integer,integer) from public,anon;
grant execute on function public.fn_compras_producao_catalogo_237(text,integer,integer) to authenticated;
