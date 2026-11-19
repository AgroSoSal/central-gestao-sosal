import { describe, expect, it } from "vitest"
import { calculateOwnProductionCost, calculateStockLiquidation, type StockLiquidationInput } from "./stock-liquidation"

const base: StockLiquidationInput = {
  stockQuantity: 100,
  stockCost: 1000,
  last90dQuantity: 20,
  nextYear90dQuantity: 5,
  growthFactor: 2,
  referenceDays: 90,
  limitDays: 60,
}

describe("Liq_Base da Zacarini 2.3.7", () => {
  it("usa o maior entre projeção sazonal e vendas recentes", () => {
    const result = calculateStockLiquidation(base)
    expect(result.forecast90d).toBe(20)
    expect(result.daysOfStock).toBe(450)
    expect(result.classification).toBe("excesso")
    expect(result.frozenValue).toBeCloseTo(866.666667, 4)
  })

  it("classifica sem giro quando a previsão é zero, sem dividir por zero", () => {
    expect(calculateStockLiquidation({ ...base, last90dQuantity: 0, nextYear90dQuantity: 0 })).toMatchObject({
      classification: "sem_giro", frozenValue: 1000, daysOfStock: null,
    })
  })

  it("mantém item regular abaixo do limite e não inventa valor parado", () => {
    expect(calculateStockLiquidation({ ...base, stockQuantity: 5, stockCost: 50 })).toMatchObject({
      classification: "regular", frozenValue: 0, daysOfStock: 22.5,
    })
  })

  it("protege exclusões e dados incompletos", () => {
    expect(calculateStockLiquidation({ ...base, excluded: true }).classification).toBe("excluido")
    expect(calculateStockLiquidation({ ...base, stockCost: null }).classification).toBe("indisponivel")
    expect(calculateStockLiquidation({ ...base, stockQuantity: 0 }).classification).toBe("sem_estoque")
  })

  it("não permite crescimento ilimitado ou parâmetro inválido", () => {
    expect(calculateStockLiquidation({ ...base, growthFactor: 9 }).forecast90d).toBe(20)
    expect(calculateStockLiquidation({ ...base, limitDays: 0 }).classification).toBe("indisponivel")
  })
})

describe("Produção Própria Zacarini 2.3.7", () => {
  it("converte quilogramas por unidade e R$/tonelada em R$/unidade", () => {
    expect(calculateOwnProductionCost(25, 200)).toBe(5)
    expect(calculateOwnProductionCost(30, 375)).toBe(11.25)
  })

  it("não transforma pesos/custos ausentes em zero aprovado", () => {
    expect(calculateOwnProductionCost(null, 200)).toBeNull()
    expect(calculateOwnProductionCost(25, null)).toBeNull()
    expect(calculateOwnProductionCost(-1, 200)).toBeNull()
  })
})
