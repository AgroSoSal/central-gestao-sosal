import test from "node:test"
import assert from "node:assert/strict"
import { interpretOtbPurchaseSource } from "../src/domains/compras/domain/otb-source-status.ts"

test("conectado quando a RPC confirma total e última importação válidos", () => {
  const value = interpretOtbPurchaseSource([{
    total_itens: "135", ultima_importacao: "2026-11-17T12:20:42.000Z",
  }], null)
  assert.equal(value.status, "conectado")
  assert.equal(value.itemCount, 135)
  assert.equal(value.lastImportedAt, "2026-11-17T12:20:42.000Z")
})

test("falha da RPC não gera falso zero nem valores operacionais", () => {
  const value = interpretOtbPurchaseSource([{ total_itens: 135, ultima_importacao: "2026-11-17T12:20:42.000Z" }], { message: "sem permissão" })
  assert.equal(value.status, "indisponivel")
  assert.equal(value.itemCount, null)
  assert.equal(value.lastImportedAt, null)
})

test("resultado vazio não significa zero pedidos", () => {
  const value = interpretOtbPurchaseSource([], null)
  assert.equal(value.status, "indisponivel")
  assert.equal(value.itemCount, null)
})

test("recusa cabeçalho parcial sem data de importação", () => {
  const value = interpretOtbPurchaseSource([{ total_itens: 135, ultima_importacao: null }], null)
  assert.equal(value.status, "indisponivel")
})
