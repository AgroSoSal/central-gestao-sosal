import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const dashboard = readFileSync(new URL("../src/components/compras/otb-dashboard.tsx", import.meta.url), "utf8")

test("OTB não recebe cenários por upload ou JSON local", () => {
  assert.doesNotMatch(dashboard, /importScenario|FileJson|Upload|type="file"|\.text\(\)|JSON\.parse/)
  assert.doesNotMatch(dashboard, /Importar cenário JSON|Cenário local de homologação/)
})

test("OTB deixa explícito Supabase como fonte única", () => {
  assert.match(dashboard, /Somente Supabase/)
  assert.match(dashboard, /fonte oficial do Supabase/)
})
