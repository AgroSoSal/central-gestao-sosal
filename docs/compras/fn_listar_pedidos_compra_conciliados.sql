-- Pedidos de compra: consulta protegida, exclusivamente de leitura.
-- Aprovada pelo responsável do projeto em 16/11/2026.
-- Não altera tabelas, views, histórico de RPA ou função de consulta anterior.
-- O banco executa a conciliação para a página após considerar TODOS os pedidos
-- do mesmo produto/filial/fornecedor, evitando duplicidade na paginação.
BEGIN;

CREATE OR REPLACE FUNCTION public.fn_listar_pedidos_compra_conciliados(
  p_busca text DEFAULT NULL,
  p_loja text DEFAULT NULL,
  p_inicio date DEFAULT NULL,
  p_fim date DEFAULT NULL,
  p_pagina integer DEFAULT 1,
  p_tamanho integer DEFAULT 25,
  p_codigos_genericos text[] DEFAULT ARRAY[]::text[]
)
RETURNS TABLE (
  importacao_id bigint,
  linha_excel integer,
  importado_em timestamptz,
  loja text,
  fornecedor_codigo text,
  fornecedor_nome text,
  pedido text,
  data_pedido date,
  condicao_pagamento text,
  produto_codigo text,
  descricao text,
  quantidade numeric,
  custo_unitario numeric,
  valor_total numeric,
  quantidade_recebida numeric,
  quantidade_pendente numeric,
  valor_pendente numeric,
  situacao_recebimento text,
  total_itens bigint,
  total_pedidos bigint,
  soma_total numeric,
  ultima_importacao timestamptz,
  ultima_entrada date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_busca text := NULLIF(LEFT(BTRIM(p_busca), 90), '');
  v_loja text := NULLIF(BTRIM(p_loja), '');
  v_pagina integer := LEAST(GREATEST(COALESCE(p_pagina, 1), 1), 1000);
  v_tamanho integer := LEAST(GREATEST(COALESCE(p_tamanho, 25), 1), 100);
BEGIN
  -- Necessário porque os dados de notas são privados e não têm GRANT ao
  -- authenticated. SECURITY DEFINER nunca pode suprimir esta verificação.
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = auth.uid() AND p.role = 'master' AND p.ativo = true
  ) THEN
    RAISE EXCEPTION 'Acesso negado ao modulo Compras'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    WITH base AS MATERIALIZED (
      SELECT
        v.importacao_id,
        v.linha_excel,
        v.importado_em,
        v.loja,
        v.fornecedor_codigo,
        v.fornecedor_nome,
        v.pedido,
        v.data_pedido,
        v.condicao_pagamento,
        v.produto_codigo,
        v.descricao,
        v.quantidade,
        v.custo_unitario,
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
      FROM "Só Sal".v_rpa_pedidos_compra AS v
    ),
    filtrada AS MATERIALIZED (
      SELECT b.*
      FROM base AS b
      WHERE (v_loja IS NULL OR b.loja = v_loja)
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
    resumo AS (
      SELECT
        COUNT(*)::bigint AS total_itens,
        COUNT(DISTINCT (f.loja, f.pedido))::bigint AS total_pedidos,
        COALESCE(SUM(f.valor_total), 0::numeric) AS soma_total,
        MAX(f.importado_em) AS ultima_importacao
      FROM filtrada AS f
    ),
    pagina AS MATERIALIZED (
      SELECT f.*
      FROM filtrada AS f
      ORDER BY f.data_pedido DESC NULLS LAST,
               f.importacao_id DESC,
               f.linha_excel DESC
      LIMIT v_tamanho OFFSET (v_pagina - 1) * v_tamanho
    ),
    calculada AS (
      SELECT
        pg.*,
        CASE
          WHEN pg.data_pedido IS NULL OR pg.quantidade IS NULL OR
               pg.custo_unitario IS NULL OR NULLIF(pg.produto_normalizado, '') IS NULL
            THEN NULL::numeric
          WHEN pg.produto_normalizado = ANY (
            ARRAY(SELECT UPPER(BTRIM(g)) FROM UNNEST(COALESCE(p_codigos_genericos, ARRAY[]::text[])) AS g)
          ) THEN 0::numeric
          ELSE GREATEST(0::numeric, LEAST(
            pg.qtde_pedida,
            GREATEST(0::numeric, COALESCE(nfs.desde_pedido, 0::numeric)),
            GREATEST(0::numeric, COALESCE(nfs.desde_primeiro, 0::numeric) - COALESCE(anteriores.qtde_anterior, 0::numeric))
          ))
        END AS recebida
      FROM pagina AS pg
      LEFT JOIN LATERAL (
        SELECT
          MIN(other.data_pedido) AS primeiro_pedido,
          COALESCE(SUM(other.qtde_pedida) FILTER (
            WHERE other.data_pedido < pg.data_pedido
               OR (other.data_pedido = pg.data_pedido AND
                   (COALESCE(other.importacao_id, 0), COALESCE(other.linha_excel, 0)) <
                   (COALESCE(pg.importacao_id, 0), COALESCE(pg.linha_excel, 0)))
          ), 0::numeric) AS qtde_anterior
        FROM base AS other
        WHERE other.loja_normalizada = pg.loja_normalizada
          AND other.produto_normalizado = pg.produto_normalizado
          AND (
            pg.fornecedor_prefixo = '' OR
            LEFT(UPPER(BTRIM(COALESCE(other.fornecedor_nome, ''))), LENGTH(pg.fornecedor_prefixo)) = pg.fornecedor_prefixo
          )
      ) AS anteriores ON true
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(nf.qtde) FILTER (WHERE nf.data >= pg.data_pedido), 0::numeric) AS desde_pedido,
          COALESCE(SUM(nf.qtde) FILTER (WHERE nf.data >= anteriores.primeiro_pedido), 0::numeric) AS desde_primeiro
        FROM painel.compras AS nf
        WHERE nf.tipo = 'ent'
          AND UPPER(BTRIM(nf.filial)) = pg.filial_nf
          AND UPPER(BTRIM(nf.produto_cod)) = pg.produto_normalizado
          AND (
            pg.fornecedor_prefixo = '' OR
            LEFT(UPPER(BTRIM(COALESCE(nf.fornecedor, ''))), LENGTH(pg.fornecedor_prefixo)) = pg.fornecedor_prefixo
          )
      ) AS nfs ON true
    )
    SELECT
      pg.importacao_id,
      pg.linha_excel,
      pg.importado_em,
      pg.loja,
      pg.fornecedor_codigo,
      pg.fornecedor_nome,
      pg.pedido,
      pg.data_pedido,
      pg.condicao_pagamento,
      pg.produto_codigo,
      pg.descricao,
      pg.quantidade,
      pg.custo_unitario,
      pg.valor_total,
      pg.recebida AS quantidade_recebida,
      CASE WHEN pg.recebida IS NULL THEN NULL ELSE GREATEST(0::numeric, pg.qtde_pedida - pg.recebida) END AS quantidade_pendente,
      CASE WHEN pg.recebida IS NULL THEN NULL ELSE GREATEST(0::numeric, pg.qtde_pedida - pg.recebida) * pg.custo_unitario END AS valor_pendente,
      CASE
        WHEN pg.importacao_id IS NULL THEN NULL
        WHEN pg.recebida IS NULL THEN 'Dados incompletos'
        WHEN pg.recebida = 0 THEN 'Em aberto'
        WHEN pg.recebida >= pg.qtde_pedida THEN 'Já chegou – conferir/baixar'
        ELSE 'Chegada parcial'
      END AS situacao_recebimento,
      r.total_itens,
      r.total_pedidos,
      r.soma_total,
      r.ultima_importacao,
      (SELECT MAX(n.data) FROM painel.compras AS n WHERE n.tipo = 'ent') AS ultima_entrada
    FROM resumo AS r
    LEFT JOIN calculada AS pg ON true
    ORDER BY pg.data_pedido DESC NULLS LAST,
             pg.importacao_id DESC,
             pg.linha_excel DESC;
END;
$function$;

-- Ao contrário do privilégio padrão em funções novas, ninguém herda EXECUTE
-- via PUBLIC/anon. Somente authenticated pode chamar; a função exige Master.
REVOKE ALL ON FUNCTION public.fn_listar_pedidos_compra_conciliados(
  text, text, date, date, integer, integer, text[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_listar_pedidos_compra_conciliados(
  text, text, date, date, integer, integer, text[]
) TO authenticated;

COMMENT ON FUNCTION public.fn_listar_pedidos_compra_conciliados(
  text, text, date, date, integer, integer, text[]
) IS 'Consulta read-only de pedidos e notas de entrada, protegida por Master ativo; COMP-001..008.';

COMMIT;
