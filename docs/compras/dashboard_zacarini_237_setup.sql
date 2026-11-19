-- Dashboard Zacarini 2.3.7: importacao inicial desacoplada do XLSX.
-- Executar uma vez no Supabase. ON CONFLICT DO NOTHING protege ajustes posteriores.
-- O historico de vendas e os saldos NAO sao importados da planilha.
create table if not exists public.compras_dashboard_config_237 (
  codigo text not null,
  grupo text not null,
  dimensao text,
  competencia date,
  rotulo text not null,
  valor numeric,
  texto text,
  unidade text not null,
  origem_aba text not null,
  origem_celula text not null,
  versao text not null default '2.3.7',
  situacao text not null default 'referencia' check (situacao in ('referencia', 'homologado')),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id),
  constraint dashboard_codigo_nonempty check (length(btrim(codigo)) > 0),
  constraint dashboard_origem_nonempty check (length(btrim(origem_aba)) > 0 and length(btrim(origem_celula)) > 0)
);
create unique index if not exists compras_dashboard_config_237_identidade
  on public.compras_dashboard_config_237 (codigo, competencia) nulls not distinct;
create table if not exists public.compras_dashboard_config_auditoria_237 (
  id bigint generated always as identity primary key,
  codigo text not null,
  competencia date,
  valor_anterior numeric,
  valor_novo numeric,
  alterado_por uuid not null references auth.users(id),
  alterado_em timestamptz not null default now()
);
alter table public.compras_dashboard_config_237 enable row level security;
alter table public.compras_dashboard_config_auditoria_237 enable row level security;
revoke all on public.compras_dashboard_config_237 from public, anon, authenticated;
revoke all on public.compras_dashboard_config_auditoria_237 from public, anon, authenticated;

insert into public.compras_dashboard_config_237
 (codigo, grupo, dimensao, competencia, rotulo, valor, texto, unidade, origem_aba, origem_celula)
values
 ('meta_linha_1','metas_linha','Nutrição','2026-11-01','Meta Nutrição (nov/26)',2840000,'Thiago e Filipe','BRL','Dashboard','D36'),
 ('meta_linha_2','metas_linha','Saúde','2026-11-01','Meta Saúde (nov/26)',2850000,'Margotti','BRL','Dashboard','D37'),
 ('meta_linha_3','metas_linha','Outros','2026-11-01','Meta Outros (nov/26)',1761000,'Thiago e Filipe','BRL','Dashboard','D38'),
 ('meta_linha_4','metas_linha','Pastagem','2026-11-01','Meta Pastagem (nov/26)',2699589,'Claudiney','BRL','Dashboard','D39'),
 ('meta_loja_AN','metas_loja','AN','2026-11-01','Meta Anastácio (nov/26)',1019413,'Elias','BRL','Dashboard','D44'),
 ('meta_loja_BDS','metas_loja','BDS','2026-11-01','Meta Bandeirantes (nov/26)',1402352,'Carlos','BRL','Dashboard','D45'),
 ('meta_loja_CG','metas_loja','CG','2026-11-01','Meta Campo Grande (nov/26)',3299000,'Ramos','BRL','Dashboard','D46'),
 ('meta_loja_CX','metas_loja','CX','2026-11-01','Meta Coxim (nov/26)',1700353,'Edson','BRL','Dashboard','D47'),
 ('meta_loja_PG','metas_loja','PG','2026-11-01','Meta Pedro Gomes (nov/26)',1023235,'Vagner','BRL','Dashboard','D48'),
 ('meta_loja_RIO','metas_loja','RIO','2026-11-01','Meta Rio Verde (nov/26)',1706236,'Lennon','BRL','Dashboard','D49'),
 ('minimo_caixa','caixa',null,null,'Piso de segurança do caixa',500000,null,'BRL','Fluxo de Caixa','B7'),
 ('fator_vendas_previstas','caixa',null,null,'Fator de vendas previstas',0.90,null,'razao','Fluxo de Caixa','B8'),
 ('vendas_a_vista','caixa',null,null,'Proporção de vendas à vista',0.15,null,'razao','Fluxo de Caixa','B9'),
 ('recuperacao_vencidos_semana','caixa',null,null,'Recuperação semanal de vencidos',0.015,null,'razao','Fluxo de Caixa','B11'),
 ('fator_materia_prima','caixa',null,null,'Fator de matéria-prima',1.3,null,'razao','Fluxo de Caixa','B21'),
 ('prazo_materia_prima','caixa',null,null,'Prazo de matéria-prima',51,null,'dias','Fluxo de Caixa','B22'),
 ('dde_alvo_rede','estoque',null,null,'DDE-alvo da rede',60,null,'dias','Projeção 12M','B8'),
 ('dde_alvo_linha_1','estoque','Nutrição',null,'DDE-alvo Nutrição',45,null,'dias','OTB','H6'),
 ('dde_alvo_linha_2','estoque','Saúde',null,'DDE-alvo Saúde',60,null,'dias','OTB','H7'),
 ('dde_alvo_linha_3','estoque','Outros',null,'DDE-alvo Outros',60,null,'dias','OTB','H8'),
 ('dde_alvo_linha_4','estoque','Pastagem',null,'DDE-alvo Pastagem',50,null,'dias','OTB','H9'),
 ('limite_dde_loja','limites',null,null,'Teto de DDE por loja',120,null,'dias','Dashboard','B51'),
 ('limite_vencido_loja','limites',null,null,'Limite de carteira vencida',0.10,null,'razao','Dashboard','B51'),
 ('limite_vendas_loja','limites',null,null,'Piso de cumprimento de meta',0.90,null,'razao','Dashboard','B51')
