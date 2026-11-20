import test from "node:test"
import assert from "node:assert/strict"
import { calculateOtb } from "../src/domains/compras/domain/otb-calculation.ts"

const months = ["2026-12-01", "2027-01-01", "2027-02-01"]
const base = (overrides = {}) => ({
  source: "Zacarini 2.3.7 — caso de teste sintético",
  baseDate: "2026-11-07",
  months,
  cashCaps: [1_000_000, 1_000_000, 1_000_000],
  mpNeeds: [0, 0, 0],
  buyerShare: 0.9,
  subgroups: [],
  ...overrides,
})

const subgroup = (overrides = {}) => ({
  line: "Saúde",
  name: "2.LINHA SAÚDE / EQUINOS",
  kind: "S",
  openingStock: 0,
  priorOrders: 0,
  forecastCost: [100, 100, 100],
  targetStock: [0, 0, 0],
  curveAShare: 1,
  alreadyRecorded: [0, 0, 0],
  tiedSalesApproved: [0, 0, 0],
  ...overrides,
})

test("prioriza matéria-prima no teto mensal antes de mercadorias", () => {
  const result = calculateOtb(base({
    cashCaps: [70, 70, 70], mpNeeds: [100, 0, 0],
    subgroups: [subgroup()],
  }))
  assert.equal(result.months[0].mpReleased, 70)
  assert.equal(result.months[0].releasedMerchandise, 0)
  assert.equal(result.months[0].releasedTotal, 70)
})

test("inclui a matéria-prima uma vez no rateio global 90/10", () => {
  const result = calculateOtb(base({
    cashCaps: [200, 200, 200], mpNeeds: [100, 0, 0],
    subgroups: [subgroup({ forecastCost: [100, 0, 0] })],
  }))
  assert.equal(result.months[0].mpReleased, 100)
  assert.equal(result.months[0].releasedMerchandise, 100)
  assert.equal(result.months[0].releasedTotal, 200)
  assert.equal(result.months[0].buyerBudget, 180)
  assert.ok(Math.abs(result.months[0].directorReserve - 20) < 0.01)
})

test("curva A vem antes de outras curvas e verba 90/10 soma 100%", () => {
  const result = calculateOtb(base({
    cashCaps: [1200, 1200, 1200],
    subgroups: [
      subgroup({ name: "Grupo A", forecastCost: [1000, 0, 0] }),
      subgroup({ name: "Grupo B", forecastCost: [1000, 0, 0], curveAShare: 0 }),
    ],
  }))
  assert.equal(result.months[0].releasedMerchandise, 1200)
  assert.equal(result.months[0].subgroups[0].released, 1000)
  assert.equal(result.months[0].subgroups[1].released, 200)
  assert.equal(result.months[0].buyerBudget, 1080)
  assert.ok(Math.abs(result.months[0].directorReserve - 120) < 0.01)
})

test("estoque do mês seguinte considera compras liberadas e custo consumido", () => {
  const result = calculateOtb(base({ subgroups: [subgroup({ openingStock: 100, forecastCost: [60, 70, 80], targetStock: [100, 100, 100] })] }))
  assert.deepEqual(result.months.map((month) => month.needMerchandise), [60, 70, 80])
  assert.deepEqual(result.months.map((month) => month.releasedMerchandise), [60, 70, 80])
})

test("repete linha 53 da planilha com os dados cacheados em seus três meses", () => {
  const result = calculateOtb(base({ subgroups: [subgroup({
    openingStock: 80710.13,
    priorOrders: 637.56,
    curveAShare: 0,
    forecastCost: [19426.64646680572, 19200.021043512712, 26974.452897016065],
    targetStock: [50990.681632285261, 1019.1178631866447 * 60, 884.59274475528025 * 60],
  })] }))
  const nearCent = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`)
  nearCent(result.months[0].subgroups[0].need, 0)
  nearCent(result.months[1].subgroups[0].need, 18426.049301517109)
  nearCent(result.months[2].subgroups[0].need, 18902.945791134189)
})

test("produção própria, matéria-prima direta e fora da OTB não duplicam mercadoria", () => {
  const result = calculateOtb(base({ subgroups: [
    subgroup({ kind: "P", name: "Produção própria" }),
    subgroup({ kind: "M", name: "Matéria-prima" }),
    subgroup({ kind: "N", name: "Fora do OTB" }),
  ] }))
  assert.ok(result.months.every((month) => month.needMerchandise === 0 && month.releasedMerchandise === 0))
})

test("saldo permanece negativo quando compras gravadas excedem a liberação", () => {
  const result = calculateOtb(base({ subgroups: [subgroup({ forecastCost: [50, 0, 0], alreadyRecorded: [70, 0, 0], excess: [5, 0, 0] })] }))
  assert.equal(result.months[0].subgroups[0].freeBalance, -20) // OTB!W48 = T48 + U48 - V48
  assert.equal(result.months[0].lines[0].freeBalance, -25) // saldo da linha deduz AV48
  assert.equal(result.months[0].freeBalance, -25) // total de mercadorias não inclui MP sem conciliação
})

test("recusa campos ausentes, meses desordenados e percentuais inválidos", () => {
  assert.throws(() => calculateOtb(base({ cashCaps: [null, 100, 100] })), /teto/i)
  assert.throws(() => calculateOtb(base({ months: [months[1], months[0], months[2]] })), /meses/i)
  assert.throws(() => calculateOtb(base({ subgroups: [subgroup({ curveAShare: 1.5 })] })), /curva A/i)
  assert.throws(() => calculateOtb(base({ buyerShare: 0.85 })), /90%/i)
  assert.throws(() => calculateOtb(base({ baseDate: "2026-02-31" })), /data-base/i)
})
