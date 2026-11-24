-- Zacarini 2.3.8 / Pedidos de Compra!L12.
-- Apenas NFs candidatas; a formula original rateia NFs entre pedidos antigos.
create or replace function public.fn_compras_evidencias_nf_238(
  p_loja text, p_pedido text, p_produto_codigo text,
  p_pagina integer default 1, p_tamanho integer default 25
)
returns jsonb
language plpgsql stable security definer
set search_path=''
set statement_timeout='5s'
as $body$
declare v_pedido record; v_total bigint; v_items jsonb;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles pr
    where pr.id=(select auth.uid()) and pr.role='master' and pr.ativo
  ) then raise exception 'Acesso restrito ao Master ativo' using errcode='42501'; end if;

  if p_loja is null or btrim(p_loja)='' or length(p_loja)>100
    or p_pedido is null or btrim(p_pedido)='' or length(p_pedido)>100
    or p_produto_codigo is null or btrim(p_produto_codigo)='' or length(p_produto_codigo)>150
    or p_pagina is null or p_pagina not between 1 and 1000
    or p_tamanho is null or p_tamanho not between 1 and 50
  then raise exception 'Filtros inválidos para evidências de NFs' using errcode='22023'; end if;

  select a.loja,a.pedido,a.produto_codigo,a.descricao,a.fornecedor_nome,
         a.data_pedido,a.filial_nf,a.quantidade,a.quantidade_recebida,
         a.quantidade_pendente,a.situacao_recebimento,a.calculado_em
  into v_pedido
  from painel.alex_pedidos_em_aberto a
  where (a.loja,a.pedido,a.produto_codigo) = (p_loja,p_pedido,p_produto_codigo)
  order by a.calculado_em desc nulls last,a.importacao_id desc,a.linha_excel desc
  limit 1;

  if not found then
    raise exception 'Pedido não encontrado na carteira atual do Supabase' using errcode='22023';
  end if;

  -- Pedidos de Compra!H5:H7.
  if v_pedido.produto_codigo in ('545','105329') then
    return jsonb_build_object(
      'source','ZACARINI_238_NF_EVIDENCIAS',
      'status','codigo_generico','itens','[]'::jsonb,'total',0,
      'descricao','Código genérico excluído da conciliação de NFs pela planilha.');
  end if;

  select count(*) into v_total
  from painel.compras n
  where n.tipo='ent'
    and upper(btrim(n.filial))=upper(btrim(v_pedido.filial_nf))
    and upper(btrim(n.produto_cod))=upper(btrim(v_pedido.produto_codigo))
    and n.data>=v_pedido.data_pedido
    and (nullif(btrim(v_pedido.fornecedor_nome),'') is null
      or left(upper(btrim(coalesce(n.fornecedor,''))),12) =
         left(upper(btrim(v_pedido.fornecedor_nome)),12));

  select coalesce(jsonb_agg(to_jsonb(nfs) order by nfs.data desc,nfs.nf desc), '[]'::jsonb)
  into v_items
  from (
    select n.data,n.nf,n.filial,n.produto_cod,n.fornecedor,n.operacao,
           n.qtde,n.valor,n.dev
    from painel.compras n
    where n.tipo='ent'
      and upper(btrim(n.filial))=upper(btrim(v_pedido.filial_nf))
      and upper(btrim(n.produto_cod))=upper(btrim(v_pedido.produto_codigo))
      and n.data>=v_pedido.data_pedido
      and (nullif(btrim(v_pedido.fornecedor_nome),'') is null
        or left(upper(btrim(coalesce(n.fornecedor,''))),12) =
           left(upper(btrim(v_pedido.fornecedor_nome)),12))
    order by n.data desc,n.nf desc
    limit p_tamanho offset (p_pagina-1)*p_tamanho
  ) nfs;

  return jsonb_build_object(
    'source','ZACARINI_238_NF_EVIDENCIAS','status','disponivel',
    'criterio','Filial, SKU, data >= pedido, prefixo do fornecedor (12 caracteres). NFs são candidatas e NÃO demonstram vínculo exclusivo ao pedido.',
    'pedido',jsonb_build_object(
      'loja',v_pedido.loja,'pedido',v_pedido.pedido,
      'produto_codigo',v_pedido.produto_codigo,'descricao',v_pedido.descricao,
      'fornecedor_nome',v_pedido.fornecedor_nome,'data_pedido',v_pedido.data_pedido,
      'filial_nf',v_pedido.filial_nf,'quantidade',v_pedido.quantidade,
      'quantidade_recebida',v_pedido.quantidade_recebida,
      'quantidade_pendente',v_pedido.quantidade_pendente,
      'situacao_recebimento',v_pedido.situacao_recebimento,
      'calculado_em',v_pedido.calculado_em),
    'pagina',p_pagina,'tamanho',p_tamanho,'total',v_total,'itens',v_items
  );
end;
$body$;

revoke all on function public.fn_compras_evidencias_nf_238(text,text,text,integer,integer) from public,anon;
grant execute on function public.fn_compras_evidencias_nf_238(text,text,text,integer,integer) to authenticated;
comment on function public.fn_compras_evidencias_nf_238(text,text,text,integer,integer)
 is 'Evidências de NFs candidatas, conforme Pedidos de Compra!L12 Zacarini 2.3.8. Somente Master. Sem vinculo exclusivo a pedido ou escrita de NFs.';