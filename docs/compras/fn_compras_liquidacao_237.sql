-- Gestão Zacarini 2.3.7 / Liq_Base, Liq_Rede, Estoque Parado e Liquidação Lojas/Linhas.
-- Leitura paginada Master, sem tocar nas fontes RPA/SISCOM.
-- Previsão: replica os marcadores da planilha ABCEstoque_DDE!E5:G10:
-- comparáveis S: Bandeirantes, Campo Grande, Pedro Gomes e Rio Verde.
-- Coxim: não comparável para crescimento, mas usa Ano passado como base.
-- Anastácio: Últimos 90d como base, sem projeção de ano passado.
-- O fator por SKU prevalece sobre o fator do subgrupo; sem histórico, 1.
-- B13:B14 = crescimento mínimo 0 / máximo 4, B7 = 90 dias.
-- Esta leitura operacional NÃO constitui verba homologada.
create or replace function public.fn_compras_liquidacao_237(
  p_escopo text default 'lojas',
  p_filial text default null,
  p_linha integer default null,
  p_busca text default null,
  p_situacao text default 'todos',
  p_dde_limite integer default 60,
  p_pagina integer default 1,
  p_tamanho integer default 40
)
returns table (
  filial text, produto_cod text, descricao text, grupo_subgrupo text,
  marca text, linha integer, qtde_estoque numeric, valor_estoque numeric,
  vendido_90d numeric, previsto_90d numeric, fator_crescimento numeric,
  dde_previsto numeric, situacao text, valor_parado numeric,
  motivo_exclusao text, base_previsao text, data_historico date,
  total_itens bigint, total_estoque numeric, total_parado numeric,
  itens_sem_giro bigint, itens_excesso bigint
)
language plpgsql stable security definer
set search_path to ''
set statement_timeout to '8s'
set lock_timeout to '2s'
as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'master' and p.ativo
  ) then
    raise exception 'Acesso permitido apenas a Master ativo' using errcode = '42501';
  end if;
  if p_escopo not in ('lojas','rede') or
     (p_filial is not null and p_filial not in ('BDS','CG','RIO','CX','PG','AN')) or
     (p_linha is not null and p_linha not in (0,1,2,3,4)) or
     p_situacao not in ('todos','sem_giro','excesso','regular','excluido') or
     p_dde_limite not between 1 and 365 or
     p_pagina not between 1 and 500 or p_tamanho not between 1 and 100 or
     length(coalesce(p_busca,'')) > 80 then
    raise exception 'Parâmetros de consulta inválidos' using errcode = '22023';
  end if;
  if not exists (
    select 1 from painel.mv_abc_janelas
    where data_fim >= current_date - 7
  ) then
    raise exception 'Histórico ABC desatualizado; previsão de giro indisponível' using errcode = '22023';
  end if;

  return query
  with
  comparaveis as (
    select a.produto_cod, p.grupo_subgrupo,
           sum(a.qtde_90d) as atual, sum(a.qtde_base_aa) as anterior
    from painel.mv_abc_janelas a
    join painel.produtos p on p.produto_cod = a.produto_cod
    where a.loja in ('Bandeirantes','Campo Grande','Pedro Gomes','Rio Verde')
    group by a.produto_cod, p.grupo_subgrupo
  ),
  crescimento_grupo as (
    select c.grupo_subgrupo,
           least(4::numeric, greatest(0::numeric,
             sum(c.atual) / nullif(sum(c.anterior),0))) as fator
    from comparaveis c group by c.grupo_subgrupo
  ),
  crescimento_sku as (
    select c.produto_cod,
           least(4::numeric, greatest(0::numeric,
             sum(c.atual) / nullif(sum(c.anterior),0))) as fator
    from comparaveis c group by c.produto_cod
  ),
  estoque_lojas as (
    select e.filial, e.produto_cod, coalesce(p.descricao,'Sem cadastro') as descricao,
           coalesce(p.grupo_subgrupo,'Sem grupo') as grupo_subgrupo,
           coalesce(p.marca,'') as marca, p.linha,
           e.qtde as qtd, e.valor as valor,
           coalesce(a.qtde_90d,0::numeric) as vendidos,
           case when e.filial = 'AN' then 0::numeric
             else coalesce(a.qtde_prox_aa,0::numeric) end as proximo_aa,
           case when e.filial = 'AN' then coalesce(a.qtde_90d,0::numeric)
             else 0::numeric end as novos_90d,
           coalesce(cs.fator, cg.fator, 1::numeric) as fator,
           a.data_fim as data_hist,
           case
             when p.grupo_subgrupo = '1.LINHA NUTRIÇÃO / MATERIA PRIMA' then 'Matéria-prima'
             when upper(coalesce(p.marca,'')) = 'GALLAGHER' then 'Consignado Gallagher'
             when e.produto_cod in ('545','5159','7976','200001') then 'Uso interno (lista de referência)'
             else null
           end as exclusao
    from painel.estoque e
    left join painel.produtos p on p.produto_cod = e.produto_cod
    left join painel.mv_abc_janelas a on a.produto_cod = e.produto_cod
      and a.loja = (case e.filial
        when 'BDS' then 'Bandeirantes' when 'CG' then 'Campo Grande'
        when 'RIO' then 'Rio Verde' when 'CX' then 'Coxim'
        when 'PG' then 'Pedro Gomes' when 'AN' then 'Anastácio' end)
    left join crescimento_sku cs on cs.produto_cod = e.produto_cod
    left join crescimento_grupo cg on cg.grupo_subgrupo = p.grupo_subgrupo
    where e.filial in ('BDS','CG','RIO','CX','PG','AN')
  ),
  projeções as (
    select l.*,
      greatest(l.vendidos, l.proximo_aa * l.fator + l.novos_90d) as previsto,
      case when l.filial = 'AN'
        then 'Últimos 90d / loja nova (Excel _Base)'
        else 'Ano passado × crescimento SKU/subgrupo / piso 90d (Excel _Base)'
      end as metodo
    from estoque_lojas l
  ),
  conjunto as (
    select x.filial, x.produto_cod, x.descricao, x.grupo_subgrupo,
           x.marca, x.linha, x.qtd, x.valor, x.vendidos, x.previsto, x.fator,
           x.exclusao, x.metodo, x.data_hist
    from projeções x where p_escopo = 'lojas'
    union all
    select 'REDE'::text, x.produto_cod, max(x.descricao), max(x.grupo_subgrupo),
           max(x.marca), max(x.linha), sum(x.qtd), sum(x.valor),
           sum(x.vendidos), sum(x.previsto), max(x.fator),
           max(x.exclusao),
           'Soma das previsões por filial'::text, max(x.data_hist)
    from projeções x where p_escopo = 'rede'
    group by x.produto_cod
  ),
  classificados as (
    select x.*,
      case when x.qtd > 0 and x.previsto > 0
        then x.qtd * 90::numeric / x.previsto else null end as dde,
      case
        when x.exclusao is not null then 'excluido'
        when x.qtd <= 0 or x.valor <= 0 then 'sem_estoque'
        when x.previsto <= 0 then 'sem_giro'
        when x.qtd * 90::numeric / x.previsto > p_dde_limite then 'excesso'
        else 'regular'
      end::text as classe
    from conjunto x
  ),
  calculados as (
    select x.*,
      case
        when x.classe = 'sem_giro' then x.valor
        when x.classe = 'excesso' then greatest(0::numeric,
          x.valor - (x.valor / nullif(x.qtd,0)) * (x.previsto / 90::numeric) * p_dde_limite)
        else 0::numeric
      end as parado
    from classificados x
  ),
  filtrados as (
    select x.* from calculados x
    where (p_escopo='rede' or p_filial is null or x.filial=p_filial)
      and (p_linha is null or x.linha=p_linha)
      and (p_situacao='todos' or x.classe=p_situacao)
      and (nullif(trim(p_busca),'') is null or
           x.produto_cod ilike '%'||trim(p_busca)||'%' or
           x.descricao ilike '%'||trim(p_busca)||'%' or
           x.grupo_subgrupo ilike '%'||trim(p_busca)||'%')
  )
  select x.filial, x.produto_cod, x.descricao, x.grupo_subgrupo,
         x.marca, x.linha, x.qtd, x.valor, x.vendidos, x.previsto, x.fator,
         x.dde, x.classe, x.parado, x.exclusao, x.metodo, x.data_hist,
         count(*) over ()::bigint, sum(x.valor) over (), sum(x.parado) over (),
         count(*) filter (where x.classe='sem_giro') over ()::bigint,
         count(*) filter (where x.classe='excesso') over ()::bigint
  from filtrados x
  order by x.parado desc, x.produto_cod, x.filial
  limit p_tamanho offset (p_pagina-1)*p_tamanho;
end
$$;

revoke all on function public.fn_compras_liquidacao_237(text,text,integer,text,text,integer,integer,integer) from public, anon;
grant execute on function public.fn_compras_liquidacao_237(text,text,integer,text,text,integer,integer,integer) to authenticated;
