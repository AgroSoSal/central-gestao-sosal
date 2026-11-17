import test from "node:test"
import assert from "node:assert/strict"
import { calculateWorstCaseOtbCaps } from "../src/domains/compras/domain/otb-cash-projection.ts"

const twelve = (number) => Array.from({ length: 12 }, () => number)
const model = (change = {}) => ({
  source: "Teste sintético — Projeção 12M",
  forecastStart: "2026-12-01",
  cashBuffer: 0,
  worstFreeCash: twelve(150),
  monthlyNeeds: [100, 100, 100],
  cumulativeDues: [twelve(100), twelve(100), twelve(100)],
  ...change,
})

test("prioriza verba do mês 1, depois mês 2 e finalmente mês 3", () => {
  const result = calculateWorstCaseOtbCaps(model())
  assert.deepEqual(result.factors, [1, 0.5, 0])
  assert.deepEqual(result.cashCaps, [100, 50, 0])
})

test("usa o menor caixa de cada mês até o fim do horizonte", () => {
  const cash = twelve(1000)
  cash[10] = 70
  const result = calculateWorstCaseOtbCaps(model({ worstFreeCash: cash, monthlyNeeds: [100, 0, 0], cumulativeDues: [twelve(100), twelve(0), twelve(0)] }))
  assert.equal(result.factors[0], 0.7)
  assert.equal(result.cashCaps[0], 70)
})

test("reserva caixa mínimo explícito, sem alterar as necessidades", () => {
  const result = calculateWorstCaseOtbCaps(model({ worstFreeCash: twelve(50), cashBuffer: 25 }))
  assert.deepEqual(result.factors, [0.75, 0, 0])
  assert.deepEqual(result.cashCaps, [75, 0, 0])
})

test("bloqueia as compras quando o pior caixa projetado é negativo", () => {
  const result = calculateWorstCaseOtbCaps(model({ worstFreeCash: twelve(-500) }))
  assert.deepEqual(result.factors, [0, 0, 0])
  assert.deepEqual(result.cashCaps, [0, 0, 0])
})

test("caixa suficiente libera integralmente os três meses", () => {
  const result = calculateWorstCaseOtbCaps(model({ worstFreeCash: twelve(10_000) }))
  assert.deepEqual(result.factors, [1, 1, 1])
  assert.deepEqual(result.cashCaps, [100, 100, 100])
})

test("não transforma premissas ausentes nem calendário inválido em zero", () => {
  assert.throws(() => calculateWorstCaseOtbCaps(model({ worstFreeCash: twelve(100).slice(0, 11) })), /12 meses/i)
  assert.throws(() => calculateWorstCaseOtbCaps(model({ monthlyNeeds: [100, null, 100] })), /necessidade/i)
  assert.throws(() => calculateWorstCaseOtbCaps(model({ cumulativeDues: [twelve(0), twelve(100), twelve(100)] })), /vencimentos/i)
  const nonmonotonic = twelve(100); nonmonotonic[5] = 20
  assert.throws(() => calculateWorstCaseOtbCaps(model({ cumulativeDues: [nonmonotonic, twelve(100), twelve(100)] })), /acumulado/i)
})
