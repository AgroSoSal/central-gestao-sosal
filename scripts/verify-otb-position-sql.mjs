import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const sql = readFileSync(new URL("../docs/compras/otb_posicao_subgrupos.sql", import.meta.url), "utf8")

test("posição de estoque e CMV consulta fontes oficiais sem alterar histórico", () => {
  assert.match(sql, /painel\.estoque/i)
  assert.match(sql, /painel\.vendas/i)
  assert.match(sql, /painel\.produtos/i)
  assert.match(sql, /v\.visao\s*=\s*'saida'/i)
  assert.doesNotMatch(sql, /\bdrop\b|\btruncate\b|\bdelete\s+from\b/i)
})

test("RPC protege acesso com Master ativo e não concede execução anônima", () => {
  assert.match(sql, /security definer/i)
  assert.match(sql, /pr\.role = 'master' and pr\.ativo = true/i)
  assert.match(sql, /revoke all on function public\.fn_otb_posicao_subgrupos\(date\) from public, anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.fn_otb_posicao_subgrupos\(date\) to authenticated/i)
})
