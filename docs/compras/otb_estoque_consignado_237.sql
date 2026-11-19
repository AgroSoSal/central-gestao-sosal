-- Zacarini 2.3.7: OTB!I48:I173 = ABCEstoque_DDE!R por grupo
-- menos sbEstoque[valor] da marca Liquidação Lojas!B7 = GALLAGHER.
-- Sem escrita em estoques, REFRESH ou consulta Excel em tempo de execução.
-- Mesma fonte/cadastro de public.fn_otb_posicao_subgrupos(date).
create or replace function public.fn_otb_estoque_consignado_237()
returns table (
  linha integer,grupo_subgrupo text,valor_consignado numeric,
  ultima_atualizacao timestamptz
)
language plpgsql stable security definer
set search_path to ''
set statement_timeout to '5s'
as $function$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles pr
    where pr.id=(select auth.uid()) and pr.role='master' and pr.ativo
  ) then
    raise exception 'Acesso restrito ao Master ativo' using errcode='42501';
  end if;
  return query
  with cadastro as (
    select p.produto_cod,p.grupo_subgrupo,
      case when c.categoria='fora_otb' then -1
        when c.categoria='linha' then c.linha
        when p.linha in (1,2,3,4) then p.linha
        else 0 end as linha
    from painel.produtos p
    left join public.otb_classificacao_complementar_produto c
      on c.produto_cod=p.produto_cod
    where p.marca='GALLAGHER'
  ), foto as (select max(atualizado_em) as atualizacao from painel.estoque)
  select c.linha,c.grupo_subgrupo,
    case when count(*) filter (where e.valor is null)>0
      then null::numeric else sum(e.valor) end as valor_consignado,
    f.atualizacao as ultima_atualizacao
  from painel.estoque e
  join cadastro c on c.produto_cod=e.produto_cod
  cross join foto f
  group by c.linha,c.grupo_subgrupo,f.atualizacao
  order by 1,2;
end;
$function$;

revoke all on function public.fn_otb_estoque_consignado_237() from public,anon;
grant execute on function public.fn_otb_estoque_consignado_237() to authenticated;
