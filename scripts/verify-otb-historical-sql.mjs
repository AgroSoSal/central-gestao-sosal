import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const sql = readFileSync(new URL("../docs/compras/otb_historico_mensal.sql", import.meta.url), "utf8")

test("a RPC verifica Master ativo no banco, antes de ler vendas", () => {
  assert.match(sql, /auth\.uid\(\)/)
  assert.match(sql, /p\.role\s*=\s*'master'/i)
  assert.match(sql, /p\.ativo\s*=\s*true/i)
  assert.match(sql, /security definer/i)
  assert.match(sql, /set search_path\s*=\s*''/i)
})

test("revoga execução pública e expõe só a RPC autenticada", () => {
  assert.match(sql, /revoke\s+all\s+on\s+function[^;]+from\s+public\s*,\s*anon/si)
  assert.match(sql, /grant\s+execute\s+on\s+function[^;]+to\s+authenticated/si)
})

test("conserva linhas sem classificação e usa as visões vendido e saída", () => {
  assert.match(sql, /left\s+join\s+painel\.produtos/i)
  assert.match(sql, /else\s+0/i)
  assert.match(sql, /v\.visao\s+in\s*\('vendido',\s*'saida'\)/i)
  assert.match(sql, /v\.custo_medio/i)
  assert.match(sql, /v\.lucro_medio/i)
})

test("não modifica dados históricos do SISCOM", () => {
  assert.doesNotMatch(sql, /\b(truncate|drop\s+table|delete\s+from|update\s+painel|insert\s+into\s+painel|alter\s+table)\b/i)
})
