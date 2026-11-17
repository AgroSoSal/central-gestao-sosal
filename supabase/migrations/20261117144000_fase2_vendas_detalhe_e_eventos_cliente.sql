-- Fase 2 / preparação para representante em vendas e clientes.
-- NÃO muda painel.vendas nem painel.receber e NÃO publica em produção.
-- Recupera campos que a carga atual descartou: NF, cliente, condição de pagamento,
-- forma de pagamento. O ETL faz a leitura dos relatórios existentes UMA VEZ por
-- filial/período; nenhum objeto de leitura novo varre JSON bruto.
-- Não confundir lucro_bruto_abc com a margem oficial do Relatório de Comissão.

create table if not exists painel.vendas_detalhe_origem (
  filial text not null,
  modalidade text not null,
  periodo_extracao text not null,
  chave_operacao text not null,
  data date,
  nf text,
  operacao text,
  produto_cod text,
  cliente_cod text,
  cliente text,
  vendedor_cod text,
  vendedor text,
  condicao_pagto text,
  forma_pagto text,
  linha_produto smallint check (linha_produto between 1 and 4 or linha_produto is null),
  vda_bruta_abc numeric,
  lucro_bruto_abc numeric,
  comissao_abc numeric,
  carregado_em timestamptz not null default now(),
  primary key (filial,modalidade,periodo_extracao,chave_operacao)
);
create index if not exists ix_vendas_detalhe_nf
  on painel.vendas_detalhe_origem (filial,nf,data);
create index if not exists ix_vendas_detalhe_cliente
  on painel.vendas_detalhe_origem (cliente_cod,data);
create index if not exists ix_vendas_detalhe_vendedor
  on painel.vendas_detalhe_origem (filial,vendedor_cod,data);

-- A função deve ser acionada somente na conexão administrativa. Reexecução
-- é idempotente: substituição do período/filial em uma única transação.
create or replace function painel.carregar_vendas_detalhe_origem(
  p_filial text, p_periodo text
) returns bigint
language plpgsql security invoker set search_path=''
as $function$
declare
  n bigint;
begin
  if p_filial not in ('BDS','CG','RIO','CX','PG','AN')
  then raise exception 'Filial inválida: %',p_filial; end if;
  if p_periodo !~ '^[0-9]{4}-[0-9]{2}$'
  then raise exception 'Período inválido: %',p_periodo; end if;

  -- Nenhuma inclusão de médias/saídas, CIA ou visões alternativas por engano.
  delete from painel.vendas_detalhe_origem
  where filial=p_filial and periodo_extracao=p_periodo
    and modalidade in ('abcmargem_vendido_liquido',
                       'abcmargem_vendido_liquido_dev');

  insert into painel.vendas_detalhe_origem (
    filial,modalidade,periodo_extracao,chave_operacao,data,nf,operacao,
    produto_cod,cliente_cod,cliente,vendedor_cod,vendedor,condicao_pagto,
    forma_pagto,linha_produto,vda_bruta_abc,lucro_bruto_abc,comissao_abc
  )
  select
    v.filial,v.modalidade,v.periodo_extracao,v.chave_operacao,
    painel.dt(v.data),v.nf,v.operacao,
    v.codigo_produto,v.codigo_cliente,v.cliente,v.codigo_vendedor,v.vendedor,
    v.condicao_pagamento,v.forma_pagamento,
    case when left(v.grupo_subgrupo,1) in ('1','2','3','4')
         then left(v.grupo_subgrupo,1)::smallint else null end,
    painel.num(v.valor_bruto),painel.num(v.lucro_bruto),painel.num(v.comissao)
  from "Só Sal".v_margens v
  where v.filial=p_filial and v.periodo_extracao=p_periodo
    and v.modalidade in ('abcmargem_vendido_liquido',
                         'abcmargem_vendido_liquido_dev');
  get diagnostics n=row_count;
  return n;
end;
$function$;

-- Views em colunas físicas, sem JSON; dados identificáveis NÃO são públicos.
create or replace view painel.v_vendas_detalhe_origem
with (security_invoker=true,security_barrier=true)
as
select filial,modalidade,periodo_extracao,chave_operacao,data,nf,
  operacao,produto_cod,cliente_cod,cliente,vendedor_cod,vendedor,
  condicao_pagto,forma_pagto,linha_produto,vda_bruta_abc,
  lucro_bruto_abc,comissao_abc,carregado_em
from painel.vendas_detalhe_origem;

-- Fonte de eventos comerciais (não calcula cliente NOVO/ATIVO, pois a
-- definição exata está no SQL de Alex ainda não disponibilizado).
-- Somente documentos positivos e homologados com representante conhecido;
-- evita inventar atribuição de conjugada inter-representantes.
create or replace view painel.v_clientes_eventos_representante
with (security_invoker=true,security_barrier=true)
as
with pares as (
  select mes_comercial,filial,chave_conjugada,
    count(distinct representante_cod) qtd_representantes
  from painel.comissao_notas
  where tipo in ('CONJUGADA_1','CONJUGADA_2')
  group by mes_comercial,filial,chave_conjugada
)
select distinct n.mes_comercial,n.representante_cod,
  n.cliente_cod,n.data,n.nota,n.filial
from painel.comissao_notas n
join painel.representantes r
 on r.representante_cod=n.representante_cod
left join pares p
 on p.mes_comercial=n.mes_comercial
 and p.filial=n.filial
 and p.chave_conjugada=n.chave_conjugada
where n.tipo in ('VENDA','CONJUGADA_1')
  and n.vl_nota > 0
  and nullif(btrim(n.cliente_cod),'') is not null
  and (n.tipo='VENDA' or p.qtd_representantes=1)
  and exists (
    select 1 from painel.comissao_lotes l
    where l.id=n.lote_id and l.situacao='publicado'
  );

alter table painel.vendas_detalhe_origem enable row level security;
revoke all on painel.vendas_detalhe_origem from PUBLIC,anon,authenticated;
revoke all on painel.v_vendas_detalhe_origem,painel.v_clientes_eventos_representante
  from PUBLIC,anon,authenticated;
revoke all on function painel.carregar_vendas_detalhe_origem(text,text)
  from PUBLIC,anon,authenticated;
-- A função de carga continua acessível ao proprietário administrativo postgres.