on conflict (codigo, competencia) do nothing;

create or replace function public.fn_compras_dashboard_config_237()
returns table (codigo text, grupo text, dimensao text, competencia date, rotulo text,
 valor numeric, unidade text, origem_aba text, origem_celula text, versao text,
 situacao text, texto text, atualizado_em timestamptz)
language plpgsql stable security definer set search_path to '' set statement_timeout to '5s'
as $function$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='master' and p.ativo
  ) then
    raise exception 'Acesso restrito ao Master ativo' using errcode='42501';
  end if;
  return query
    select c.codigo,c.grupo,c.dimensao,c.competencia,c.rotulo,c.valor,c.unidade,
      c.origem_aba,c.origem_celula,c.versao,c.situacao,c.texto,c.atualizado_em
    from public.compras_dashboard_config_237 c order by c.grupo,c.codigo,c.competencia;
end;
$function$;

-- Agrega apenas a tabela materializada alimentada pelo SISCOM/Supabase.
-- Retornos negativos ja sao assinados pela origem: nao subtrair duas vezes.
create or replace function public.fn_compras_dashboard_vendas_237(p_competencia date)
returns table (filial text, loja text, linha integer, visao text, vendido_mes numeric,
 bruto_mes numeric, custo_mes numeric, lucro_mes numeric, vendido_ano numeric)
language plpgsql stable security definer set search_path to '' set statement_timeout to '8s'
as $function$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='master' and p.ativo
  ) then
    raise exception 'Acesso restrito ao Master ativo' using errcode='42501';
  end if;
  if p_competencia is null or extract(day from p_competencia)<>1 or
     p_competencia < date '2020-01-01' or p_competencia > date '2035-12-01' then
    raise exception 'Competencia invalida' using errcode='22023';
  end if;
  return query
    select v.filial::text, max(v.loja)::text, v.linha, v.visao::text,
       coalesce(sum(v.vda_bruta) filter (where v.mes_comercial=p_competencia),0)::numeric,
       coalesce(sum(v.vda_bruta) filter (where v.mes_comercial=p_competencia),0)::numeric,
       coalesce(sum(v.custo_liquido) filter (where v.mes_comercial=p_competencia),0)::numeric,
       coalesce(sum(v.lucro_liquido) filter (where v.mes_comercial=p_competencia),0)::numeric,
       coalesce(sum(v.vda_bruta),0)::numeric
    from painel.mv_venda_dia_linha v
    where v.mes_comercial >= date_trunc('year',p_competencia)::date
      and v.mes_comercial <= p_competencia
      and v.visao in ('vendido','saida')
    group by v.filial,v.linha,v.visao
    order by v.filial,v.linha,v.visao;
