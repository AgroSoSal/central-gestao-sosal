-- Etapa 7 — complemento de classificação por item de pedido (coluna AN da Zacarini).
-- Migração aditiva. Não altera fonte SISCOM/RPA nem tabelas de NFs ou contas a pagar.
begin;

create table if not exists public.compras_pedido_classificacao (
  loja text not null,
  pedido text not null,
  produto_codigo text not null,
  grupo_subgrupo_manual text not null check (grupo_subgrupo_manual ~ '^[1-6]\..{2,197}$'),
  motivo text not null check (char_length(btrim(motivo)) between 8 and 500),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid not null references auth.users(id),
  primary key (loja, pedido, produto_codigo)
);

create table if not exists public.compras_pedido_classificacao_auditoria (
  id bigint generated always as identity primary key,
  loja text not null,
  pedido text not null,
  produto_codigo text not null,
  grupo_anterior text,
  grupo_novo text not null,
  motivo_anterior text,
  motivo_novo text not null,
  alterado_em timestamptz not null default now(),
  alterado_por uuid not null references auth.users(id)
);

create index if not exists compras_pedido_classificacao_auditoria_chave_idx
  on public.compras_pedido_classificacao_auditoria (loja, pedido, produto_codigo, id desc);

alter table public.compras_pedido_classificacao enable row level security;
alter table public.compras_pedido_classificacao_auditoria enable row level security;
revoke all on table public.compras_pedido_classificacao from public, anon, authenticated;
revoke all on table public.compras_pedido_classificacao_auditoria from public, anon, authenticated;
revoke all on sequence public.compras_pedido_classificacao_auditoria_id_seq from public, anon, authenticated;

-- Retorna uma linha para cada chave solicitada, INCLUSIVE quando não existe
-- classificação, para que o ERP nunca assuma que uma ausência equivale a compra.
create or replace function public.fn_listar_classificacao_compras(p_chaves jsonb)
returns table (
  loja text, pedido text, produto_codigo text,
  grupo_subgrupo text, origem text
)
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles pr
    where pr.id = (select auth.uid()) and pr.role = 'master' and pr.ativo = true
  ) then
    raise exception 'Acesso restrito ao Master ativo' using errcode = '42501';
  end if;
  if p_chaves is null or jsonb_typeof(p_chaves) <> 'array'
     or jsonb_array_length(p_chaves) > 100 then
    raise exception 'Lista de chaves inválida (máximo 100)' using errcode = '22023';
  end if;

  return query
  with chaves as (
    select k.loja, k.pedido, k.produto_codigo
    from jsonb_to_recordset(p_chaves) as k(loja text, pedido text, produto_codigo text)
  ), catalogo as (
    select upper(btrim(p.produto_cod)) as codigo,
      case when count(distinct nullif(btrim(p.grupo_subgrupo), '')) = 1
        then max(nullif(btrim(p.grupo_subgrupo), '')) else null end as grupo
    from painel.produtos p
    where nullif(btrim(p.produto_cod), '') is not null
    group by upper(btrim(p.produto_cod))
  )
  select c.loja, c.pedido, c.produto_codigo,
    coalesce(m.grupo_subgrupo_manual, cat.grupo) as grupo_subgrupo,
    case when m.grupo_subgrupo_manual is not null then 'manual'
         when cat.grupo is not null then 'cadastro'
         else 'sem_classificacao' end as origem
  from chaves c
  left join public.compras_pedido_classificacao m
    on (m.loja, m.pedido, m.produto_codigo) = (c.loja, c.pedido, c.produto_codigo)
  left join catalogo cat on cat.codigo = upper(btrim(c.produto_codigo));
end;
$$;

create or replace function public.fn_registrar_classificacao_compra(
  p_loja text, p_pedido text, p_produto_codigo text,
  p_grupo_subgrupo text, p_motivo text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_ator uuid := (select auth.uid());
  v_grupo text := btrim(coalesce(p_grupo_subgrupo, ''));
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_antes public.compras_pedido_classificacao%rowtype;
begin
  if v_ator is null or not exists (
    select 1 from public.profiles pr
    where pr.id = v_ator and pr.role = 'master' and pr.ativo = true
  ) then
    raise exception 'Acesso restrito ao Master ativo' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_loja, '')), '') is null
     or nullif(btrim(coalesce(p_pedido, '')), '') is null
     or nullif(btrim(coalesce(p_produto_codigo, '')), '') is null
     or char_length(p_loja) > 100 or char_length(p_pedido) > 100
     or char_length(p_produto_codigo) > 150
     or v_grupo !~ '^[1-6]\..{2,197}$'
     or char_length(v_motivo) not between 8 and 500 then
    raise exception 'Chave, classificação ou motivo inválido' using errcode = '22023';
  end if;

  if not exists (
    select 1 from "Só Sal".v_rpa_pedidos_compra p
    where (p.loja, p.pedido, p.produto_codigo) = (p_loja, p_pedido, p_produto_codigo)
  ) then
    raise exception 'Item não encontrado na extração' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(jsonb_build_array(p_loja, p_pedido, p_produto_codigo)::text, 0)
  );
  select * into v_antes from public.compras_pedido_classificacao d
  where (d.loja, d.pedido, d.produto_codigo) = (p_loja, p_pedido, p_produto_codigo);

  if found and v_antes.grupo_subgrupo_manual = v_grupo
     and v_antes.motivo = v_motivo then return; end if;

  insert into public.compras_pedido_classificacao
    (loja, pedido, produto_codigo, grupo_subgrupo_manual, motivo, atualizado_em, atualizado_por)
  values (p_loja, p_pedido, p_produto_codigo, v_grupo, v_motivo, clock_timestamp(), v_ator)
  on conflict (loja, pedido, produto_codigo) do update
  set grupo_subgrupo_manual = excluded.grupo_subgrupo_manual,
      motivo = excluded.motivo,
      atualizado_em = excluded.atualizado_em,
      atualizado_por = excluded.atualizado_por;

  insert into public.compras_pedido_classificacao_auditoria
    (loja, pedido, produto_codigo, grupo_anterior, grupo_novo,
     motivo_anterior, motivo_novo, alterado_por)
  values (p_loja, p_pedido, p_produto_codigo,
          v_antes.grupo_subgrupo_manual, v_grupo, v_antes.motivo, v_motivo, v_ator);
end;
$$;

revoke all on function public.fn_listar_classificacao_compras(jsonb) from public, anon;
revoke all on function public.fn_registrar_classificacao_compra(text,text,text,text,text) from public, anon;
grant execute on function public.fn_listar_classificacao_compras(jsonb) to authenticated;
grant execute on function public.fn_registrar_classificacao_compra(text,text,text,text,text) to authenticated;
commit;
