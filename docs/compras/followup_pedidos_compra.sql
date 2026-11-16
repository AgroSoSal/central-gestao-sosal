-- Executado após autorização explícita do responsável em 16/11/2026.
-- Migração: compras_followup_entregas_20261116.
-- Exclusivamente novos registros de acompanhamento: não altera RPA, pedidos,
-- notas fiscais, decisões históricas, painéis ou saldo calculado pela conciliação.
begin;

create table if not exists public.compras_pedido_followups (
  loja text not null,
  pedido text not null,
  produto_codigo text not null,
  previsao_entrega date,
  proximo_contato date,
  retorno_fornecedor text check (char_length(retorno_fornecedor) <= 1000),
  posicionamento_comprador text check (char_length(posicionamento_comprador) <= 1000),
  transportadora text check (char_length(transportadora) <= 150),
  codigo_rastreio text check (char_length(codigo_rastreio) <= 150),
  status_entrega text not null default 'Aguardando fornecedor'
    check (status_entrega in (
      'Aguardando fornecedor', 'Previsão informada', 'Em transporte',
      'Ocorrência de entrega', 'Entrega parcial'
    )),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid not null references auth.users(id),
  primary key (loja, pedido, produto_codigo)
);

create table if not exists public.compras_pedido_followups_auditoria (
  id bigint generated always as identity primary key,
  loja text not null,
  pedido text not null,
  produto_codigo text not null,
  anterior jsonb,
  novo jsonb not null,
  alterado_em timestamptz not null default now(),
  alterado_por uuid not null references auth.users(id)
);

create index if not exists compras_pedido_followups_auditoria_chave_idx
  on public.compras_pedido_followups_auditoria (loja, pedido, produto_codigo, id desc);

alter table public.compras_pedido_followups enable row level security;
alter table public.compras_pedido_followups_auditoria enable row level security;
revoke all on public.compras_pedido_followups from public, anon, authenticated;
revoke all on public.compras_pedido_followups_auditoria from public, anon, authenticated;
revoke all on sequence public.compras_pedido_followups_auditoria_id_seq from public, anon, authenticated;

create or replace function public.fn_listar_followup_compras(p_chaves jsonb)
returns table (
  loja text, pedido text, produto_codigo text,
  previsao_entrega date, proximo_contato date, retorno_fornecedor text,
  posicionamento_comprador text, transportadora text, codigo_rastreio text,
  status_entrega text, atualizado_em timestamptz, alteracoes jsonb
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
  if p_chaves is null or jsonb_typeof(p_chaves) <> 'array' or jsonb_array_length(p_chaves) > 50 then
    raise exception 'Lista de chaves inválida (máximo 50)' using errcode = '22023';
  end if;

  return query
  select f.loja, f.pedido, f.produto_codigo, f.previsao_entrega, f.proximo_contato,
    f.retorno_fornecedor, f.posicionamento_comprador, f.transportadora, f.codigo_rastreio,
    f.status_entrega, f.atualizado_em, coalesce(h.alteracoes, '[]'::jsonb)
  from public.compras_pedido_followups f
  join jsonb_to_recordset(p_chaves) as k(loja text, pedido text, produto_codigo text)
    on (f.loja, f.pedido, f.produto_codigo) = (k.loja, k.pedido, k.produto_codigo)
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'quando', a.alterado_em, 'por', coalesce(pr.email, a.alterado_por::text),
      'anterior', a.anterior, 'novo', a.novo
    ) order by a.id desc) as alteracoes
    from (
      select * from public.compras_pedido_followups_auditoria a0
      where (a0.loja, a0.pedido, a0.produto_codigo) = (f.loja, f.pedido, f.produto_codigo)
      order by a0.id desc limit 20
    ) a
    left join public.profiles pr on pr.id = a.alterado_por
  ) h on true;
end;
$$;