end;
$function$;

-- Ajustes registrados, sem homologacao automatica. A versao da origem nunca e apagada.
create or replace function public.fn_compras_dashboard_ajustar_237(
  p_codigo text, p_competencia date, p_valor numeric)
returns void language plpgsql security definer set search_path to '' set statement_timeout to '5s'
as $function$
declare anterior numeric;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='master' and p.ativo
  ) then
    raise exception 'Acesso restrito ao Master ativo' using errcode='42501';
  end if;
  if p_valor is null or abs(p_valor)>10000000000 or length(p_codigo)>80 then
    raise exception 'Valor invalido' using errcode='22023';
  end if;
  select c.valor into anterior from public.compras_dashboard_config_237 c
    where c.codigo=p_codigo and c.competencia is not distinct from p_competencia for update;
  if not found then raise exception 'Premissa inexistente' using errcode='22023'; end if;
  update public.compras_dashboard_config_237 c
    set valor=p_valor, situacao='referencia', atualizado_em=now(),atualizado_por=(select auth.uid())
    where c.codigo=p_codigo and c.competencia is not distinct from p_competencia;
  insert into public.compras_dashboard_config_auditoria_237
    (codigo,competencia,valor_anterior,valor_novo,alterado_por)
    values (p_codigo,p_competencia,anterior,p_valor,(select auth.uid()));
end;
$function$;

-- Posicao observada por filial, sem valores projetados nem DDE de meta.
create or replace function public.fn_compras_dashboard_posicao_237()
returns table (filial text, estoque_custo numeric, cmv_90d numeric,
  dde_observado numeric, carteira_aberta numeric, carteira_vencida numeric,
  percentual_vencido numeric)
language plpgsql stable security definer set search_path to '' set statement_timeout to '8s'
as $function$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='master' and p.ativo
  ) then
    raise exception 'Acesso restrito ao Master ativo' using errcode='42501';
  end if;
  return query
  with estoque as (
    select e.filial, sum(e.valor)::numeric as valor
    from painel.estoque e group by e.filial
  ), cmv as (
    select case a.loja when 'Anastácio' then 'AN' when 'Bandeirantes' then 'BDS'
        when 'Campo Grande' then 'CG' when 'Coxim' then 'CX'
        when 'Pedro Gomes' then 'PG' when 'Rio Verde' then 'RIO' end as filial,
      sum(a.custo_90d)::numeric as valor
    from painel.mv_abc_janelas a group by a.loja
  ), carteira as (
    select r.filial, sum(r.vlr_liquido)::numeric as total,
      sum(r.vlr_liquido) filter(where r.vencto<current_date)::numeric as vencido
    from painel.receber r group by r.filial
  )
  select e.filial,e.valor,c.valor,
    case when c.valor>0 then e.valor*90/c.valor end,
    r.total,r.vencido,
    case when r.total>0 then coalesce(r.vencido,0)/r.total end
  from estoque e left join cmv c on c.filial=e.filial
    left join carteira r on r.filial=e.filial
  order by e.filial;
end;
$function$;

revoke all on function public.fn_compras_dashboard_config_237() from public,anon;
revoke all on function public.fn_compras_dashboard_vendas_237(date) from public,anon;
revoke all on function public.fn_compras_dashboard_ajustar_237(text,date,numeric) from public,anon;
revoke all on function public.fn_compras_dashboard_posicao_237() from public,anon;
grant execute on function public.fn_compras_dashboard_config_237() to authenticated;
grant execute on function public.fn_compras_dashboard_vendas_237(date) to authenticated;
grant execute on function public.fn_compras_dashboard_ajustar_237(text,date,numeric) to authenticated;
grant execute on function public.fn_compras_dashboard_posicao_237() to authenticated;
