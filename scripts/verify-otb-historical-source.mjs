import test from "node:test"
import assert from "node:assert/strict"
import { interpretOtbHistoricalSource, lastClosedMonthInCampoGrande } from "../src/domains/compras/domain/otb-historical-source.ts"

function record(mes, visao, linha, registros = 10) {
  return { mes, visao, linha, venda_bruta: "100.50", cmv: "72.33", lucro: "28.17", registros: String(registros) }
}

test("agrupa competências, acompanha registros sem classificação e não presume saldo", () => {
  const status = interpretOtbHistoricalSource([
    record("2026-09-01", "saida", 1, 30),
    record("2026-09-01", "vendido", 1, 28),
    record("2026-10-01", "saida", 1, 20),
    record("2026-10-01", "vendido", 1, 18),
    record("2026-10-01", "vendido", 0, 3),
  ], null, "2026-10-01")
  assert.equal(status.status, "conectado")
  assert.equal(status.monthCount, 2)
  assert.equal(status.lastMonth, "2026-10-01")
  assert.equal(status.unmappedRecords, 3)
  assert.equal(status.totalRecords, 99)
  assert.equal(status.completeLast12Months, false)
})

test("somente 12 competências com duas visões e classificação completa liberam cobertura histórica", () => {
  const data = []
  for (let i = 0; i < 12; i++) {
    const date = new Date(Date.UTC(2025, 10 + i, 1)).toISOString().slice(0, 10)
    data.push(record(date, "saida", 1), record(date, "vendido", 1))
  }
  const status = interpretOtbHistoricalSource(data, null, "2026-10-01")
  assert.equal(status.status, "conectado")
  assert.equal(status.completeLast12Months, true)
  assert.equal(status.unmappedRecords, 0)
})

test("serviços explicitamente fora da OTB não bloqueiam cobertura nem entram na linha zero", () => {
  const data = []
  for (let i = 0; i < 12; i++) {
    const date = new Date(Date.UTC(2025, 10 + i, 1)).toISOString().slice(0, 10)
    data.push(record(date, "saida", 4), record(date, "vendido", 4))
  }
  data.push(record("2026-10-01", "saida", -1, 680), record("2026-10-01", "vendido", -1, 674))
  const status = interpretOtbHistoricalSource(data, null, "2026-10-01")
  assert.equal(status.status, "conectado")
  assert.equal(status.unmappedRecords, 0)
  assert.equal(status.excludedRecords, 1354)
  assert.equal(status.totalRecords, 1594)
  assert.equal(status.completeLast12Months, true)
})

test("visão ausente no último mês falha fechada para previsão", () => {
  const status = interpretOtbHistoricalSource([record("2026-10-01", "saida", 1)], null, "2026-10-01")
  assert.equal(status.status, "conectado")
  assert.equal(status.completeLast12Months, false)
})

test("resposta nula ou RPC sem autorização não afirma conexão", () => {
  assert.equal(interpretOtbHistoricalSource(null, null, "2026-10-01").status, "indisponivel")
  assert.equal(interpretOtbHistoricalSource([record("2026-10-01", "saida", 1)], { code: "42501" }, "2026-10-01").status, "indisponivel")
})

test("rejeita competência, visao, totais ou registros inválidos", () => {
  for (const malformed of [
    { ...record("2026-10-01", "saida", 1), mes: "2026-10-22" },
    { ...record("2026-10-01", "saida", 1), visao: "faturamento" },
    { ...record("2026-10-01", "saida", 1), registros: "NaN" },
    { ...record("2026-10-01", "saida", 1), cmv: null },
    { ...record("2026-10-01", "saida", 1), linha: 5 },
    { ...record("2026-10-01", "saida", 1), linha: -2 },
  ]) {
    assert.equal(interpretOtbHistoricalSource([malformed], null, "2026-10-01").status, "indisponivel")
  }
})

test("mês fechado em Campo Grande não inclui o mês corrente", () => {
  assert.equal(lastClosedMonthInCampoGrande(new Date("2026-11-17T12:00:00Z")), "2026-10-01")
  assert.equal(lastClosedMonthInCampoGrande(new Date("2027-01-01T03:30:00Z")), "2026-11-01")
})
