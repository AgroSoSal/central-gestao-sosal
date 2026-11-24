-- Consulta operacional somente leitura de entradas fiscais (sbCompras[tipo]="ent").
-- A planilha Zacarini 2.3.8 utiliza estes registros em Pedidos de Compra!L.
create or replace function public.fn_compras_listar_nfs_entrada_238(
 p_loja text default null,
 p_inicio date default null,
 p_fim date default null,
 p_busca text default null,
 p_pagina integer default 1,
 p_tamanho integer default 50
)
returns jsonb
language plpgsql stable security definer
set search_path=''
set statement_timeout='6s'
as $func$
declare
 v_filial text;
 v_total bigint;
 v_itens jsonb;
 v_busca text := nullif(btrim(p_busca),'');
begin
 if (select auth.uid()) is null or not exists (
   select 1 from public.profiles pr
   where pr.id=(select auth.uid()) and pr.role='master' and pr.ativo
 ) then raise exception 'Somente Master ativo pode consultar entradas fiscais' using errcode='42501'; end if;
 if p_pagina is null or p_pagina not between 1 and 1000
   or p_tamanho is null or p_tamanho not between 1 and 50
   or length(coalesce(v_busca,''))>90
   or (p_inicio is not null and p_fim is not null and p_fim<p_inicio)
 then raise exception 'Filtros inválidos' using errcode='22023'; end if;

 v_filial := case coalesce(nullif(btrim(p_loja),''),'')
   when '' then null
   when 'SO SAL' then 'BDS'
   when 'CAMPO GRANDE' then 'CG'
   when 'RIO VERDE' then 'RIO'
   when 'COXIM' then 'CX'
   when 'PEDRO GOMES' then 'PG'
   when 'ANASTACIO' then 'AN'
   else '__INVALIDO__'
 end;
 if v_filial='__INVALIDO__' then
   raise exception 'Filial inválida' using errcode='22023';
 end if;

 select count(*) into v_total
 from painel.compras n
 where n.tipo='ent'
   and (v_filial is null or upper(btrim(n.filial))=v_filial)
   and (p_inicio is null or n.data>=p_inicio)
   and (p_fim is null or n.data<=p_fim)
   and (v_busca is null or n.nf ilike '%'||v_busca||'%'
     or n.produto_cod ilike '%'||v_busca||'%'
     or n.fornecedor ilike '%'||v_busca||'%');

 select coalesce(jsonb_agg(to_jsonb(nf) order by nf.data desc,nf.nf desc,nf.produto_cod), '[]'::jsonb)
 into v_itens
 from (
   select n.data,n.filial,n.nf,n.produto_cod,n.fornecedor,
     n.qtde,n.valor,n.operacao,n.dev
   from painel.compras n
   where n.tipo='ent'
     and (v_filial is null or upper(btrim(n.filial))=v_filial)
     and (p_inicio is null or n.data>=p_inicio)
     and (p_fim is null or n.data<=p_fim)
     and (v_busca is null or n.nf ilike '%'||v_busca||'%'
       or n.produto_cod ilike '%'||v_busca||'%'
       or n.fornecedor ilike '%'||v_busca||'%')
   order by n.data desc nulls last,n.nf desc,n.produto_cod,n.fornecedor
   limit p_tamanho offset (p_pagina-1)*p_tamanho
 ) nf;
 return jsonb_build_object(
   'source','SISCOM_NF_ENTRADAS_238',
   'status','disponivel',
   'observacao','Listagem de linhas de notas fiscais com tipo ent. Não atribui NF a pedidos de compra nem altera o estoque.',
   'filial',v_filial,
   'total',v_total,'pagina',p_pagina,'tamanho',p_tamanho,
   'itens',v_itens
 );
end;
$func$;
revoke all on function public.fn_compras_listar_nfs_entrada_238(text,date,date,text,integer,integer)
 from public,anon;
grant execute on function public.fn_compras_listar_nfs_entrada_238(text,date,date,text,integer,integer)
 to authenticated;
comment on function public.fn_compras_listar_nfs_entrada_238(text,date,date,text,integer,integer)
 is 'Consulta operacional de linhas NF de entrada do SISCOM, somente Master. Fonte sbCompras da Zacarini 2.3.8. Nenhuma baixa ou gravação.';