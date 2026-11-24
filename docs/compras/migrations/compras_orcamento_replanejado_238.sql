
-- Estrutura normalizada de Orc_Dados!tbOrc. A planilha é referência de regra,
-- NÃO fonte de valores em produção. Valores cadastrados pelo Master não aprovam caixa.
create table if not exists public.compras_orcamento_replanejado_238 (
 id bigint generated always as identity primary key,
 competencia date not null,
 grupo text not null,
 item text not null,
 tipo text not null default 'Replanejado',
 valor numeric(18,2) not null,
 origem text not null default 'manual_sem_homologacao',
 registrado_por uuid not null,
 registrado_em timestamptz not null default now(),
 atualizado_em timestamptz not null default now(),
 constraint ck_compras_orcamento_238_mes check (extract(day from competencia)=1),
 constraint ck_compras_orcamento_238_grupo check (grupo in ('Logística','Marketing','Pessoal','Administrativo','Industrial','Investimento')),
 constraint ck_compras_orcamento_238_tipo check (tipo='Replanejado'),
 constraint ck_compras_orcamento_238_item check (length(item) between 1 and 150 and item=btrim(item)),
 constraint ck_compras_orcamento_238_valor check (valor between -100000000000 and 100000000000),
 constraint uq_compras_orcamento_238 unique (competencia,grupo,item,tipo)
);
create index if not exists idx_compras_orcamento_238_comp on public.compras_orcamento_replanejado_238(competencia,grupo);
alter table public.compras_orcamento_replanejado_238 enable row level security;
revoke all on table public.compras_orcamento_replanejado_238 from public,anon,authenticated;

create table if not exists public.compras_orcamento_replanejado_auditoria_238 (
 id bigint generated always as identity primary key,
 orcamento_id bigint not null references public.compras_orcamento_replanejado_238(id),
 valor_anterior numeric(18,2),
 valor_novo numeric(18,2) not null,
 alterado_por uuid not null,
 alterado_em timestamptz not null default now()
);
alter table public.compras_orcamento_replanejado_auditoria_238 enable row level security;
revoke all on table public.compras_orcamento_replanejado_auditoria_238 from public,anon,authenticated;

create or replace function public.fn_compras_orcamento_replanejado_238(p_competencia date)
returns jsonb
language plpgsql stable security definer set search_path='' set statement_timeout='4s'
as $body$
declare payload jsonb;
begin
 if (select auth.uid()) is null or not exists (
  select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='master' and p.ativo
 ) then raise exception 'Master ativo obrigatório' using errcode='42501'; end if;
 if p_competencia is null or extract(day from p_competencia)<>1
   or extract(year from p_competencia) not between 2020 and 2100 then
   raise exception 'Competência mensal inválida' using errcode='22023';
 end if;
 with grupos as (
  select unnest(array['Logística','Marketing','Pessoal','Administrativo','Industrial','Investimento']::text[]) grupo
 ), calculados as (
  select g.grupo,
   count(r.id)::int qtd_itens,
   case when count(r.id)>0 then abs(sum(r.valor)) else null end orcamento,
   case when count(r.id)>0 then sum(r.valor) else null end saldo_assinado
  from grupos g
  left join public.compras_orcamento_replanejado_238 r
    on r.competencia=p_competencia and r.grupo=g.grupo and r.tipo='Replanejado'
  group by g.grupo
 )
 select jsonb_build_object(
  'source','ORC_DADOS_REPLANEJADO_238',
  'competencia',p_competencia,
  'status','manual_sem_homologacao',
  'authorizesPurchases',false,
  'grupos',coalesce((select jsonb_agg(to_jsonb(c) order by c.grupo) from calculados c),'[]'::jsonb),
  'itens',coalesce((select jsonb_agg(jsonb_build_object(
    'id',i.id,'grupo',i.grupo,'item',i.item,'valor',i.valor,
    'atualizado_em',i.atualizado_em
  ) order by i.grupo,i.item)
  from public.compras_orcamento_replanejado_238 i
  where i.competencia=p_competencia and i.tipo='Replanejado'),'[]'::jsonb)
 ) into payload;
 return payload;
end;
$body$;

create or replace function public.fn_compras_orcamento_replanejado_salvar_238(
 p_competencia date,p_grupo text,p_item text,p_valor numeric
)
returns bigint
language plpgsql security definer
set search_path='' set statement_timeout='4s' set lock_timeout='2s'
as $body$
declare v_usuario uuid:=(select auth.uid()); v_id bigint;v_old numeric(18,2);
begin
 if v_usuario is null or not exists (
  select 1 from public.profiles p where p.id=v_usuario and p.role='master' and p.ativo
 ) then raise exception 'Master ativo obrigatório' using errcode='42501'; end if;
 if p_competencia is null or extract(day from p_competencia)<>1
   or extract(year from p_competencia) not between 2020 and 2100
   or p_grupo is null or p_grupo not in ('Logística','Marketing','Pessoal','Administrativo','Industrial','Investimento')
   or p_item is null or btrim(p_item)<>p_item or length(p_item) not between 1 and 150
   or p_valor is null or p_valor::text in ('NaN','Infinity','-Infinity')
   or p_valor not between -100000000000 and 100000000000
   or p_valor<>round(p_valor,2)
 then raise exception 'Dados do orçamento inválidos' using errcode='22023'; end if;
 -- Serializa edições do mesmo identificador lógico durante a transação.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_competencia::text||'|'||p_grupo||'|'||p_item));
 select r.id,r.valor into v_id,v_old
 from public.compras_orcamento_replanejado_238 r
 where r.competencia=p_competencia and r.grupo=p_grupo and r.item=p_item and r.tipo='Replanejado'
 for update;
 if v_id is null then
  insert into public.compras_orcamento_replanejado_238
   (competencia,grupo,item,tipo,valor,registrado_por)
  values (p_competencia,p_grupo,p_item,'Replanejado',p_valor,v_usuario)
  returning id into v_id;
 else
  update public.compras_orcamento_replanejado_238 r
  set valor=p_valor,atualizado_em=now(),registrado_por=v_usuario
  where r.id=v_id;
 end if;
 insert into public.compras_orcamento_replanejado_auditoria_238
 (orcamento_id,valor_anterior,valor_novo,alterado_por)
 values(v_id,v_old,p_valor,v_usuario);
 return v_id;
end;
$body$;

revoke all on function public.fn_compras_orcamento_replanejado_238(date) from public,anon;
grant execute on function public.fn_compras_orcamento_replanejado_238(date) to authenticated;
revoke all on function public.fn_compras_orcamento_replanejado_salvar_238(date,text,text,numeric) from public,anon;
grant execute on function public.fn_compras_orcamento_replanejado_salvar_238(date,text,text,numeric) to authenticated;

comment on function public.fn_compras_orcamento_replanejado_238(date)
is 'Atendimento Fornecedor!I51:I58 / Orc_Dados!tbOrc Zacarini 2.3.8: ABS(SUM(valor)) por ano, mês, Grupo e Tipo Replanejado. Ausência é NULL, não zero.';
comment on table public.compras_orcamento_replanejado_238
is 'Entradas preparatórias mensais do Orc_Dados; não importam valores da planilha e não autorizam compras.';
