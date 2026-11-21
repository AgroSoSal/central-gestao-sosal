-- MIGRAÇÃO ADITIVA — AUTORIZADA PELO RESPONSÁVEL EM 21/11/2026.
-- Nenhuma alteração nas fontes painel.*, SISCOM, RPA, NFs ou pedidos.
-- Chave de negócio compartilhada por Masters: competência + filial + tipo + dimensão.

create table if not exists public.compras_siscom_insumos_pendentes (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references auth.users(id), -- Master responsável pela última gravação
  competencia date not null check (competencia = date_trunc('month', competencia)::date),
  filial text not null check (filial in ('REDE', 'BDS', 'CG', 'RIO', 'CX', 'PG', 'AN')),
  tipo text not null check (tipo in (
    'custo_diario_previsto', 'primeira_data_liberada', 'limite_caixa_acumulado',
    'saldo_verba_linha', 'saldo_inicial_caixa', 'recebimento_previsto',
    'pagamento_previsto', 'estoque_quantidade', 'vendas_90_dias',
    'pedido_pendente', 'ultimo_custo', 'peso_produto', 'industrializacao_tonelada', 'frete_tonelada'
  )),
  linha smallint check (linha between 1 and 4),
  produto_codigo text check (length(produto_codigo) between 1 and 40),
  data_referencia date,
  valor numeric(18,3), -- kg admite três casas; os tipos monetários são limitados a duas pela interface
  observacao text not null default '' check (length(observacao) <= 500),
  situacao text not null default 'pendente_integracao'
    check (situacao in ('pendente_integracao', 'aguardando_conferencia')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint compras_siscom_dimensoes_check check (
    (tipo = 'primeira_data_liberada' and data_referencia is not null and valor is null
      and linha is null and produto_codigo is null)
    or (tipo in ('limite_caixa_acumulado', 'recebimento_previsto', 'pagamento_previsto')
      and data_referencia is not null and valor is not null and linha is null and produto_codigo is null)
    or (tipo = 'saldo_verba_linha' and linha is not null and valor is not null
      and produto_codigo is null and data_referencia is null)
    or (tipo in ('estoque_quantidade', 'vendas_90_dias', 'pedido_pendente',
                 'ultimo_custo', 'peso_produto', 'industrializacao_tonelada', 'frete_tonelada')
      and produto_codigo is not null and valor is not null and linha is null and data_referencia is null)
    or (tipo in ('custo_diario_previsto', 'saldo_inicial_caixa')
      and valor is not null and linha is null and produto_codigo is null and data_referencia is null)
  ),
  constraint compras_siscom_valor_check check (
    valor is null or (
      valor between -1000000000000 and 1000000000000
      and (valor >= 0 or tipo in ('saldo_verba_linha', 'saldo_inicial_caixa'))
      and (tipo <> 'custo_diario_previsto' or valor > 0)
    )
  )
);

-- Requer PostgreSQL 15+; evita duplicidade inclusive com dimensões NULL.
create unique index if not exists compras_siscom_insumos_business_key
  on public.compras_siscom_insumos_pendentes
  (competencia, filial, tipo, linha, produto_codigo, data_referencia)
  nulls not distinct;

create index if not exists compras_siscom_insumos_competencia_idx
  on public.compras_siscom_insumos_pendentes (competencia, filial, tipo);

alter table public.compras_siscom_insumos_pendentes enable row level security;
revoke all on public.compras_siscom_insumos_pendentes from public, anon, authenticated;
revoke all on sequence public.compras_siscom_insumos_pendentes_id_seq from public, anon, authenticated;

-- Profile 'master' ativo, sempre verificado contra auth.uid() do JWT assinado;
-- usuário anônimo ou com perfil inativo não obtém nenhuma linha.
create policy compras_siscom_insumos_master_select
  on public.compras_siscom_insumos_pendentes for select to authenticated
  using (
    (select auth.uid()) is not null and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'master' and p.ativo = true
    )
  );

create policy compras_siscom_insumos_master_insert
  on public.compras_siscom_insumos_pendentes for insert to authenticated
  with check (
    usuario_id = (select auth.uid()) and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'master' and p.ativo = true
    )
  );

create policy compras_siscom_insumos_master_update
  on public.compras_siscom_insumos_pendentes for update to authenticated
  using (
    (select auth.uid()) is not null and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'master' and p.ativo = true
    )
  )
  with check (
    usuario_id = (select auth.uid()) and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'master' and p.ativo = true
    )
  );

create policy compras_siscom_insumos_master_delete
  on public.compras_siscom_insumos_pendentes for delete to authenticated
  using (
    (select auth.uid()) is not null and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'master' and p.ativo = true
    )
  );

grant select, insert, update, delete on public.compras_siscom_insumos_pendentes to authenticated;
grant usage, select on sequence public.compras_siscom_insumos_pendentes_id_seq to authenticated;

-- Esta tabela não é fonte de pedido executado, estoque oficial, contas a pagar
-- nem aprovação de OTB. Somente simulação até conciliação financeira e SISCOM.
