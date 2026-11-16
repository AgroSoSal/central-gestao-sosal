-- Etapa 2: decisões individuais dos pedidos e trilha de auditoria.
-- Não altera extrações RPA, pedidos de origem ou entradas de NFs.
-- Aprovado é a decisão implícita para um item ainda não registrado.
begin;

create table if not exists public.compras_pedido_decisoes (
  loja text not null,
  pedido text not null,
  produto_codigo text not null,
  decisao text not null check (decisao in ('Aprovado', 'Segurar', 'Cancelar')),
  observacao text check (char_length(observacao) <= 500),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid not null references auth.users(id),
  primary key (loja, pedido, produto_codigo)
);

create table if not exists public.compras_pedido_decisoes_auditoria (
  id bigint generated always as identity primary key,
  loja text not null,
  pedido text not null,
  produto_codigo text not null,
  decisao_anterior text check (decisao_anterior in ('Aprovado', 'Segurar', 'Cancelar')),
  decisao_nova text not null check (decisao_nova in ('Aprovado', 'Segurar', 'Cancelar')),
  observacao_anterior text,
  observacao_nova text,
  alterado_em timestamptz not null default now(),
  alterado_por uuid not null references auth.users(id)
);

create index if not exists compras_pedido_decisoes_auditoria_chave_idx
  on public.compras_pedido_decisoes_auditoria (loja, pedido, produto_codigo, id desc);

alter table public.compras_pedido_decisoes enable row level security;
alter table public.compras_pedido_decisoes_auditoria enable row level security;
revoke all on table public.compras_pedido_decisoes from public, anon, authenticated;
revoke all on table public.compras_pedido_decisoes_auditoria from public, anon, authenticated;
revoke all on sequence public.compras_pedido_decisoes_auditoria_id_seq from public, anon, authenticated;

-- As funções são a única porta de leitura/escrita. Conferem JWT + Master ativo
-- no banco antes de acessar tabelas que não têm privilégios diretos na Data API.
create or replace function public.fn_listar_decisoes_compra(p_chaves jsonb)
returns table (
  loja text, pedido text, produto_codigo text, decisao text,
  observacao text, atualizado_em timestamptz, alteracoes jsonb
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
     or jsonb_array_length(p_chaves) > 50 then
    raise exception 'Lista de chaves inválida (máximo 50)' using errcode = '22023';
  end if;

  return query
  select d.loja, d.pedido, d.produto_codigo, d.decisao,
         d.observacao, d.atualizado_em,
         coalesce(h.alteracoes, '[]'::jsonb)
  from public.compras_pedido_decisoes d
  join jsonb_to_recordset(p_chaves) as k(loja text, pedido text, produto_codigo text)
    on (d.loja, d.pedido, d.produto_codigo) = (k.loja, k.pedido, k.produto_codigo)
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'anterior', a.decisao_anterior, 'nova', a.decisao_nova,
      'observacao', a.observacao_nova, 'quando', a.alterado_em,
      'por', coalesce(pr.email, a.alterado_por::text)
    ) order by a.id desc) as alteracoes
    from (
      select * from public.compras_pedido_decisoes_auditoria a0
      where (a0.loja, a0.pedido, a0.produto_codigo) = (d.loja, d.pedido, d.produto_codigo)
      order by a0.id desc limit 10
    ) a
    left join public.profiles pr on pr.id = a.alterado_por
  ) h on true;
end;
$$;

create or replace function public.fn_registrar_decisao_pedido_compra(
  p_loja text, p_pedido text, p_produto_codigo text,
  p_decisao text, p_observacao text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_ator uuid := (select auth.uid());
  v_antes public.compras_pedido_decisoes%rowtype;
  v_observacao text := nullif(btrim(coalesce(p_observacao, '')), '');
begin
  if v_ator is null or not exists (
    select 1 from public.profiles pr
    where pr.id = v_ator and pr.role = 'master' and pr.ativo = true
  ) then
    raise exception 'Acesso restrito ao Master ativo' using errcode = '42501';
  end if;

  if p_decisao is null or p_decisao not in ('Aprovado', 'Segurar', 'Cancelar') then
    raise exception 'Decisão inválida' using errcode = '22023';
  end if;
  if p_loja is null or p_pedido is null or p_produto_codigo is null
     or char_length(p_loja) > 100 or char_length(p_pedido) > 100
     or char_length(p_produto_codigo) > 150 or char_length(v_observacao) > 500 then
    raise exception 'Identificação ou observação inválida' using errcode = '22023';
  end if;

  -- Bloqueia registros para chaves inventadas; nenhuma escrita na origem.
  if not exists (
    select 1 from "Só Sal".v_rpa_pedidos_compra p
    where (p.loja, p.pedido, p.produto_codigo) = (p_loja, p_pedido, p_produto_codigo)
  ) then
    raise exception 'Item de pedido não encontrado na extração' using errcode = '22023';
  end if;

  -- Serializa alterações simultâneas do mesmo item, preservando a auditoria.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(jsonb_build_array(p_loja, p_pedido, p_produto_codigo)::text, 0)
  );
  select * into v_antes from public.compras_pedido_decisoes d
  where (d.loja, d.pedido, d.produto_codigo) = (p_loja, p_pedido, p_produto_codigo);

  if found and v_antes.decisao = p_decisao
     and v_antes.observacao is not distinct from v_observacao then
    return;
  end if;

  insert into public.compras_pedido_decisoes
    (loja, pedido, produto_codigo, decisao, observacao, atualizado_em, atualizado_por)
  values
    (p_loja, p_pedido, p_produto_codigo, p_decisao, v_observacao, clock_timestamp(), v_ator)
  on conflict (loja, pedido, produto_codigo) do update
  set decisao = excluded.decisao, observacao = excluded.observacao,
      atualizado_em = excluded.atualizado_em, atualizado_por = excluded.atualizado_por;

  insert into public.compras_pedido_decisoes_auditoria
    (loja, pedido, produto_codigo, decisao_anterior, decisao_nova,
     observacao_anterior, observacao_nova, alterado_por)
  values
    (p_loja, p_pedido, p_produto_codigo, v_antes.decisao, p_decisao,
     v_antes.observacao, v_observacao, v_ator);
end;
$$;

revoke all on function public.fn_listar_decisoes_compra(jsonb) from public, anon;
revoke all on function public.fn_registrar_decisao_pedido_compra(text,text,text,text,text) from public, anon;
grant execute on function public.fn_listar_decisoes_compra(jsonb) to authenticated;
grant execute on function public.fn_registrar_decisao_pedido_compra(text,text,text,text,text) to authenticated;
commit;
