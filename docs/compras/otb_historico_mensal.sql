-- Etapa inicial da Projeção 12M automática.
-- Histórico comercial mensal por linha, read-only e exclusivamente Master.
-- Fonte: Premissas 12M, linhas 9–49 (vendido, saída, CMV, lucro).
-- NÃO cria metas, fatores de crescimento, caixa ou liberações fictícias.
-- Nenhum INSERT/UPDATE/DELETE nas fontes históricas.

create function public.fn_otb_historico_mensal(
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
    case when p.linha in (1,2,3,4) then p.linha else 0 end as linha,
    v.visao,
    sum(v.vda_bruta) as venda_bruta,
    sum(v.custo_medio) as cmv,
    sum(v.lucro_medio) as lucro,
    count(*) as registros
  from painel.vendas v
  left join painel.produtos p on p.produto_cod = v.produto_cod
  where v.data >= p_inicio
    and v.data < (p_fim + interval '1 month')::date
    and v.visao in ('vendido','saida')
  group by 1, 2, 3
  order by 1, 2, 3;
end;
$$;

revoke all on function public.fn_otb_historico_mensal(date,date) from public, anon;
grant execute on function public.fn_otb_historico_mensal(date,date) to authenticated;

comment on function public.fn_otb_historico_mensal(date,date) is
  'Premissas 12M: histórico por linha e mês em visões vendido/saida, Master ativo, sem alteração do SISCOM.';
