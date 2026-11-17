-- Fonte: Zacarini 2.2.24!Extratos_Bancos D:J e Fluxo de Caixa!B6.
-- Saldo de abertura do fluxo = SOMA(saldo final oficial de cada conta)
-- na data de corte, não um número digitado no ERP/planilha externa.
-- Sem extrato original e sem todos os saldos conciliados: NÃO disponibilizar.
-- Banco somente; frontend e chave pública não têm acesso a contas/extratos.

create table if not exists painel.zac_contas_bancarias (
  conta_ref text primary key,
  banco text not null,
  filial text,
  ativa boolean not null default true,
  cadastrada_em timestamptz not null default now()
);

create table if not exists painel.zac_extrato_saldos_diarios (
  conta_ref text not null references painel.zac_contas_bancarias(conta_ref),
  data_saldo date not null,
  saldo_final_oficial numeric(20,2) not null,
  saldo_anterior numeric(20,2),
  entradas_periodo numeric(20,2),
  saidas_periodo numeric(20,2),
  transferencias_periodo numeric(20,2),
  arquivo_sha256 text not null check(length(btrim(arquivo_sha256))>0),
  origem text not null check(length(btrim(origem))>0),
  conferido_por text,
  conferido_em timestamptz,
  importado_em timestamptz not null default now(),
  primary key(conta_ref,data_saldo),
  constraint campos_de_conferencia_em_bloco check(
    (saldo_anterior is null and entradas_periodo is null
     and saidas_periodo is null and transferencias_periodo is null)
    or
    (saldo_anterior is not null and entradas_periodo is not null
     and saidas_periodo is not null and transferencias_periodo is not null)
  )
);
create index if not exists ix_zac_extrato_diario_data
  on painel.zac_extrato_saldos_diarios(data_saldo);

alter table painel.zac_contas_bancarias enable row level security;
alter table painel.zac_extrato_saldos_diarios enable row level security;
revoke all on painel.zac_contas_bancarias,painel.zac_extrato_saldos_diarios
  from PUBLIC,anon,authenticated;

-- Extratos_Bancos!H5 = D5+E5+F5+G5
-- Extratos_Bancos!J5 = H5-I5 (deve ser zero à tolerância de centavos).
create or replace view painel.v_zac_extratos_conferencia
with (security_invoker=true,security_barrier=true) as
select e.conta_ref,e.data_saldo,
       e.saldo_anterior,e.entradas_periodo,e.saidas_periodo,
       e.transferencias_periodo,e.saldo_final_oficial,
       case when e.saldo_anterior is not null then
         e.saldo_anterior+e.entradas_periodo+e.saidas_periodo+
         e.transferencias_periodo
       end saldo_final_calculado,
       case when e.saldo_anterior is not null then
         e.saldo_anterior+e.entradas_periodo+e.saidas_periodo+
         e.transferencias_periodo-e.saldo_final_oficial
       end diferenca,
       e.conferido_por,e.conferido_em
from painel.zac_extrato_saldos_diarios e
join painel.zac_contas_bancarias c on c.conta_ref=e.conta_ref
where c.ativa;

-- Só usar a soma para o fluxo após cobrir TODAS as contas ativas,
-- conciliar fluxo e transferências internas (rede: somam zero).
create or replace view painel.v_zac_saldo_caixa_conciliado
with (security_invoker=true,security_barrier=true) as
with quantidade as (
  select count(*)::bigint contas_ativas
  from painel.zac_contas_bancarias where ativa
), resumo as (
 select e.data_saldo,count(*)::bigint contas_informadas,
   sum(e.saldo_final_oficial) saldo_total_bancos,
   coalesce(sum(e.transferencias_periodo),0) transferencia_total_rede,
   count(*) filter(where
      e.saldo_anterior is null or e.conferido_em is null
      or e.conferido_por is null
      or abs(e.saldo_anterior+e.entradas_periodo+e.saidas_periodo+
             e.transferencias_periodo-e.saldo_final_oficial)>0.01
   ) nao_conciliadas
 from painel.zac_extrato_saldos_diarios e
 join painel.zac_contas_bancarias c on c.conta_ref=e.conta_ref
 where c.ativa
 group by e.data_saldo
)
select r.data_saldo,r.saldo_total_bancos
from resumo r cross join quantidade q
where q.contas_ativas>0
  and r.contas_informadas=q.contas_ativas
  and r.nao_conciliadas=0
  and abs(r.transferencia_total_rede)<=0.01;

-- Último saldo APROVADO; não inferir saldo inicial por soma de movimentos
-- sem saldo oficial, e não voltar silenciosamente para data antiga.
create or replace view painel.v_zac_saldo_abertura_fluxo
with (security_invoker=true,security_barrier=true) as
select data_saldo,saldo_total_bancos as saldo_inicial
from painel.v_zac_saldo_caixa_conciliado
where data_saldo=(select max(data_saldo)
 from painel.zac_extrato_saldos_diarios);

revoke all on painel.v_zac_extratos_conferencia,
  painel.v_zac_saldo_caixa_conciliado,
  painel.v_zac_saldo_abertura_fluxo
from PUBLIC,anon,authenticated;
