import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const sql = readFileSync(new URL("../docs/compras/otb_classificacao_complementar.sql", import.meta.url), "utf8")

test("preserva cadastro SISCOM e protege complemento da exposição pública", () => {
  assert.match(sql, /create\s+table\s+if\s+not\s+exists\s+public\.otb_classificacao_complementar_produto/i)
  assert.match(sql, /enable\s+row\s+level\s+security/i)
  assert.match(sql, /revoke\s+all\s+on\s+table[^;]+from\s+public\s*,\s*anon\s*,\s*authenticated/i)
  assert.doesNotMatch(sql, /\b(update|delete\s+from|insert\s+into|alter\s+table)\s+painel\./i)
})

test("classificação explícita: serviços fora da OTB e fertilizante 104356 na linha 4", () => {
  assert.match(sql, /\('0',\s*'fora_otb',\s*null/i)
  assert.match(sql, /\('104356',\s*'linha',\s*4/i)
  assert.match(sql, /when\s+c\.categoria\s*=\s*'fora_otb'\s+then\s+-1/i)
  assert.match(sql, /when\s+c\.categoria\s*=\s*'linha'\s+then\s+c\.linha/i)
  assert.match(sql, /else\s+0/i)
})

test("RPC continua exigindo Master ativo e nega EXECUTE anônimo", () => {
  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.fn_otb_historico_mensal/i)
  assert.match(sql, /security\s+definer/i)
  assert.match(sql, /set\s+search_path\s*=\s*''/i)
  assert.match(sql, /auth\.uid\(\)/)
  assert.match(sql, /role\s*=\s*'master'/i)
  assert.match(sql, /revoke\s+all\s+on\s+function[^;]+from\s+public\s*,\s*anon/si)
})
