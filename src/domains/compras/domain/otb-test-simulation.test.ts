import { describe, expect, it } from "vitest"
import { buildOtbTestSimulation } from "./otb-test-simulation"
import type { OtbSubgroupPreview } from "./otb-subgroup-preview"

describe("OTB — simulação de teste sem homologação", () => {
  it("usa exemplos declarados quando as fontes não estão atualizadas, sem autorizar compras", () => {
    const simulation = buildOtbTestSimulation({
      baseDate: "2026-11-19", preview: null,
      cashCaps: [120_000, 150_000, 180_000], mpNeeds: [15_000, 20_000, 25_000],
    })

    expect(simulation.origin).toBe("exemplo")
    expect(simulation.authorizesPurchases).toBe(false)
    expect(simulation.result.months.map(month => month.month)).toEqual([
      "2026-12-01", "2027-01-01", "2027-02-01",
    ])
    expect(simulation.result.months[0].mpReleased).toBe(15_000)
    expect(simulation.result.months[0].releasedTotal).toBeLessThanOrEqual(120_000)
    expect(simulation.result.months[0].buyerBudget).toBeCloseTo(simulation.result.months[0].releasedTotal * 0.9)
    expect(simulation.result.months[0].directorReserve).toBeCloseTo(simulation.result.months[0].releasedTotal * 0.1)
    expect(simulation.result.months[0].subgroups.some(group => group.name.includes("Exemplo"))).toBe(true)
  })

  it("usa os grupos conhecidos do Supabase sem presumir pedidos gravados ou valores homologados", () => {
    const preview: OtbSubgroupPreview = {
      state: "calculado", authorizesPurchases: false, seasonality: "cmv_90d",
      months: ["2026-12-01", "2027-01-01", "2027-02-01"],
      unmatchedPlanGroups: [], reconciledPlanGroups: [], totals: { 1: [70, 80, 90] },
      rows: [{
        line: 1, name: "1.LINHA / SAL MINERAL", kind: "S", stockCost: 10,
        cmv90d: 150, share: 1, projectedSales90d: null, projectedCmv90d: null,
        curveAShare: null, seasonalWeights: null, targets: [], issue: null,
        months: [
          { month: "2026-12-01", openingStock: 10, forecastCost: 60, targetStock: 20, need: 70, closingStock: 20 },
          { month: "2027-01-01", openingStock: 20, forecastCost: 80, targetStock: 20, need: 80, closingStock: 20 },
          { month: "2027-02-01", openingStock: 20, forecastCost: 90, targetStock: 20, need: 90, closingStock: 20 },
        ],
      }, {
        line: 2, name: "2.LINHA / INCOMPLETO", kind: "S", stockCost: 5,
        cmv90d: null, share: null, projectedSales90d: null, projectedCmv90d: null,
        curveAShare: null, seasonalWeights: null, targets: [], issue: "DDE ausente", months: null,
      }],
    }
    const simulation = buildOtbTestSimulation({
      baseDate: "2026-11-19", preview,
      cashCaps: [50, 50, 50], mpNeeds: [20, 20, 20],
    })

    expect(simulation.origin).toBe("previa_supabase")
    expect(simulation.excludedGroups).toBe(1)
    expect(simulation.assumedCurveAGroups).toBe(1)
    expect(simulation.result.months[0].subgroups).toHaveLength(1)
    expect(simulation.result.months[0].subgroups[0]).toMatchObject({
      name: "1.LINHA / SAL MINERAL", openingStock: 10, forecastCost: 60,
      recorded: 0, tiedSales: 0,
    })
    expect(simulation.result.months[0].mpReleased).toBe(20)
    expect(simulation.result.months[0].releasedMerchandise).toBeCloseTo(30)
    expect(simulation.authorizesPurchases).toBe(false)
  })

  it("rejeita tetos inválidos e mantém os três meses consecutivos na virada do ano", () => {
    expect(() => buildOtbTestSimulation({
      baseDate: "2026-12-31", preview: null,
      cashCaps: [Number.NaN, 0, 0], mpNeeds: [0, 0, 0],
    })).toThrow(/teto de caixa/i)
    const simulation = buildOtbTestSimulation({
      baseDate: "2026-12-31", preview: null,
      cashCaps: [0, 0, 0], mpNeeds: [0, 0, 0],
    })
    expect(simulation.result.months.map(month => month.month)).toEqual([
      "2027-01-01", "2027-02-01", "2027-03-01",
    ])
    expect(simulation.result.months[0].releasedTotal).toBe(0)
  })
})
