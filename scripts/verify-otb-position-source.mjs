import test from "node:test"
import assert from "node:assert/strict"
import { interpretOtbStockPosition } from "../src/domains/compras/domain/otb-position-source.ts"

const row = {
  linha: 1, grupo_subgrupo: "1.LINHA NUTRIÇÃO / RAÇÃO",
  estoque_custo: "65000.55", cmv_90d: "45000.00", sku_count: 12,
  ultima_atualizacao: "2026-11-17T06:09:52.000Z",
}

test("posições reais em estoque calculam DDE observado sem inventar meta", () => {
  const result = interpretOtbStockPosition([row], null)
  assert.equal(result.status, "conectado")
  assert.equal(result.stockCost, 65000.55)
  assert.equal(result.subgroups[0].observedDde, 130.0011)
  assert.equal(result.subgroups[0].skuCount, 12)
})

test("sem CMV registrado mantém DDE indisponível em vez de zero", () => {
  const result = interpretOtbStockPosition([{ ...row, cmv_90d: "0" }], null)
  assert.equal(result.status, "conectado")
  assert.equal(result.subgroups[0].observedDde, null)
})

test("rejeita saída parcial, duplicada, categoria inválida e resposta sem fonte", () => {
  assert.equal(interpretOtbStockPosition([row, row], null).status, "indisponivel")
  assert.equal(interpretOtbStockPosition([{ ...row, linha: 9 }], null).status, "indisponivel")
  assert.equal(interpretOtbStockPosition([{ ...row, estoque_custo: "abc" }], null).status, "indisponivel")
  assert.equal(interpretOtbStockPosition([row], { code: "42501" }).status, "indisponivel")
  assert.equal(interpretOtbStockPosition([], null).status, "indisponivel")
})
