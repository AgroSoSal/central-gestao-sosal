
-- Plano operacional de liquidação da Zacarini 2.3.8: somente intenção do Master.
-- Nenhuma NF, transferência, estoque, valor ou data SISCOM é alterado.
create table if not exists public.compras_liquidacao_acoes_238 (
 id bigint generated always as identity primary key,
 filial text not null check (filial in ('BDS','CG','RIO','CX','PG','AN')),
 produto_codigo text not null check (length(produto_codigo) between 1 and 150),
 tipo_acao text not null check (tipo_acao in ('transferencia','liquidacao','revisao')),
 filial_destino text check (filial_destino is null or filial_destino in ('BDS','CG','RIO','CX','PG','AN')),
 meta_quantidade numeric(18,3) not null check (meta_quantidade>0 and meta_quantidade<=1000000000),
 responsavel text not null check (length(responsavel) between 1 and 120 and btrim(responsavel)=responsavel),
 data_limite date not null,
 situacao text not null check (situacao in ('Planejada','Em andamento','Concluída informada','Cancelada')),
 observacao text check (observacao is null or length(observacao)<=500),
 atualizado_por uuid not null,
 registrado_em timestamptz not null default now(),
 atualizado_em timestamptz not null default now(),
 constraint uq_compras_liquidacao_acoes_238 unique(filial,produto_codigo),
 constraint ck_compras_liquidacao_destino_238 check (
   (tipo_acao='transferencia' and filial_destino is not null and filial_destino<>filial)
   or (tipo_acao<>'transferencia' and filial_destino is null)
 )
);
alter table public.compras_liquidacao_acoes_238 enable row level security;
revoke all on table public.compras_liquidacao_acoes_238 from public,anon,authenticated;

create table if not exists public.compras_liquidacao_acoes_auditoria_238 (
 id bigint generated always as identity primary key,
 acao_id bigint not null references public.compras_liquidacao_acoes_238(id),
 antes jsonb,
 depois jsonb not null,
 alterado_por uuid not null,
 alterado_em timestamptz not null default now()
);
alter table public.compras_liquidacao_acoes_auditoria_238 enable row level security;
revoke all on table public.compras_liquidacao_acoes_auditoria_238 from public,anon,authenticated;

create or replace function public.fn_compras_liquidacao_acoes_listar_238(
 p_filial text default null,p_produto_codigo text default null,
 p_pagina integer default 1,p_tamanho integer default 30
)
returns jsonb
language plpgsql stable security definer set search_path='' set statement_timeout='4s'
as $body$
declare v_total bigint;v_itens jsonb;
begin
 if (select auth.uid()) is null or not exists(
   select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='master' and p.ativo
 ) then raise exception 'Master ativo obrigatório' using errcode='42501'; end if;
 if p_pagina is null or p_pagina not between 1 and 1000 or
   p_tamanho is null or p_tamanho not between 1 and 50 or
   (p_filial is not null and p_filial not in ('BDS','CG','RIO','CX','PG','AN')) or
   (p_produto_codigo is not null and length(p_produto_codigo)>150)
 then raise exception 'Filtros inválidos' using errcode='22023'; end if;
 select count(*) into v_total from public.compras_liquidacao_acoes_238 a
 where (p_filial is null or a.filial=p_filial)
 and (p_produto_codigo is null or a.produto_codigo=p_produto_codigo);
 select coalesce(jsonb_agg(to_jsonb(a) order by a.atualizado_em desc,a.id desc),'[]'::jsonb)
 into v_itens from (
   select id,filial,produto_codigo,tipo_acao,filial_destino,meta_quantidade,
    responsavel,data_limite,situacao,observacao,atualizado_em
   from public.compras_liquidacao_acoes_238
   where (p_filial is null or filial=p_filial)
   and (p_produto_codigo is null or produto_codigo=p_produto_codigo)
   order by atualizado_em desc,id desc
   limit p_tamanho offset (p_pagina-1)*p_tamanho
 ) a;
 return jsonb_build_object(
   'source','LIQUIDACAO_ACOES_238','status','planejamento_nao_executado',
   'authorizesTransfers',false,'total',v_total,'pagina',p_pagina,
   'tamanho',p_tamanho,'itens',v_itens
 );
end;
$body$;

