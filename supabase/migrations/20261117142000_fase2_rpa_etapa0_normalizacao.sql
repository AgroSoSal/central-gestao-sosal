-- Etapa 0 da Fase 2: inspecionar RPA, bloquear duplicação/integridade e só ENTÃO
-- publicar dados normalizados no painel. Nenhuma view consulta JSON bruto.
-- SEM alterar o fluxo atual e SEM chamar painel.atualizar_tudo().
-- A política de completude/limiares ainda deve ser homologada pelo Alex.

create table if not exists painel.rpa_avaliacoes (
  importacao_id bigint primary key,
  relatorio text not null,
  arquivo_nome text not null,
  linhas_informadas integer not null,
  linhas_reais bigint not null,
  linhas_iguais_adicionais bigint not null,
  linhas_sem_chave bigint not null,
  estado text not null check (estado in ('BLOQUEADA','PENDENTE_APROVACAO','APROVADA','PUBLICADA')),
  observacao text,
  aprovado_por text,
  aprovado_em timestamptz,
  avaliado_em timestamptz not null default now(),
  publicado_em timestamptz
);

create table if not exists painel.rpa_linhas_normalizadas (
  importacao_id bigint not null,
  linha_excel integer not null,
  relatorio text not null,
  hash_linha text not null,
  ocorrencia_igual integer not null,
  importado_em timestamptz not null,
  filial text,
  loja text,
  codigo text,
  cnpj text,
  razao_social text,
  titulo text,
  parcela text,
  entrada date,
  vencimento date,
  data_baixa date,
  valor_titulo numeric(18,2),
  valor_liquido numeric(18,2),
  valor_pago numeric(18,2),
  pedido text,
  data_pedido date,
  fornecedor_codigo text,
  fornecedor_nome text,
  produto_codigo text,
  descricao text,
  quantidade numeric(18,4),
  custo_unitario numeric(18,4),
  valor_total_informado numeric(18,2),
  condicao_pagamento text,
  primary key (importacao_id, linha_excel)
);
create index if not exists ix_rpa_normalizadas_relatorio on painel.rpa_linhas_normalizadas(relatorio,importado_em);
create index if not exists ix_rpa_normalizadas_titulos on painel.rpa_linhas_normalizadas(relatorio,filial,titulo,parcela);

create or replace function painel.avaliar_importacao_rpa(p_importacao_id bigint)
returns text
language plpgsql security invoker set search_path = ''
as $func$
declare
  src record;
  qtd bigint;
  repetidas bigint;
  sem_chave bigint;
  situacao text;
