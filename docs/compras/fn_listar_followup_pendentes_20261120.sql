-- Follow-up: paginação de APROVADOS com entrega pendente, após conciliação de NFs.
-- Nova RPC somente de leitura. Não modifica o histórico RPA, saldos, decisões,
-- índices ou public.fn_listar_pedidos_compra_conciliados.
-- Usa o mesmo algoritmo de recebimento da função de conciliação existente.
--
-- Proteções: JWT Master ativo, timeout, até 50 itens/página, grants explícitos.
-- Em bases sem aprovação, retorna um único registro de resumo com zero,
-- sem consultar o histórico do SISCOM.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_listar_followup_pendentes(
  p_busca text DEFAULT NULL,
  p_loja text DEFAULT NULL,
  p_inicio date DEFAULT NULL,
  p_fim date DEFAULT NULL,
  p_pagina integer DEFAULT 1,
  p_tamanho integer DEFAULT 50,
  p_codigos_genericos text[] DEFAULT ARRAY[]::text[]
)
RETURNS TABLE (
  loja text,
  pedido text,
  produto_codigo text,
  descricao text,
  fornecedor_nome text,
  fornecedor_codigo text,
  data_pedido date,
  quantidade numeric,
  quantidade_recebida numeric,
  quantidade_pendente numeric,
  valor_total numeric,
  valor_pendente numeric,
  situacao_recebimento text,
  total_itens bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET statement_timeout TO '5s'
SET lock_timeout TO '500ms'
AS $function$
DECLARE
  v_busca text := NULLIF(LEFT(BTRIM(p_busca), 90), '');
  v_loja text := NULLIF(BTRIM(p_loja), '');
  v_pagina integer := LEAST(GREATEST(COALESCE(p_pagina, 1), 1), 1000);
  v_tamanho integer := LEAST(GREATEST(COALESCE(p_tamanho, 50), 1), 50);
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'master' AND p.ativo = true
  ) THEN
    RAISE EXCEPTION 'Acesso restrito ao Master ativo' USING ERRCODE = '42501';
  END IF;

  -- Caminho rápido essencial: nenhuma decisão aprovada => nenhum acesso
  -- a v_rpa_pedidos_compra nem às notas fiscais.
  IF NOT EXISTS (
    SELECT 1 FROM public.compras_pedido_decisoes d
    WHERE d.decisao IN ('Aprovado', 'Já pago')
      AND (v_loja IS NULL OR d.loja = v_loja)
  ) THEN
    RETURN QUERY SELECT
      NULL::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text,
      NULL::date, NULL::numeric, NULL::numeric, NULL::numeric,
      NULL::numeric, NULL::numeric, NULL::text, 0::bigint;
    RETURN;
  END IF;

  RETURN QUERY
  WITH base AS MATERIALIZED (
    SELECT
      v.importacao_id, v.linha_excel, v.importado_em,
      v.loja, v.pedido, v.produto_codigo, v.descricao,
      v.fornecedor_nome, v.fornecedor_codigo, v.data_pedido,
      v.quantidade, v.custo_unitario,
      COALESCE(v.valor_total_calculado, v.valor_total_informado, 0::numeric) AS valor_total,
      COALESCE(v.quantidade, 0::numeric) AS qtde_pedida,
      UPPER(BTRIM(COALESCE(v.loja, ''))) AS loja_normalizada,
      UPPER(BTRIM(COALESCE(v.produto_codigo, ''))) AS produto_normalizado,
      UPPER(LEFT(BTRIM(COALESCE(v.fornecedor_nome, '')), 12)) AS fornecedor_prefixo,
      CASE UPPER(BTRIM(v.loja))
        WHEN 'SO SAL' THEN 'BDS'
        WHEN 'BANDEIRANTES' THEN 'BDS'
        WHEN 'CAMPO GRANDE' THEN 'CG'
        WHEN 'RIO VERDE' THEN 'RIO'
        WHEN 'COXIM' THEN 'CX'
        WHEN 'PEDRO GOMES' THEN 'PG'
        WHEN 'ANASTACIO' THEN 'AN'
        ELSE UPPER(BTRIM(v.loja))
      END AS filial_nf
    FROM "Só Sal".v_rpa_pedidos_compra v
    WHERE v_loja IS NULL OR v.loja = v_loja
  ),
  aprovados AS MATERIALIZED (
    SELECT b.*
    FROM base b
    JOIN public.compras_pedido_decisoes d
      ON (d.loja, d.pedido, d.produto_codigo) = (b.loja, b.pedido, b.produto_codigo)
    WHERE d.decisao IN ('Aprovado', 'Já pago')
      AND (p_inicio IS NULL OR b.data_pedido >= p_inicio)
      AND (p_fim IS NULL OR b.data_pedido <= p_fim)
      AND (
        v_busca IS NULL OR
        b.pedido ILIKE '%' || v_busca || '%' OR
        b.fornecedor_nome ILIKE '%' || v_busca || '%' OR
        b.fornecedor_codigo ILIKE '%' || v_busca || '%' OR
        b.produto_codigo ILIKE '%' || v_busca || '%' OR
        b.descricao ILIKE '%' || v_busca || '%'
      )
  ),
  calculada AS (
    SELECT
      a.*,
      CASE
        WHEN a.data_pedido IS NULL OR a.quantidade IS NULL OR
             a.custo_unitario IS NULL OR NULLIF(a.produto_normalizado, '') IS NULL
          THEN NULL::numeric
        WHEN a.produto_normalizado = ANY (
          ARRAY(SELECT UPPER(BTRIM(g)) FROM UNNEST(COALESCE(p_codigos_genericos, ARRAY[]::text[])) g)
        ) THEN 0::numeric
        ELSE GREATEST(0::numeric, LEAST(
          a.qtde_pedida,
          GREATEST(0::numeric, COALESCE(nfs.desde_pedido, 0::numeric)),
          GREATEST(0::numeric, COALESCE(nfs.desde_primeiro, 0::numeric) - COALESCE(anteriores.qtde_anterior, 0::numeric))
        ))
      END AS recebida
    FROM aprovados a
    LEFT JOIN LATERAL (
      SELECT
        MIN(other.data_pedido) AS primeiro_pedido,
        COALESCE(SUM(other.qtde_pedida) FILTER (
          WHERE other.data_pedido < a.data_pedido
             OR (other.data_pedido = a.data_pedido AND
                 (COALESCE(other.importacao_id, 0), COALESCE(other.linha_excel, 0)) <
                 (COALESCE(a.importacao_id, 0), COALESCE(a.linha_excel, 0)))
        ), 0::numeric) AS qtde_anterior
      FROM base other
      WHERE other.loja_normalizada = a.loja_normalizada
        AND other.produto_normalizado = a.produto_normalizado
        AND (
          a.fornecedor_prefixo = '' OR
          LEFT(UPPER(BTRIM(COALESCE(other.fornecedor_nome, ''))), LENGTH(a.fornecedor_prefixo)) = a.fornecedor_prefixo
        )
    ) anteriores ON true
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(nf.qtde) FILTER (WHERE nf.data >= a.data_pedido), 0::numeric) AS desde_pedido,
        COALESCE(SUM(nf.qtde) FILTER (WHERE nf.data >= anteriores.primeiro_pedido), 0::numeric) AS desde_primeiro
      FROM painel.compras nf
      WHERE nf.tipo = 'ent'
        AND UPPER(BTRIM(nf.filial)) = a.filial_nf
        AND UPPER(BTRIM(nf.produto_cod)) = a.produto_normalizado
        AND (
          a.fornecedor_prefixo = '' OR
          LEFT(UPPER(BTRIM(COALESCE(nf.fornecedor, ''))), LENGTH(a.fornecedor_prefixo)) = a.fornecedor_prefixo
        )
    ) nfs ON true
  ),
  pendentes AS MATERIALIZED (
    SELECT c.*
    FROM calculada c
    WHERE c.recebida IS NOT NULL
      AND c.qtde_pedida > c.recebida
  ),
  resumo AS (
    SELECT COUNT(*)::bigint AS total_itens FROM pendentes
  ),
  pagina AS (
    SELECT p.*
    FROM pendentes p
    ORDER BY p.data_pedido DESC NULLS LAST, p.importacao_id DESC,
             p.linha_excel DESC, p.loja, p.pedido, p.produto_codigo
    LIMIT v_tamanho OFFSET (v_pagina - 1) * v_tamanho
  )
  SELECT
    pg.loja, pg.pedido, pg.produto_codigo, pg.descricao,
    pg.fornecedor_nome, pg.fornecedor_codigo, pg.data_pedido,
    pg.quantidade, pg.recebida,
    CASE WHEN pg.recebida IS NULL THEN NULL::numeric ELSE GREATEST(0::numeric, pg.qtde_pedida - pg.recebida) END,
    pg.valor_total,
    CASE WHEN pg.recebida IS NULL THEN NULL::numeric ELSE GREATEST(0::numeric, pg.qtde_pedida - pg.recebida) * pg.custo_unitario END,
    CASE
      WHEN pg.recebida IS NULL THEN 'Dados incompletos'
      WHEN pg.recebida = 0 THEN 'Em aberto'
      WHEN pg.recebida >= pg.qtde_pedida THEN 'Já chegou – conferir/baixar'
      ELSE 'Chegada parcial'
    END,
    r.total_itens
  FROM resumo r
  LEFT JOIN pagina pg ON true
  ORDER BY pg.data_pedido DESC NULLS LAST, pg.importacao_id DESC,
           pg.linha_excel DESC, pg.loja, pg.pedido, pg.produto_codigo;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_listar_followup_pendentes(
  text, text, date, date, integer, integer, text[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_listar_followup_pendentes(
  text, text, date, date, integer, integer, text[]
) TO authenticated;

COMMENT ON FUNCTION public.fn_listar_followup_pendentes(
  text, text, date, date, integer, integer, text[]
) IS 'Follow-up Master read-only: aprovação e saldo conciliado antes da paginação; sem alteração de dados SISCOM/RPA.';

COMMIT;
