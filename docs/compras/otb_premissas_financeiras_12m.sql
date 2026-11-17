-- PROPOSTA ADITIVA: antes de executar, revisar no projeto Supabase correto.
-- Primeiro bloco de premissas da Projeção 12M (não gera orçamento por si só).
-- Preserva histórico: cada edição grava uma NOVA versão imutável.

create table if not exists public.otb_premissas_financeiras_12m (
  id bigint generated always as identity primary key,
  competencia_inicio date not null
    check (competencia_inicio = date_trunc('month', competencia_inicio)::date),
  saldo_inicial_caixa numeric(18,2) not null
    check (saldo_inicial_caixa between -1000000000000 and 1000000000000),
  colchao_caixa numeric(18,2) not null
    check (colchao_caixa between 0 and 1000000000000),
  observacao text not null default '' check (length(observacao) <= 500),
  criado_em timestamptz not null default now(),
  criado_por uuid not null references auth.users(id)
);

create index if not exists otb_premissas_12m_competencia_idx
  on public.otb_premissas_financeiras_12m(competencia_inicio, id desc);

alter table public.otb_premissas_financeiras_12m enable row level security;
-- Sem policies de usuário. Apenas RPCs autenticadas com guarda Master leem e gravam.
revoke all on public.otb_premissas_financeiras_12m from public, anon, authenticated;
revoke all on sequence public.otb_premissas_financeiras_12m_id_seq from public, anon, authenticated;

create or replace function public.fn_otb_premissas_listar(p_inicio date)
returns table (
  id bigint, competencia_inicio date, saldo_inicial_caixa numeric,
  colchao_caixa numeric, observacao text, criado_em timestamptz, criado_por uuid
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

  if p_inicio is null or p_inicio <> date_trunc('month', p_inicio)::date then
    raise exception 'Competência inicial inválida' using errcode = '22023';
  end if;

  return query
  select p.id, p.competencia_inicio, p.saldo_inicial_caixa,
         p.colchao_caixa, p.observacao, p.criado_em, p.criado_por
  from public.otb_premissas_financeiras_12m p
  where p.competencia_inicio = p_inicio
  order by p.id desc limit 30;
end;
$fn$;

create or replace function public.fn_otb_premissas_salvar(
  p_inicio date, p_saldo numeric, p_colchao numeric, p_observacao text
)
returns bigint
language plpgsql volatile security definer set search_path = ''
as $fn$
declare
  v_id bigint;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles pr
    where pr.id = (select auth.uid()) and pr.role = 'master' and pr.ativo = true
  ) then
    raise exception 'Acesso restrito ao Master ativo' using errcode = '42501';
  end if;

  if p_inicio is null or p_inicio <> date_trunc('month', p_inicio)::date
     or p_saldo is null or abs(p_saldo) > 1000000000000
     or p_colchao is null or p_colchao < 0 or p_colchao > 1000000000000
     or p_observacao is null or length(p_observacao) > 500 then
    raise exception 'Premissas financeiras ausentes ou inválidas' using errcode = '22023';
  end if;

  insert into public.otb_premissas_financeiras_12m (
    competencia_inicio, saldo_inicial_caixa, colchao_caixa, observacao, criado_por
  ) values (
    p_inicio, round(p_saldo, 2), round(p_colchao, 2), trim(p_observacao), (select auth.uid())
  ) returning id into v_id;

  return v_id;
end;
$fn$;

revoke all on function public.fn_otb_premissas_listar(date) from public, anon, authenticated;
revoke all on function public.fn_otb_premissas_salvar(date, numeric, numeric, text) from public, anon, authenticated;
grant execute on function public.fn_otb_premissas_listar(date) to authenticated;
grant execute on function public.fn_otb_premissas_salvar(date, numeric, numeric, text) to authenticated;
