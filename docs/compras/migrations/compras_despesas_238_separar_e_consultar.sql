CREATE OR REPLACE FUNCTION public.fn_compras_listar_cotacoes_rascunho(p_limite integer DEFAULT 10)
 RETURNS TABLE(id bigint, filial text, total numeric, itens_count integer, observacao text, criado_em timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '4s'
AS $function$
begin
  if (select auth.uid()) is null or not exists (
     select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='master' and p.ativo
  ) then
    raise exception 'Somente Master ativo pode listar rascunhos' using errcode='42501';
  end if;
  return query
    select r.id,r.filial,r.total,jsonb_array_length(r.itens)::integer,r.observacao,r.criado_em
    from public.compras_cotacao_rascunhos r
    where coalesce(r.tipo_pedido,'Mercadoria') <> 'Despesa/Investimento'
    order by r.criado_em desc,r.id desc limit least(greatest(coalesce(p_limite,10),1),30);
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_compras_cotacao_rascunho_detalhar_238(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
declare result jsonb;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles pr
    where pr.id=(select auth.uid()) and pr.role='master' and pr.ativo
  ) then raise exception 'Somente Master ativo consulta rascunhos' using errcode='42501'; end if;
  if p_id is null or p_id<1 then raise exception 'Identificador inválido' using errcode='22023'; end if;

  select jsonb_build_object(
    'source','COTACAO_RASCUNHO_238',
    'id',r.id,'filial',r.filial,'itens',r.itens,
    'total',r.total,'observacao',r.observacao,
    'tipo_pedido',r.tipo_pedido,'status',r.status,
    'criado_em',r.criado_em,
    'estado_operacional','RASCUNHO_NAO_AUTORIZADO',
    'authorizesPurchases',false
  ) into result
  from public.compras_cotacao_rascunhos r
  where r.id=p_id and coalesce(r.tipo_pedido,'Mercadoria') <> 'Despesa/Investimento';

  return result;
end;
$function$;

create or replace function public.fn_compras_listar_despesas_rascunho_238(p_limite integer default 10)
returns table(id bigint,filial text,total numeric,itens_count integer,observacao text,criado_em timestamptz)
language plpgsql stable security definer set search_path='' set statement_timeout='4s'
as $body$
begin
 if (select auth.uid()) is null or not exists(
  select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='master' and p.ativo
 ) then raise exception 'Master ativo obrigatório' using errcode='42501'; end if;
 return query
 select r.id,r.filial,r.total,jsonb_array_length(r.itens)::integer,r.observacao,r.criado_em
 from public.compras_cotacao_rascunhos r
 where r.tipo_pedido='Despesa/Investimento'
 order by r.criado_em desc,r.id desc
 limit least(greatest(coalesce(p_limite,10),1),30);
end;
$body$;

create or replace function public.fn_compras_despesa_rascunho_detalhar_238(p_id bigint)
returns jsonb
language plpgsql stable security definer set search_path='' set statement_timeout='4s'
as $body$
declare payload jsonb;
begin
 if (select auth.uid()) is null or not exists (
   select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='master' and p.ativo
 ) then raise exception 'Master ativo obrigatório' using errcode='42501'; end if;
 if p_id is null or p_id<1 then raise exception 'Identificador inválido' using errcode='22023'; end if;
 select jsonb_build_object(
   'source','DESPESA_RASCUNHO_238',
   'id',r.id,'filial',r.filial,'tipo_pedido',r.tipo_pedido,
   'total',r.total,'observacao',r.observacao,'criado_em',r.criado_em,
   'status',r.status,'authorizesPurchases',false,
   'itens',(
     select coalesce(jsonb_agg(
       item.value || jsonb_build_object(
         'descricao',catalogo.descricao,'tipo',catalogo.tipo,
         'grupo',catalogo.grupo,'area',catalogo.area,'conta',catalogo.conta
       ) order by item.ord),'[]'::jsonb)
     from jsonb_array_elements(r.itens) with ordinality as item(value,ord)
     left join public.compras_despesa_catalogo_237 catalogo
       on catalogo.codigo=item.value->>'codigo'
   )
 ) into payload
 from public.compras_cotacao_rascunhos r
 where r.id=p_id and r.tipo_pedido='Despesa/Investimento';
 return payload;
end;
$body$;

revoke all on function public.fn_compras_listar_despesas_rascunho_238(integer) from public,anon;
grant execute on function public.fn_compras_listar_despesas_rascunho_238(integer) to authenticated;
revoke all on function public.fn_compras_despesa_rascunho_detalhar_238(bigint) from public,anon;
grant execute on function public.fn_compras_despesa_rascunho_detalhar_238(bigint) to authenticated;
comment on function public.fn_compras_despesa_rascunho_detalhar_238(bigint)
  is 'Consulta de rascunhos de despesas/investimentos, não é pedido nem autorização financeira. Somente Master.';