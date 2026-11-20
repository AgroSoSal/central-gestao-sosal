import { describe, expect, it } from "vitest"
import { calculateOtb, type OtbInput, type OtbSubgroupInput } from "./otb-calculation"

const months = ["2026-12-01", "2027-01-01", "2027-02-01"] as const

function scenario(overrides: Partial<OtbInput> = {}): OtbInput {
  return {
    source: "Zacarini 2.3.7 — regressão",
    baseDate: "2026-11-07",
    months,
    cashCaps: [1_000_000, 1_000_000, 1_000_000],
    mpNeeds: [0, 0, 0],
    buyerShare: 0.9,
    subgroups: [],
    ...overrides,
  }
}

function row(overrides: Partial<OtbSubgroupInput> = {}): OtbSubgroupInput {
  return {
    line: "Saúde", name: "EQUINOS", kind: "S", openingStock: 0, priorOrders: 0,
    forecastCost: [100, 100, 100], targetStock: [0, 0, 0], curveAShare: 1,
    alreadyRecorded: [0, 0, 0], tiedSalesApproved: [0, 0, 0],
    ...overrides,
  }
}

describe("OTB de três meses segundo Gestão Zacarini", () => {
  it("reserva primeiro a matéria-prima e bloqueia mercadorias se faltar caixa", () => {
    const result = calculateOtb(scenario({
      cashCaps: [70, 70, 70], mpNeeds: [100, 0, 0], subgroups: [row()],
    }))
    expect(result.months[0].mpReleased).toBe(70)
    expect(result.months[0].releasedMerchandise).toBe(0)
    expect(result.months[0].cashStatus).toBe("TRAVADO")
  })

  it("prioriza curva A e divide a verba pelos 90%/10% de OTB!R24", () => {
    const result = calculateOtb(scenario({
      cashCaps: [1200, 1200, 1200],
      subgroups: [
        row({ name: "A", forecastCost: [1000, 0, 0] }),
        row({ name: "B", forecastCost: [1000, 0, 0], curveAShare: 0 }),
      ],
    }))
    expect(result.months[0].subgroups[0].released).toBeCloseTo(1000, 2)
    expect(result.months[0].subgroups[1].released).toBeCloseTo(200, 2)
    expect(result.months[0].buyerBudget).toBeCloseTo(1080, 2)
    expect(result.months[0].directorReserve).toBeCloseTo(120, 2)
  })

  it("inclui a matéria-prima S na governança 90/10 conforme OTB!P30 e Verba Comprador!E145", () => {
    const result = calculateOtb(scenario({
      cashCaps: [200, 200, 200],
      mpNeeds: [100, 0, 0],
      subgroups: [row({ forecastCost: [100, 0, 0] })],
    }))

    expect(result.months[0].mpReleased).toBe(100)
    expect(result.months[0].releasedMerchandise).toBe(100)
    expect(result.months[0].releasedTotal).toBe(200)
    expect(result.months[0].buyerBudget).toBe(180)
    expect(result.months[0].directorReserve).toBeCloseTo(20, 2)
    expect(result.months[1].buyerBudget).toBe(0)
  })

  it("carrega estoque de um mês ao seguinte", () => {
    const result = calculateOtb(scenario({ subgroups: [row({
      openingStock: 100, forecastCost: [60, 70, 80], targetStock: [100, 100, 100],
    })] }))
    expect(result.months.map((month) => month.needMerchandise)).toEqual([60, 70, 80])
  })

  it("repete as necessidades da linha 53 da planilha, com precisão centesimal", () => {
    const result = calculateOtb(scenario({ subgroups: [row({
      openingStock: 80710.13, priorOrders: 637.56, curveAShare: 0,
      forecastCost: [19426.64646680572, 19200.021043512712, 26974.452897016065],
      targetStock: [50990.681632285261, 1019.1178631866447 * 60, 884.59274475528025 * 60],
    })] }))
    const expected = [0, 18426.049301517109, 18902.945791134189]
    result.months.forEach((month, index) => expect(month.subgroups[0].need).toBeCloseTo(expected[index], 2))
  })

  it("não duplica compra para produção própria, MP e itens fora da OTB", () => {
    const result = calculateOtb(scenario({ subgroups: [
      row({ name: "P", kind: "P" }), row({ name: "M", kind: "M" }), row({ name: "N", kind: "N" }),
    ] }))
    expect(result.months.every((month) => month.needMerchandise === 0)).toBe(true)
  })

  it("aplica excesso ao saldo da linha, mas não ao saldo do subgrupo", () => {
    const result = calculateOtb(scenario({ subgroups: [row({
      forecastCost: [50, 0, 0], alreadyRecorded: [70, 0, 0], excess: [5, 0, 0],
    })] }))
    expect(result.months[0].subgroups[0].freeBalance).toBe(-20)
    expect(result.months[0].lines[0].freeBalance).toBe(-25)
  })

  it("recusa entradas incompletas e proporções erradas", () => {
    expect(() => calculateOtb(scenario({ buyerShare: 0.85 }))).toThrow(/90%/)
    expect(() => calculateOtb(scenario({ cashCaps: [Number.NaN, 100, 100] }))).toThrow()
    expect(() => calculateOtb(scenario({ subgroups: [row({ curveAShare: 1.5 })] }))).toThrow()
    expect(() => calculateOtb(scenario({ months: [months[1], months[0], months[2]] }))).toThrow()
  })
})
