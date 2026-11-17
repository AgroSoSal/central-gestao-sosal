-- Fase 2 · Só Sal · proposta para homologação, NÃO executar em produção sem o OK escrito do Alex.
-- Fonte de margem: somente Relatório de Comissão do Siscom; nunca estimar o custo financeiro.
-- A carga bruta fica separada dos dados publicados. Valores financeiros armazenados sem fator de ajuste.

create table if not exists painel.representantes (
  representante_cod text primary key,
  nome text not null,
  loja text,
  tipo text check (tipo in ('loja','ecommerce','oficina','outros')),
  ativo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists painel.comissao_lotes (
  id bigint generated always as identity primary key,
  mes_comercial date not null check (extract(day from mes_comercial) = 1),
  arquivo_nome text not null,
  sha256_arquivo text not null,
  parametros_extracao jsonb not null check (jsonb_typeof(parametros_extracao) = 'object'),
  total_venda_oficial numeric(18,2) not null,
  total_margem_oficial numeric(18,2) not null,
  total_comissao_oficial numeric(18,2) not null,
  total_vendedores_oficial integer,
  linhas_oficiais integer not null check (linhas_oficiais >= 0),
  situacao text not null default 'recebido'
    check (situacao in ('recebido','erro','publicado','substituido')),
  erro_validacao text,
  criado_em timestamptz not null default now(),
  publicado_em timestamptz,
  unique (mes_comercial, sha256_arquivo)
);

-- linha_relatorio é o ordinal físico da linha na seção exportada, sem eliminar as conjugadas.
create table if not exists painel.comissao_linhas_importadas (
  lote_id bigint not null references painel.comissao_lotes(id),
  linha_relatorio integer not null check (linha_relatorio > 0),
  data date not null,
  nota text not null,
  filial text not null,
  vendedor_cod text,
  vendedor text,
  representante_cod text,
  representante text,
  cliente_cod text,
  razao_social text,
  condicao_pagto text,
  tipo text not null
    check (tipo in ('VENDA','CONJUGADA_1','CONJUGADA_2','DEVOLUCAO','BONIFICACAO')),
  linha_produto smallint check (linha_produto between 1 and 4),
  chave_conjugada text,
  vl_nota numeric(18,2) not null,
  margem numeric(18,2) not null,
  perc_comissao numeric(12,6),
  comissao numeric(18,2) not null,
  primary key (lote_id, linha_relatorio),
  constraint comissao_chave_conjugada_origem check (
    tipo not in ('CONJUGADA_1','CONJUGADA_2')
    or nullif(btrim(chave_conjugada),'') is not null
  )
);

-- Só entra aqui a carga que passou na validação pelo TOTAL GERAL original.
create table if not exists painel.comissao_notas (
  mes_comercial date not null,
  lote_id bigint not null references painel.comissao_lotes(id),
  linha_relatorio integer not null,
  data date not null,
  nota text not null,
  filial text not null,
  vendedor_cod text,
  vendedor text,
  representante_cod text,
  representante text,
  cliente_cod text,
  razao_social text,
  condicao_pagto text,
  tipo text not null check (tipo in ('VENDA','CONJUGADA_1','CONJUGADA_2','DEVOLUCAO','BONIFICACAO')),
  linha_produto smallint check (linha_produto between 1 and 4),
  chave_conjugada text,
  vl_nota numeric(18,2) not null,
  margem numeric(18,2) not null,
  perc_comissao numeric(12,6),
  comissao numeric(18,2) not null,
  carregado_em timestamptz not null default now(),
  primary key (lote_id, linha_relatorio)
);
create index if not exists ix_comissao_notas_mes_rep
  on painel.comissao_notas (mes_comercial, representante_cod);
create index if not exists ix_comissao_notas_mes_filial
  on painel.comissao_notas (mes_comercial, filial);
create index if not exists ix_comissao_notas_conjugadas
  on painel.comissao_notas (mes_comercial, filial, chave_conjugada)
  where tipo in ('CONJUGADA_1','CONJUGADA_2');

-- Só para conjugadas envolvendo representantes DIFERENTES.
-- Não há escolha automática do beneficiário. Alex precisa aprovar a atribuição.
create table if not exists painel.comissao_conjugadas_atribuicao (
  mes_comercial date not null,
  filial text not null,
  chave_conjugada text not null,
  representante_cod text not null references painel.representantes(representante_cod),
  aprovado_por text not null,
  aprovado_em timestamptz not null default now(),
  primary key (mes_comercial, filial, chave_conjugada)
);

-- Acesso à API: tabelas privadas, SELECT apenas nas views agregadas definidas depois.
alter table painel.representantes enable row level security;
alter table painel.comissao_lotes enable row level security;
alter table painel.comissao_linhas_importadas enable row level security;
alter table painel.comissao_notas enable row level security;
alter table painel.comissao_conjugadas_atribuicao enable row level security;

revoke all on painel.representantes, painel.comissao_lotes,
  painel.comissao_linhas_importadas, painel.comissao_notas,
  painel.comissao_conjugadas_atribuicao from PUBLIC, anon, authenticated;
grant select, insert, update, delete on painel.representantes, painel.comissao_lotes,
  painel.comissao_linhas_importadas, painel.comissao_notas,
  painel.comissao_conjugadas_atribuicao to service_role;
grant usage, select on all sequences in schema painel to service_role;