create or replace function public.fn_compras_liquidacao_acao_salvar_238(
 p_filial text,p_produto_codigo text,p_tipo_acao text,
 p_filial_destino text,p_meta_quantidade numeric,
 p_responsavel text,p_data_limite date,p_situacao text,p_observacao text default null
)
returns bigint
language plpgsql security definer set search_path='' set statement_timeout='5s' set lock_timeout='2s'
as $body$
declare v_user uuid:=(select auth.uid());v_id bigint;v_before jsonb;v_after jsonb;
begin
 if v_user is null or not exists(
  select 1 from public.profiles p where p.id=v_user and p.role='master' and p.ativo
 ) then raise exception 'Master ativo obrigatório' using errcode='42501'; end if;
 if p_filial not in ('BDS','CG','RIO','CX','PG','AN') or
   p_produto_codigo is null or btrim(p_produto_codigo)<>p_produto_codigo or
   length(p_produto_codigo) not between 1 and 150 or
   p_tipo_acao not in ('transferencia','liquidacao','revisao') or
   (p_tipo_acao='transferencia' and
      (p_filial_destino is null or p_filial_destino=p_filial or p_filial_destino not in ('BDS','CG','RIO','CX','PG','AN'))) or
   (p_tipo_acao<>'transferencia' and p_filial_destino is not null) or
   p_meta_quantidade is null or p_meta_quantidade not between 0.001 and 1000000000 or
   p_meta_quantidade<>round(p_meta_quantidade,3) or
   p_responsavel is null or btrim(p_responsavel)<>p_responsavel or
   length(p_responsavel) not between 1 and 120 or
   p_data_limite is null or extract(year from p_data_limite) not between 2020 and 2100 or
   p_situacao not in ('Planejada','Em andamento','Concluída informada','Cancelada') or
   length(coalesce(p_observacao,''))>500
 then raise exception 'Plano de liquidação inválido' using errcode='22023'; end if;
 if not exists(select 1 from painel.produtos p where p.produto_cod=p_produto_codigo)
 then raise exception 'SKU não encontrado no catálogo SISCOM' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('liq|'||p_filial||'|'||p_produto_codigo));
 select a.id,to_jsonb(a) into v_id,v_before
 from public.compras_liquidacao_acoes_238 a
 where a.filial=p_filial and a.produto_codigo=p_produto_codigo for update;
 if v_id is null then
  insert into public.compras_liquidacao_acoes_238(
   filial,produto_codigo,tipo_acao,filial_destino,meta_quantidade,
   responsavel,data_limite,situacao,observacao,atualizado_por)
  values(p_filial,p_produto_codigo,p_tipo_acao,p_filial_destino,p_meta_quantidade,
   p_responsavel,p_data_limite,p_situacao,nullif(btrim(coalesce(p_observacao,'')),''),v_user)
  returning id into v_id;
 else
  update public.compras_liquidacao_acoes_238 a
  set tipo_acao=p_tipo_acao,filial_destino=p_filial_destino,meta_quantidade=p_meta_quantidade,
   responsavel=p_responsavel,data_limite=p_data_limite,situacao=p_situacao,
   observacao=nullif(btrim(coalesce(p_observacao,'')),''),atualizado_por=v_user,
   atualizado_em=now()
  where a.id=v_id;
 end if;
 select to_jsonb(a) into v_after from public.compras_liquidacao_acoes_238 a where a.id=v_id;
 insert into public.compras_liquidacao_acoes_auditoria_238(
  acao_id,antes,depois,alterado_por
 )values(v_id,v_before,v_after,v_user);
 return v_id;
end;
$body$;

revoke all on function public.fn_compras_liquidacao_acoes_listar_238(text,text,integer,integer) from public,anon;
grant execute on function public.fn_compras_liquidacao_acoes_listar_238(text,text,integer,integer) to authenticated;
revoke all on function public.fn_compras_liquidacao_acao_salvar_238(text,text,text,text,numeric,text,date,text,text) from public,anon;
grant execute on function public.fn_compras_liquidacao_acao_salvar_238(text,text,text,text,numeric,text,date,text,text) to authenticated;
comment on function public.fn_compras_liquidacao_acoes_listar_238(text,text,integer,integer)
is 'Ações planejadas de liquidação e transferência, sem execução em SISCOM, sem impacto financeiro.';
