-- OTB 2.3.7: posição bancária e agenda contratada preparatórias, somente leitura.
-- Não muda cargas RPA, conciliações oficiais, dados de caixa ou orçamento.
-- Master ativo em ambas as RPCs. Sem valores de compra autorizados.

create or replace function public.fn_otb_extratos_posicao_237(p_corte date default null)
returns table (
  conta_ref text, filial text, banco text, data_corte_comum date,
  data_ultimo_saldo date, ultimo_saldo numeric,
  data_saldo_base date, saldo_base numeric,
  data_arquivo date, diferenca_arquivo numeric,
  conciliado boolean
)
language plpgsql stable security definer
set search_path to ''
set statement_timeout to '5s'
as $$
declare v_corte date := coalesce(p_corte,current_date);
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles p where p.id=(select auth.uid())
      and p.role='master' and p.ativo
  ) then raise exception 'Somente Master ativo' using errcode='42501'; end if;
  if v_corte > current_date or v_corte < date '2020-01-01' then
    raise exception 'Data de corte inválida' using errcode='22023';
  end if;
  return query
  with ultimos as (
    select a.conta_ref, a.filial, a.banco,
           s.data_saldo, s.saldo_final_oficial
    from painel.alex_contas_bancarias a
    left join lateral (
      select b.data_saldo, b.saldo_final_oficial
      from painel.alex_extratos_saldos b
      where b.conta_ref=a.conta_ref and b.data_saldo<=v_corte
      order by b.data_saldo desc limit 1
    ) s on true
    where a.ativa
  ), corte as (
    select min(u.data_saldo) data_base from ultimos u
  )
  select u.conta_ref, u.filial, u.banco, c.data_base,
         u.data_saldo, u.saldo_final_oficial,
         b.data_saldo, b.saldo_final_oficial,
         i.data_fim,
         case when i.saldo_final is not null and si.saldo_final_oficial is not null
           then i.saldo_final-si.saldo_final_oficial else null end,
         coalesce(b.conciliado_em is not null,false)
  from ultimos u cross join corte c
  left join lateral (
    select s.data_saldo,s.saldo_final_oficial,s.conciliado_em
    from painel.alex_extratos_saldos s
    where s.conta_ref=u.conta_ref and s.data_saldo<=c.data_base
    order by s.data_saldo desc limit 1
  ) b on true
  left join lateral (
    select x.data_fim,x.saldo_final
    from painel.alex_extratos_importacoes x
    where x.conta_ref=u.conta_ref and x.data_fim<=v_corte
    order by x.data_fim desc,x.registrado_em desc limit 1
  ) i on true
  left join painel.alex_extratos_saldos si
    on si.conta_ref=u.conta_ref and si.data_saldo=i.data_fim
  order by u.filial, u.conta_ref;
end
$$;

-- `painel.receber` é o cadastro operacional de recebíveis, também usado em
-- sbReceber da planilha; os pagamentos vêm do pacote RPA mais recente.
-- A última extração de fornecedores pode ser D-15; portanto NUNCA rotular
-- esta agenda como CAP completo, caixa projetado ou teto oficial da OTB.
create or replace function public.fn_otb_agenda_contratada_12m_237(p_inicio date default null)
returns table (
  mes date, receber_identificado numeric, pagar_identificado numeric,
  titulos_receber bigint, titulos_pagar bigint,
  saldo_contratado_identificado numeric, ultima_importacao_pagar timestamptz
)
language plpgsql stable security definer
set search_path to ''
set statement_timeout to '6s'
as $$
declare v_inicio date := date_trunc('month',coalesce(p_inicio,current_date))::date;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles p where p.id=(select auth.uid())
      and p.role='master' and p.ativo
  ) then raise exception 'Somente Master ativo' using errcode='42501'; end if;
  if v_inicio < date '2025-01-01' or v_inicio > date '2035-01-01' then
    raise exception 'Competência inválida' using errcode='22023';
  end if;
  return query
  with meses as (
    select (v_inicio+(g.n*interval '1 month'))::date mes
    from generate_series(0,11) as g(n)
  ), recebimentos as (
    select date_trunc('month',r.vencto)::date mes,
           sum(r.vlr_liquido) total,count(*) qtd
    from painel.receber r
    where r.vencto>=greatest(v_inicio,current_date)
      and r.vencto<(v_inicio+interval '12 months')
      and r.vlr_liquido is not null
    group by 1
  ), ultima_carga as (
    select a.importacao_id,max(a.importado_em) importado_em
    from painel.alex_rpa_titulos_abertos a
    where a.relatorio='fornecedores_a_pagar'
    group by a.importacao_id
    order by max(a.importado_em) desc,a.importacao_id desc
    limit 1
  ), pagamentos as (
    select date_trunc('month',a.vencimento)::date mes,
           sum(a.valor_liquido) total,count(*) qtd
    from painel.alex_rpa_titulos_abertos a
    join ultima_carga u on u.importacao_id=a.importacao_id
    where a.relatorio='fornecedores_a_pagar'
      and a.vencimento>=greatest(v_inicio,current_date)
      and a.vencimento<(v_inicio+interval '12 months')
      and a.valor_liquido is not null
    group by 1
  )
  select m.mes,coalesce(r.total,0),coalesce(p.total,0),
         coalesce(r.qtd,0),coalesce(p.qtd,0),
         coalesce(r.total,0)-coalesce(p.total,0),u.importado_em
  from meses m
  cross join (select max(x.importado_em) importado_em from ultima_carga x) u
  left join recebimentos r on r.mes=m.mes
  left join pagamentos p on p.mes=m.mes
  order by m.mes;
end
$$;

revoke all on function public.fn_otb_extratos_posicao_237(date) from public,anon;
revoke all on function public.fn_otb_agenda_contratada_12m_237(date) from public,anon;
grant execute on function public.fn_otb_extratos_posicao_237(date) to authenticated;
grant execute on function public.fn_otb_agenda_contratada_12m_237(date) to authenticated;
