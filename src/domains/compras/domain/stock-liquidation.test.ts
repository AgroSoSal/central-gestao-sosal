import { describe, expect, it } from "vitest"
import { calculateBranchForecast90d, calculateOwnProductionCost, calculateStockLiquidation, liquidationHistoryByBranch, type StockLiquidationInput } from "./stock-liquidation"

describe("marcadores da planilha ABCEstoque_DDE!E5:G10", () => {
  it("usa apenas as quatro filiais indicadas na base comparável", () => {
    expect(Object.entries(liquidationHistoryByBranch).filter(([, rule]) => rule.comparable).map(([branch]) => branch).sort())
      .toEqual(["BDS", "CG", "PG", "RIO"])
    expect(liquidationHistoryByBranch.CX).toEqual({ comparable: false, basis: "ano_passado" })
    expect(liquidationHistoryByBranch.AN).toEqual({ comparable: false, basis: "ultimos_90d" })
  })

  it("aplica ano passado × crescimento com piso das vendas, mesmo sem base comparável do SKU", () => {
    expect(calculateBranchForecast90d("CX", 8, 12, 2)).toBe(24)
    expect(calculateBranchForecast90d("BDS", 30, 12, 2)).toBe(30)
  })

  it("para Anastácio utiliza sempre o giro recente sem multiplicar a sazonalidade", () => {
    expect(calculateBranchForecast90d("AN", 9, 120, 3)).toBe(9)
  })

  it("restringe o fator a 0–4 e rejeita dados ausentes/inválidos", () => {
    expect(calculateBranchForecast90d("PG", 0, 8, 12)).toBe(32)
    expect(calculateBranchForecast90d("RIO", 7, 8, -1)).toBe(7)
    expect(calculateBranchForecast90d("CG", NaN, 5, 1)).toBeNull()
    expect(calculateBranchForecast90d("CG", 5, -2, 1)).toBeNull()
  })
})

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