begin
  select id,relatorio,arquivo_nome,total_linhas,importado_em
  into src from "Só Sal".rpa_importacoes where id=p_importacao_id;
  if not found then raise exception 'RPA importação % inexistente',p_importacao_id; end if;
  if src.relatorio not in ('clientes_a_pagar','clientes_pagos',
      'fornecedores_a_pagar','fornecedores_pagos','pedidos_compra') then
    raise exception 'Relatório não homologado: %',src.relatorio;
  end if;
  if exists (select 1 from painel.rpa_avaliacoes where importacao_id=p_importacao_id
       and estado in ('APROVADA','PUBLICADA')) then
    return 'ja_aprovada_ou_publicada';
  end if;

  select count(*),count(*) filter (where ocorrencia_igual>1),
    count(*) filter (
      where hash_linha is null or btrim(hash_linha)=''
         or case
           when src.relatorio='pedidos_compra' then
             nullif(btrim(campos->>'loja'),'') is null
             or nullif(btrim(campos->>'pedido'),'') is null
             or nullif(btrim(campos->>'produto_codigo'),'') is null
             or nullif(btrim(campos->>'quantidade'),'') is null
             or nullif(btrim(campos->>'custo_unitario'),'') is null
           when src.relatorio in ('clientes_a_pagar','fornecedores_a_pagar') then
             nullif(btrim(campos->>'titulo'),'') is null
             or nullif(btrim(campos->>'codigo'),'') is null
             or nullif(btrim(campos->>'vencimento'),'') is null
             or nullif(btrim(campos->>'valor_titulo'),'') is null
           else
             nullif(btrim(campos->>'titulo'),'') is null
             or nullif(btrim(campos->>'codigo'),'') is null
             or nullif(btrim(campos->>'data_baixa'),'') is null
             or nullif(btrim(campos->>'valor_pago'),'') is null
           end
    )
    into qtd,repetidas,sem_chave
  from "Só Sal".rpa_linhas
  where importacao_id=p_importacao_id;

  situacao:=case when qtd=0 or qtd<>src.total_linhas or repetidas>0 or sem_chave>0
      then 'BLOQUEADA' else 'PENDENTE_APROVACAO' end;
  insert into painel.rpa_avaliacoes (
    importacao_id,relatorio,arquivo_nome,linhas_informadas,
    linhas_reais,linhas_iguais_adicionais,linhas_sem_chave,estado,observacao
  ) values (
    src.id,src.relatorio,src.arquivo_nome,src.total_linhas,
    qtd,repetidas,sem_chave,situacao,
    case when situacao='BLOQUEADA' then
      format('Linhas: %s/%s; repetidas adicionais: %s; sem chave: %s',
             qtd,src.total_linhas,repetidas,sem_chave)
    else 'Validar completude contra especificação e referência anterior; aguarda OK escrito' end
  )
  on conflict (importacao_id) do update set
    linhas_informadas=excluded.linhas_informadas,
    linhas_reais=excluded.linhas_reais,
    linhas_iguais_adicionais=excluded.linhas_iguais_adicionais,
    linhas_sem_chave=excluded.linhas_sem_chave,
    estado=excluded.estado,observacao=excluded.observacao,avaliado_em=now();
  return situacao;
end;
$func$;

-- Operador registra a decisão escrita do Alex SOMENTE após conferência manual.
-- A assinatura/documento de aprovação deve ser arquivada externamente.
create or replace function painel.aprovar_importacao_rpa(p_importacao_id bigint,p_aprovado_por text)
returns text language plpgsql security invoker set search_path = ''
as $func$
begin
  if nullif(btrim(p_aprovado_por),'') is null then
    raise exception 'Identificador do aprovador obrigatório';
  end if;
  update painel.rpa_avaliacoes set estado='APROVADA',aprovado_por=p_aprovado_por,
    aprovado_em=now() where importacao_id=p_importacao_id
    and estado='PENDENTE_APROVACAO';
  if not found then raise exception 'Importação sem validação aprovada ou bloqueada'; end if;
  return 'aprovada';
end;
$func$;

-- A normalização de JSON acontece UMA VEZ no ETL, nunca em uma view online.
-- Falha de conversão dá rollback integral, preservando os dados anteriores.
create or replace function painel.publicar_importacao_rpa(p_importacao_id bigint)
returns text language plpgsql security invoker set search_path = ''
as $func$
declare
  r record;
begin
  select a.relatorio,i.importado_em into r
  from painel.rpa_avaliacoes a join "Só Sal".rpa_importacoes i on i.id=a.importacao_id
  where a.importacao_id=p_importacao_id and a.estado='APROVADA' for update of a;
  if not found then raise exception 'Importação % sem aprovação',p_importacao_id; end if;
  insert into painel.rpa_linhas_normalizadas (
    importacao_id,linha_excel,relatorio,hash_linha,ocorrencia_igual,importado_em,
    filial,loja,codigo,cnpj,razao_social,titulo,parcela,
    entrada,vencimento,data_baixa,valor_titulo,valor_liquido,valor_pago,
    pedido,data_pedido,fornecedor_codigo,fornecedor_nome,produto_codigo,descricao,
    quantidade,custo_unitario,valor_total_informado,condicao_pagamento
  )
  select p_importacao_id,l.linha_excel,r.relatorio,l.hash_linha,l.ocorrencia_igual,r.importado_em,
    l.campos->>'filial',l.campos->>'loja',l.campos->>'codigo',
    l.campos->>'cnpj',l.campos->>'razao_social',l.campos->>'titulo',l.campos->>'parcela',
    nullif(l.campos->>'entrada','')::date,
    nullif(l.campos->>'vencimento','')::date,
    nullif(l.campos->>'data_baixa','')::date,
    nullif(l.campos->>'valor_titulo','')::numeric,
    nullif(l.campos->>'valor_liquido','')::numeric,
    nullif(l.campos->>'valor_pago','')::numeric,
    l.campos->>'pedido',nullif(l.campos->>'data_pedido','')::date,
    l.campos->>'fornecedor_codigo',l.campos->>'fornecedor_nome',
    l.campos->>'produto_codigo',l.campos->>'descricao',
    nullif(l.campos->>'quantidade','')::numeric,
    nullif(l.campos->>'custo_unitario','')::numeric,
    nullif(l.campos->>'valor_total','')::numeric,
    l.campos->>'condicao_pagamento'
  from "Só Sal".rpa_linhas l
  where l.importacao_id=p_importacao_id
  on conflict (importacao_id,linha_excel) do nothing;
  update painel.rpa_avaliacoes set estado='PUBLICADA',publicado_em=now()
  where importacao_id=p_importacao_id;
  return 'publicada';
