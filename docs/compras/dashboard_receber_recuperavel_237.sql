-- Equivalência de Receber Vencidos!G13 / Fluxo de Caixa!B25:B38 (Zacarini 2.3.7).
-- A planilha soma o VALOR DO TÍTULO, NÃO o líquido reajustado por décadas de juros.
-- Mantém as sete classes e usa apenas classes 1, 2 e 3 na recuperação semanal.
-- Não toca em dados financeiros, importações nem outros RPCs.
create or replace function public.fn_compras_dashboard_receber_recuperavel_237(p_data_base date)
returns table (
  filial text,
  principal_carteira numeric,
  principal_vencido numeric,
  principal_recuperavel numeric,
  titulos_vencidos bigint,
  titulos_recuperaveis bigint,
  titulos_sem_principal bigint
)
language plpgsql stable security definer
set search_path to ''
set statement_timeout to '5s'
as $function$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles p where p.id=(select auth.uid())
      and p.role='master' and p.ativo
  ) then
    raise exception 'Somente Master ativo' using errcode='42501';
  end if;
  if p_data_base is null or p_data_base < date '2025-01-01' or
     p_data_base > current_date + 1 then
    raise exception 'Data-base inválida' using errcode='22023';
  end if;

  return query
  with carteira as (
    select r.filial, r.vlr_titulo, r.vencto,
      (p_data_base-r.vencto) as atraso,
      -- Categorias!D5:D8: empresas do grupo não representam cobrança comercial.
      (upper(coalesce(r.razao_social,'')) like any(array[
        'A3 COMERCIO DE EMBALAGENS E SERVICOS%',
        'JH COMERCIO E SERVICOS%',
        'RZ MANUTENCAO, COMERCIO E SERVICOS%',
        'PC SERVICOS ADMINISTRATIVO%'
      ])) as grupo,
      (upper(coalesce(r.portador,'')) like '%PERDAS%') as perdas,
      (upper(coalesce(r.portador,'')) like '%KOHL%') as kohl
    from painel.receber r
    where r.filial in ('BDS','CG','RIO','CX','PG','AN')
  ), resumo as (
    select c.filial,
      coalesce(sum(c.vlr_titulo),0) as principal_carteira,
      coalesce(sum(c.vlr_titulo) filter (where c.vencto<p_data_base),0) as principal_vencido,
      coalesce(sum(c.vlr_titulo) filter (where c.vencto<p_data_base
        and not c.grupo and not c.perdas and c.atraso<=1825
        and (c.kohl or c.atraso<=365)),0) as principal_recuperavel,
      count(*) filter (where c.vencto<p_data_base) as titulos_vencidos,
      count(*) filter (where c.vencto<p_data_base
        and not c.grupo and not c.perdas and c.atraso<=1825
        and (c.kohl or c.atraso<=365)) as titulos_recuperaveis,
      count(*) filter (where c.vlr_titulo is null or c.vlr_titulo<0) as titulos_sem_principal
    from carteira c group by c.filial
  )
  select f.filial,coalesce(r.principal_carteira,0),coalesce(r.principal_vencido,0),
    coalesce(r.principal_recuperavel,0),coalesce(r.titulos_vencidos,0),
    coalesce(r.titulos_recuperaveis,0),coalesce(r.titulos_sem_principal,0)
  from (values ('BDS'),('CG'),('RIO'),('CX'),('PG'),('AN')) as f(filial)
  left join resumo r on r.filial=f.filial;
end;
$function$;

revoke all on function public.fn_compras_dashboard_receber_recuperavel_237(date) from public,anon;
grant execute on function public.fn_compras_dashboard_receber_recuperavel_237(date) to authenticated;