create or replace function public.fn_salvar_followup_compra(
  p_loja text, p_pedido text, p_produto_codigo text,
  p_previsao_entrega date default null,
  p_proximo_contato date default null,
  p_retorno_fornecedor text default null,
  p_posicionamento_comprador text default null,
  p_transportadora text default null,
  p_codigo_rastreio text default null,
  p_status_entrega text default 'Aguardando fornecedor'
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_ator uuid := (select auth.uid());
  v_antes public.compras_pedido_followups%rowtype;
  v_novo public.compras_pedido_followups%rowtype;
  v_fornecedor text := nullif(btrim(p_retorno_fornecedor), '');
  v_comprador text := nullif(btrim(p_posicionamento_comprador), '');
  v_transportadora text := nullif(btrim(p_transportadora), '');
  v_rastreio text := nullif(btrim(p_codigo_rastreio), '');
begin
  if v_ator is null or not exists (
    select 1 from public.profiles pr
    where pr.id = v_ator and pr.role = 'master' and pr.ativo = true
  ) then
    raise exception 'Acesso restrito ao Master ativo' using errcode = '42501';
  end if;
  if p_loja is null or p_pedido is null or p_produto_codigo is null
    or char_length(p_loja) > 100 or char_length(p_pedido) > 100 or char_length(p_produto_codigo) > 150
    or char_length(v_fornecedor) > 1000 or char_length(v_comprador) > 1000
    or char_length(v_transportadora) > 150 or char_length(v_rastreio) > 150
    or p_status_entrega is null or p_status_entrega not in (
      'Aguardando fornecedor', 'Previsão informada', 'Em transporte',
      'Ocorrência de entrega', 'Entrega parcial'
    ) then
    raise exception 'Dados de follow-up inválidos' using errcode = '22023';
  end if;

  -- O mesmo bloqueio usado pelas decisões serializa aprovação e follow-up.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(jsonb_build_array(p_loja, p_pedido, p_produto_codigo)::text, 0)
  );

  -- Jamais cria pendência de um pedido inventado ou ainda não aprovado.
  if not exists (
    select 1 from "Só Sal".v_rpa_pedidos_compra p
    where (p.loja, p.pedido, p.produto_codigo) = (p_loja, p_pedido, p_produto_codigo)
  ) or not exists (
    select 1 from public.compras_pedido_decisoes d
    where (d.loja, d.pedido, d.produto_codigo) = (p_loja, p_pedido, p_produto_codigo)
      and d.decisao = 'Aprovado'
  ) then
    raise exception 'Pedido não encontrado ou sem aprovação explícita' using errcode = '22023';
  end if;

  select * into v_antes from public.compras_pedido_followups f
  where (f.loja, f.pedido, f.produto_codigo) = (p_loja, p_pedido, p_produto_codigo);
  if found and row(
    v_antes.previsao_entrega, v_antes.proximo_contato, v_antes.retorno_fornecedor,
    v_antes.posicionamento_comprador, v_antes.transportadora, v_antes.codigo_rastreio,
    v_antes.status_entrega
  ) is not distinct from row(
    p_previsao_entrega, p_proximo_contato, v_fornecedor, v_comprador,
    v_transportadora, v_rastreio, p_status_entrega
  ) then
    return;
  end if;

  insert into public.compras_pedido_followups (
    loja, pedido, produto_codigo, previsao_entrega, proximo_contato,
    retorno_fornecedor, posicionamento_comprador, transportadora, codigo_rastreio,
    status_entrega, atualizado_em, atualizado_por
  ) values (
    p_loja, p_pedido, p_produto_codigo, p_previsao_entrega, p_proximo_contato,
    v_fornecedor, v_comprador, v_transportadora, v_rastreio,
    p_status_entrega, clock_timestamp(), v_ator
  ) on conflict (loja, pedido, produto_codigo) do update set
    previsao_entrega = excluded.previsao_entrega,
    proximo_contato = excluded.proximo_contato,
    retorno_fornecedor = excluded.retorno_fornecedor,
    posicionamento_comprador = excluded.posicionamento_comprador,
    transportadora = excluded.transportadora,
    codigo_rastreio = excluded.codigo_rastreio,
    status_entrega = excluded.status_entrega,
    atualizado_em = excluded.atualizado_em,
    atualizado_por = excluded.atualizado_por;

  select * into v_novo from public.compras_pedido_followups f
  where (f.loja, f.pedido, f.produto_codigo) = (p_loja, p_pedido, p_produto_codigo);
  insert into public.compras_pedido_followups_auditoria
    (loja, pedido, produto_codigo, anterior, novo, alterado_por)
  values (
    p_loja, p_pedido, p_produto_codigo,
    case when v_antes.loja is null then null else to_jsonb(v_antes) - 'atualizado_por' end,
    to_jsonb(v_novo) - 'atualizado_por', v_ator
  );
end;
$$;

revoke all on function public.fn_listar_followup_compras(jsonb) from public, anon;
revoke all on function public.fn_salvar_followup_compra(text,text,text,date,date,text,text,text,text,text) from public, anon;
grant execute on function public.fn_listar_followup_compras(jsonb) to authenticated;
grant execute on function public.fn_salvar_followup_compra(text,text,text,date,date,text,text,text,text,text) to authenticated;
commit;