end;
$func$;

-- Fontes tipadas para construir as views de negócio SEM ler JSON e SEM
-- reutilizar "Só Sal".v_titulos_recebidos.
create or replace view painel.v_rpa_pedidos_fonte
with (security_barrier=true) as
select importacao_id,linha_excel,importado_em,loja,pedido,data_pedido,
  fornecedor_codigo,fornecedor_nome,produto_codigo,descricao,quantidade,
  custo_unitario,valor_total_informado,condicao_pagamento
from painel.rpa_linhas_normalizadas where relatorio='pedidos_compra';

create or replace view painel.v_rpa_pagamentos_fonte
with (security_barrier=true) as
select importacao_id,linha_excel,importado_em,relatorio,filial,codigo,cnpj,
  razao_social,titulo,parcela,vencimento,data_baixa,valor_pago,hash_linha,ocorrencia_igual
from painel.rpa_linhas_normalizadas
where relatorio in ('clientes_pagos','fornecedores_pagos');

create or replace view painel.v_rpa_a_pagar_fonte
with (security_barrier=true) as
select importacao_id,linha_excel,importado_em,relatorio,filial,codigo,cnpj,
  razao_social,titulo,parcela,entrada,vencimento,valor_titulo,valor_liquido,
  hash_linha,ocorrencia_igual
from painel.rpa_linhas_normalizadas
where relatorio in ('clientes_a_pagar','fornecedores_a_pagar');

create or replace view painel.v_rpa_qualidade_cargas
with (security_barrier=true) as
select importacao_id,relatorio,arquivo_nome,linhas_informadas,linhas_reais,
  linhas_iguais_adicionais,linhas_sem_chave,estado,observacao,avaliado_em,
  aprovado_em,publicado_em
from painel.rpa_avaliacoes;

alter table painel.rpa_avaliacoes enable row level security;
alter table painel.rpa_linhas_normalizadas enable row level security;
revoke all on painel.rpa_avaliacoes,painel.rpa_linhas_normalizadas from PUBLIC,anon,authenticated;
grant select,insert,update,delete on painel.rpa_avaliacoes,painel.rpa_linhas_normalizadas to service_role;
revoke all on painel.v_rpa_pedidos_fonte,painel.v_rpa_pagamentos_fonte,
  painel.v_rpa_a_pagar_fonte,painel.v_rpa_qualidade_cargas from PUBLIC,anon,authenticated;
grant select on painel.v_rpa_pedidos_fonte,painel.v_rpa_pagamentos_fonte,
  painel.v_rpa_a_pagar_fonte,painel.v_rpa_qualidade_cargas to service_role;
revoke all on function painel.avaliar_importacao_rpa(bigint),
  painel.aprovar_importacao_rpa(bigint,text),
  painel.publicar_importacao_rpa(bigint) from PUBLIC,anon,authenticated;
grant execute on function painel.avaliar_importacao_rpa(bigint),
  painel.aprovar_importacao_rpa(bigint,text),
  painel.publicar_importacao_rpa(bigint) to service_role;
