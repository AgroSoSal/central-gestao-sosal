-- Gestão Zacarini 2.3.7: parâmetros técnicos de Produção Própria.
-- Apenas rascunhos cadastrados por Master. Não homologam custo SISCOM ou OTB.
create table if not exists public.compras_producao_parametros_237 (
  produto_cod text primary key,
  peso_kg numeric(14,3) not null check (peso_kg > 0 and peso_kg <= 100000),
  industrializacao_rs_t numeric(16,2) not null check (industrializacao_rs_t >= 0 and industrializacao_rs_t <= 10000000),
  frete_rs_t numeric(16,2) check (frete_rs_t >= 0 and frete_rs_t <= 10000000),
  observacao text not null default '' check (length(observacao) <= 500),
  status text not null default 'rascunho' check (status = 'rascunho'),
  atualizado_por uuid not null references auth.users(id),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.compras_producao_parametros_auditoria_237 (
  id bigint generated always as identity primary key,
  produto_cod text not null,
  peso_kg numeric(14,3) not null,
  industrializacao_rs_t numeric(16,2) not null,
  frete_rs_t numeric(16,2),
  observacao text not null,
  evento text not null default 'rascunho_atualizado' check (evento = 'rascunho_atualizado'),
  autor uuid not null references auth.users(id),
  registrado_em timestamptz not null default now()
);

create index if not exists compras_producao_parametros_auditoria_237_cod_idx
  on public.compras_producao_parametros_auditoria_237(produto_cod, registrado_em desc);
alter table public.compras_producao_parametros_237 enable row level security;
alter table public.compras_producao_parametros_auditoria_237 enable row level security;
revoke all on public.compras_producao_parametros_237 from public, anon, authenticated;
revoke all on public.compras_producao_parametros_auditoria_237 from public, anon, authenticated;

create or replace function public.fn_compras_producao_parametros_listar_237(p_codigos text[])
returns table(produto_cod text, peso_kg numeric, industrializacao_rs_t numeric,
              frete_rs_t numeric, observacao text, status text, atualizado_em timestamptz)
language plpgsql stable security definer
set search_path to ''
set statement_timeout to '5s'
as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles p where p.id = (select auth.uid())
      and p.role = 'master' and p.ativo
  ) then raise exception 'Somente Master ativo' using errcode = '42501'; end if;
  if p_codigos is null or cardinality(p_codigos) > 100 then
    raise exception 'Lista de produtos inválida' using errcode = '22023';
  end if;
  return query
    select p.produto_cod, p.peso_kg, p.industrializacao_rs_t,
           p.frete_rs_t, p.observacao, p.status, p.atualizado_em
    from public.compras_producao_parametros_237 p
    where p.produto_cod = any(p_codigos)
    order by p.produto_cod;
end
$$;

create or replace function public.fn_compras_producao_parametros_salvar_237(
  p_produto_cod text, p_peso_kg numeric, p_industrializacao_rs_t numeric,
  p_frete_rs_t numeric default null, p_observacao text default ''
)
returns void
language plpgsql volatile security definer
set search_path to ''
set statement_timeout to '5s'
as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null or not exists (
    select 1 from public.profiles p where p.id = v_user and p.role = 'master' and p.ativo
  ) then raise exception 'Somente Master ativo' using errcode = '42501'; end if;

  if p_produto_cod is null or length(p_produto_cod) > 60 or
     p_peso_kg is null or p_peso_kg <= 0 or p_peso_kg > 100000 or
     p_industrializacao_rs_t is null or p_industrializacao_rs_t < 0 or p_industrializacao_rs_t > 10000000 or
     (p_frete_rs_t is not null and (p_frete_rs_t < 0 or p_frete_rs_t > 10000000)) or
     length(coalesce(p_observacao,'')) > 500 then
    raise exception 'Parâmetros técnicos inválidos' using errcode = '22023';
  end if;
  if not exists (
    select 1 from painel.produtos p
    where p.produto_cod = p_produto_cod and upper(trim(p.marca)) = 'SO SAL'
  ) then raise exception 'Produto não pertence à marca própria' using errcode = '22023'; end if;

  insert into public.compras_producao_parametros_237
    (produto_cod,peso_kg,industrializacao_rs_t,frete_rs_t,observacao,atualizado_por,atualizado_em)
  values (p_produto_cod,p_peso_kg,p_industrializacao_rs_t,p_frete_rs_t,coalesce(p_observacao,''),v_user,now())
  on conflict (produto_cod) do update set
    peso_kg=excluded.peso_kg, industrializacao_rs_t=excluded.industrializacao_rs_t,
    frete_rs_t=excluded.frete_rs_t, observacao=excluded.observacao,
    atualizado_por=excluded.atualizado_por, atualizado_em=excluded.atualizado_em;

  insert into public.compras_producao_parametros_auditoria_237
    (produto_cod,peso_kg,industrializacao_rs_t,frete_rs_t,observacao,autor)
  values (p_produto_cod,p_peso_kg,p_industrializacao_rs_t,p_frete_rs_t,coalesce(p_observacao,''),v_user);
end
$$;

revoke all on function public.fn_compras_producao_parametros_listar_237(text[]) from public, anon;
revoke all on function public.fn_compras_producao_parametros_salvar_237(text,numeric,numeric,numeric,text) from public, anon;
grant execute on function public.fn_compras_producao_parametros_listar_237(text[]) to authenticated;
grant execute on function public.fn_compras_producao_parametros_salvar_237(text,numeric,numeric,numeric,text) to authenticated;
