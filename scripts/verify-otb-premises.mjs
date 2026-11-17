import test from "node:test"
import assert from "node:assert/strict"
import { validateOtbPremises } from "../src/domains/compras/domain/otb-premises.ts"

test("premissas válidas preservam reais e competência", () => {
  assert.deepEqual(validateOtbPremises({
    mes: "2026-12", saldo: "152000,50", reserva: "10000,25", observacao: "Conferido no financeiro",
  }), { forecastStart: "2026-12-01", openingCash: 152000.5, cashBuffer: 10000.25, notes: "Conferido no financeiro" })
})

test("sem saldo verificado não grava zero presumido", () => {
  assert.throws(() => validateOtbPremises({ mes: "2026-12", saldo: "", reserva: "100", observacao: "" }), /saldo inicial/i)
})

test("rejeita reserva negativa e valores malformados", () => {
  assert.throws(() => validateOtbPremises({ mes: "2026-12", saldo: "500", reserva: "-2", observacao: "" }), /reserva/i)
  assert.throws(() => validateOtbPremises({ mes: "2026-12", saldo: "12x", reserva: "100", observacao: "" }), /saldo inicial/i)
})

test("não aceita meses e observações inválidas", () => {
  assert.throws(() => validateOtbPremises({ mes: "2026-13", saldo: "500", reserva: "100", observacao: "" }), /competência/i)
  assert.throws(() => validateOtbPremises({ mes: "2026-12", saldo: "500", reserva: "100", observacao: "x".repeat(501) }), /observação/i)
})
