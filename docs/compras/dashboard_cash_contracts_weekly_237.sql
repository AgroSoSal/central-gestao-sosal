-- Série semanal informativa: títulos identificados nas mesmas fontes da
-- fn_otb_agenda_contratada_12m_237. NÃO é orçamento ou saldo autorizado.
-- Não modifica dados importados; não executa REFRESH e limita consultas por data.
create or replace function public.fn_compras_dashboard_agenda_26s_237(p_inicio date)
returns table (
  inicio date, fim date, receber_identificado numeric, pagar_identificado numeric,
  titulos_receber bigint, titulos_pagar bigint, ultima_importacao_pagar timestamptz
)
language plpgsql stable security definer set search_path to '' set statement_timeout to '6s'
as $function$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles p where p.id = (select auth.uid())
       and p.role = 'master' and p.ativo
  ) then
    raise exception 'Somente Master ativo' using errcode = '42501';
  end if;
  if p_inicio is null or p_inicio < date '2025-01-01' or p_inicio > date '2035-01-01'
     or p_inicio > current_date + 1 then
    raise exception 'Data inicial inválida' using errcode = '22023';
  end if;
  return query
  with semanas as (
    select (p_inicio + g.n * 7)::date as inicio,
           (p_inicio + g.n * 7 + 6)::date as fim
    from generate_series(0, 25) as g(n)
  ), a_receber as (
    select (p_inicio + ((r.vencto - p_inicio) / 7) * 7)::date as semana,
      sum(r.vlr_liquido) as total, count(*) as titulos
    from painel.receber r
    where r.vencto >= p_inicio and r.vencto < p_inicio + 182
      and r.vlr_liquido is not null
    group by 1
  ), ultima_carga as (
    select t.importacao_id, max(t.importado_em) as importado_em
    from painel.alex_rpa_titulos_abertos t
    where t.relatorio = 'fornecedores_a_pagar'
    group by t.importacao_id
    order by max(t.importado_em) desc, t.importacao_id desc
    limit 1
  ), a_pagar as (
    select (p_inicio + ((t.vencimento - p_inicio) / 7) * 7)::date as semana,
      sum(t.valor_liquido) as total, count(*) as titulos
    from painel.alex_rpa_titulos_abertos t
    join ultima_carga uc on uc.importacao_id = t.importacao_id
    where t.relatorio = 'fornecedores_a_pagar'
      and t.vencimento >= p_inicio and t.vencimento < p_inicio + 182
      and t.valor_liquido is not null
    group by 1
  )
  select s.inicio, s.fim,
    coalesce(r.total, 0)::numeric, coalesce(p.total, 0)::numeric,
    coalesce(r.titulos, 0)::bigint, coalesce(p.titulos, 0)::bigint,
    uc.importado_em
  from semanas s
  cross join (select max(x.importado_em) as importado_em from ultima_carga x) uc
  left join a_receber r on r.semana = s.inicio
  left join a_pagar p on p.semana = s.inicio
  order by s.inicio;
end;
$function$;

revoke all on function public.fn_compras_dashboard_agenda_26s_237(date) from public, anon;
grant execute on function public.fn_compras_dashboard_agenda_26s_237(date) to authenticated;
