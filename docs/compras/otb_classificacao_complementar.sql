-- OTB Só Sal: classificação complementar aprovada em 17/11/2026.
-- Preserva o cadastro e a coleta SISCOM: nenhuma tabela painel.* é escrita.
-- Código 0 = SERVICOS (fora da OTB); 104356 = fertilizante na linha 4.

create table if not exists public.otb_classificacao_complementar_produto (
  produto_cod text primary key,
  categoria text not null check (categoria in ('linha','fora_otb')),
  linha integer,
  motivo text not null check (length(trim(motivo)) > 0),
  criado_em timestamptz not null default now(),
  constraint otb_classificacao_linha_consistente check (
    (categoria = 'linha' and linha between 1 and 4)
    or (categoria = 'fora_otb' and linha is null)
  )
);

alter table public.otb_classificacao_complementar_produto enable row level security;
revoke all on table public.otb_classificacao_complementar_produto from public, anon, authenticated;

insert into public.otb_classificacao_complementar_produto
  (produto_cod, categoria, linha, motivo)
values
  ('0', 'fora_otb', null, 'SERVICOS: fora do orçamento comercial OTB; aprovado pelo responsável em 17/11/2026'),
  ('104356', 'linha', 4, 'FERTILIZANTE SULFAMMO META 29 1000KG; mesmo grupo do 104297 50KG; aprovado em 17/11/2026')
on conflict (produto_cod) do nothing;

-- Evita prosseguir silenciosamente caso já exista complemento conflitante.
do $$
begin
  if not exists (
    select 1 from public.otb_classificacao_complementar_produto
    where produto_cod = '0' and categoria = 'fora_otb' and linha is null
  ) or not exists (
    select 1 from public.otb_classificacao_complementar_produto
    where produto_cod = '104356' and categoria = 'linha' and linha = 4
  ) then
    raise exception 'Classificação complementar OTB conflita com regra aprovada';
  end if;
end;
$$;

-- Mantém a mesma assinatura da RPC já usada no Next.js.
-- Categoria -1 = explicitamente fora OTB; 0 = linha ainda não mapeada;
-- 1..4 = linhas comerciais. São estados disjuntos e auditáveis.
create or replace function public.fn_otb_historico_mensal(
  p_inicio date,
  p_fim date
)
returns table (
  mes date,
  linha integer,
  visao text,
  venda_bruta numeric,
  cmv numeric,
  lucro numeric,
  registros bigint
)
language plpgsql
stable security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'master'
      and p.ativo = true
  ) then
    raise exception 'Acesso restrito ao Master ativo'
      using errcode = '42501';
  end if;

  if p_inicio is null or p_fim is null
    or p_inicio <> date_trunc('month',p_inicio)::date
    or p_fim <> date_trunc('month',p_fim)::date
    or p_fim < p_inicio
    or p_fim >= (p_inicio + interval '24 months')::date
  then
    raise exception 'Intervalo inválido: informar dois inícios de mês em até 24 competências'
      using errcode = '22023';
  end if;

  return query
  select
    date_trunc('month',v.data)::date as mes,
    case
      when c.categoria = 'fora_otb' then -1
      when c.categoria = 'linha' then c.linha
      when p.linha in (1,2,3,4) then p.linha
      else 0
    end as linha,
    v.visao,
    sum(v.vda_bruta) as venda_bruta,
    sum(v.custo_medio) as cmv,
    sum(v.lucro_medio) as lucro,
    count(*) as registros
  from painel.vendas v
  left join painel.produtos p on p.produto_cod = v.produto_cod
  left join public.otb_classificacao_complementar_produto c on c.produto_cod = v.produto_cod
  where v.data >= p_inicio
    and v.data < (p_fim + interval '1 month')::date
    and v.visao in ('vendido','saida')
  group by 1, 2, 3
  order by 1, 2, 3;
end;
$$;

revoke all on function public.fn_otb_historico_mensal(date,date) from public, anon;
grant execute on function public.fn_otb_historico_mensal(date,date) to authenticated;

comment on table public.otb_classificacao_complementar_produto is
  'Exceções aprovadas de classificação para OTB, sem alterar painel.produtos/SISCOM; leitura apenas por função Master.';
comment on function public.fn_otb_historico_mensal(date,date) is
  'Premissas 12M: histórico comercial por linha; -1 excluído da OTB, 0 pendente, 1..4 comercial. Master ativo.';
