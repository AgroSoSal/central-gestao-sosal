-- Fonte 2.3.7: fx_VendaSubgrupo!C:E/G e OTB!AY:BP.
-- Extrato somente leitura de painel.mv_venda_mes_subgrupo (sem REFRESH e sem DML).
-- Não calcula OTB!D: a venda prevista por SKU precisa ser homologada separadamente.
-- A exposição é EXCLUSIVA para sessão autenticada com profiles.role='master' ativo.

create or replace function public.fn_otb_venda_sazonal_237(p_mes_otb date)
returns table (
  linha integer,
  grupo_subgrupo text,
  venda_janela_1 numeric,
  venda_janela_2 numeric,
  venda_janela_3 numeric,
  venda_janela_4 numeric,
  meses_linha integer
)
language plpgsql stable security definer
set search_path to ''
set statement_timeout to '8s'
as $function$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles pr
    where pr.id = (select auth.uid())
      and pr.role = 'master' and pr.ativo
  ) then
    raise exception 'Acesso restrito ao Master ativo' using errcode='42501';
  end if;

  if p_mes_otb is null
    or p_mes_otb <> date_trunc('month',p_mes_otb)::date
    or p_mes_otb < date '2022-01-01'
    or p_mes_otb > (date_trunc('month',now()) + interval '24 months')::date
  then
    raise exception 'Competência OTB inválida' using errcode='22023';
  end if;

  return query
  with base as (
    select v.linha, v.grupo_subgrupo, v.mes_calendario, sum(v.vda_bruta) as venda
    from painel.mv_venda_mes_subgrupo v
    where v.visao = 'saida'
      and v.mes_calendario >= (p_mes_otb - interval '12 months')::date
      and v.mes_calendario < (p_mes_otb - interval '6 months')::date
      and v.linha between 1 and 4
      and v.grupo_subgrupo is not null and btrim(v.grupo_subgrupo) <> ''
    group by v.linha, v.grupo_subgrupo, v.mes_calendario
  ), cobertura as (
    select b.linha, count(distinct b.mes_calendario)::integer as meses
    from base b group by b.linha
  )
  select b.linha, b.grupo_subgrupo,
    coalesce(sum(b.venda) filter (where b.mes_calendario >= (p_mes_otb - interval '12 months')::date
                                and b.mes_calendario < (p_mes_otb - interval '9 months')::date), 0),
    coalesce(sum(b.venda) filter (where b.mes_calendario >= (p_mes_otb - interval '11 months')::date
                                and b.mes_calendario < (p_mes_otb - interval '8 months')::date), 0),
    coalesce(sum(b.venda) filter (where b.mes_calendario >= (p_mes_otb - interval '10 months')::date
                                and b.mes_calendario < (p_mes_otb - interval '7 months')::date), 0),
    coalesce(sum(b.venda) filter (where b.mes_calendario >= (p_mes_otb - interval '9 months')::date
                                and b.mes_calendario < (p_mes_otb - interval '6 months')::date), 0),
    c.meses
  from base b join cobertura c on c.linha=b.linha
  group by b.linha,b.grupo_subgrupo,c.meses
  order by b.linha,b.grupo_subgrupo;
end;
$function$;

revoke all on function public.fn_otb_venda_sazonal_237(date) from public, anon;
grant execute on function public.fn_otb_venda_sazonal_237(date) to authenticated;
