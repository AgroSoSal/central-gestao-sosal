import { describe, expect, it } from "vitest"
import { buildPartialCashSeries, type ContractedWeek } from "./dashboard-cash-contracts"
import type { BankPositionRow, ContractedMonth } from "./otb-bank-readiness"

const today = "2026-11-19"
const banks: BankPositionRow[] = [{
  conta_ref: "BDS 1234", filial: "Bandeirantes", banco: "PENDENTE_IDENTIFICACAO",
  data_corte_comum: "2026-11-11", data_ultimo_saldo: "2026-11-18",
  ultimo_saldo: 1300, data_saldo_base: "2026-11-11", saldo_base: 1000,
  data_arquivo: "2026-11-18", diferenca_arquivo: 0, conciliado: false,
}]
const weeks: ContractedWeek[] = Array.from({ length: 26 }, (_, i) => {
  const start = new Date("2026-11-19T12:00:00Z")
  start.setUTCDate(start.getUTCDate() + i * 7)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  return {
    inicio: start.toISOString().slice(0,10), fim: end.toISOString().slice(0,10),
    receber_identificado: 20, pagar_identificado: i === 1 ? 600 : 10,
    titulos_receber: 1, titulos_pagar: 1, ultima_importacao_pagar: "2026-11-19T12:00:00Z",
  }
})
const months: ContractedMonth[] = Array.from({ length: 12 }, (_, i) => {
  const start = new Date("2026-11-01T12:00:00Z")
  start.setUTCMonth(start.getUTCMonth() + i)
  return { mes: start.toISOString().slice(0,10), receber_identificado: 100,
    pagar_identificado: i === 1 ? 900 : 50, titulos_receber: 1, titulos_pagar: 1,
    saldo_contratado_identificado: 0, ultima_importacao_pagar: "2026-11-19T12:00:00Z" }
})

describe("caixa identificado · prévia informativa", () => {
  it("usa a mesma data-base bancária e acumula apenas os títulos conhecidos", () => {
    const r = buildPartialCashSeries(banks, weeks, months, today)
    expect(r.state).toBe("parcial")
    expect(r.base).toBe("2026-11-11")
    expect(r.openingCash).toBe(1000)
    expect(r.weeks[0]).toBe(1010)
    expect(r.weeks[1]).toBe(430)
    expect(r.minimum13).toBe(430)
    expect(r.end13).toBe(540)
    expect(r.months[0]).toBe(1050)
    expect(r.months[1]).toBe(250)
    expect(r.minimum12).toBe(250)
    expect(r.end12).toBe(750)
    expect(r.warning).toContain("sem vendas, folha, despesas e compras futuras")
  })
  it("não monta número quando fontes faltam, têm datas duplicadas ou totais inválidos", () => {
    expect(buildPartialCashSeries(banks, weeks.slice(0,25), months, today).state).toBe("indisponivel")
    expect(buildPartialCashSeries(banks, weeks, [months[0], ...months.slice(0,11)], today).state).toBe("indisponivel")
    expect(buildPartialCashSeries(banks, [{ ...weeks[0], pagar_identificado: -10 }, ...weeks.slice(1)], months, today).state).toBe("indisponivel")
    expect(buildPartialCashSeries([{ ...banks[0], diferenca_arquivo: 10 }], weeks, months, today).state).toBe("indisponivel")
  })
})
