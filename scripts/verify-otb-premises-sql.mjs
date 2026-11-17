import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const sql = readFileSync(new URL("../docs/compras/otb_premissas_financeiras_12m.sql", import.meta.url), "utf8")

test("premissas ficam em tabela adicional com histórico imutável", () => {
  assert.match(sql, /create table if not exists public\.otb_premissas_financeiras_12m/i)
  assert.match(sql, /criado_por uuid not null/i)
  assert.doesNotMatch(sql, /\btruncate\b|\bdrop\s+table\b|\bdelete\s+from\b/i)
})

test("RLS, RPC Master e grant de execução mínimos", () => {
  assert.match(sql, /enable row level security/i)
  assert.match(sql, /revoke all on public\.otb_premissas_financeiras_12m from public, anon, authenticated/i)
  assert.match(sql, /pr\.role = 'master' and pr\.ativo = true/i)
  assert.match(sql, /raise exception 'Acesso restrito ao Master ativo'/i)
  assert.match(sql, /grant execute on function public\.fn_otb_premissas_salvar\(date, numeric, numeric, text\) to authenticated/i)
  assert.doesNotMatch(sql, /grant execute[^;]+ to anon/i)
})
