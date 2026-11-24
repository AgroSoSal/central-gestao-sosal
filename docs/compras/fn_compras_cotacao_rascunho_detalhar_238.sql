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
  from public.compras_cotacao_rascunhos r where r.id=p_id;

  return result;
end;
$function$

revoke all on function public.fn_compras_cotacao_rascunho_detalhar_238(bigint) from public,anon;
grant execute on function public.fn_compras_cotacao_rascunho_detalhar_238(bigint) to authenticated;
