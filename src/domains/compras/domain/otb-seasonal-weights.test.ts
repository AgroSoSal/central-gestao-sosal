import { describe, expect, it } from "vitest"
import { calculateOtbSeasonalWeights, excelOtbGroupKey } from "./otb-seasonal-weights"

describe("Zacarini 2.3.7 — pesos de venda sazonal da OTB", () => {
  it("reproduz BH:BP da linha Nutrição na fotografia da planilha 2.3.7", () => {
    // Entradas históricas: fx_VendaSubgrupo!A6:G9; D: OTB!D48:D51.
    // Saída de referência: OTB!BH48:BP49 (cache de cálculo do arquivo).
    const result = calculateOtbSeasonalWeights({
      minimumHistoricalSales: 5000,
      groups: [
        {line:1,name:"1.LINHA NUTRIÇÃO / MINERAL E PROTEICO",projected90Sales:3670048.3819983825},
        {line:1,name:"1.LINHA NUTRIÇÃO / NUCLEO E PREMIX",projected90Sales:389.5830115830116},
        {line:1,name:"1.LINHA NUTRIÇÃO / RA  O S  SAL",projected90Sales:0},
        {line:1,name:"1.LINHA NUTRIÇÃO / RAÇÃO SÓ SAL",projected90Sales:930239.1881451703},
      ],
      historical: [
        {line:1,name:"1.LINHA NUTRIÇÃO / MATERIA PRIMA",sales:[70285,59263,44435,35044]},
        {line:1,name:"1.LINHA NUTRIÇÃO / MINERAL E PROTEICO",sales:[3221151,3379136,3777908,3994738]},
        {line:1,name:"1.LINHA NUTRIÇÃO / NUCLEO E PREMIX",sales:[2860,2065,1835,705]},
        {line:1,name:"1.LINHA NUTRIÇÃO / RAÇÃO SÓ SAL",sales:[1475409,1379248,1287038,1447777]},
      ],
    })
    expect(result.state).toBe("calculado")
    if(result.state!=="calculado")return
    const mineral=result.groups[0]
    const nucleo=result.groups[1]
    expect(mineral.weights[0]).toBeCloseTo(0.6857942856667973,10)
    expect(mineral.weights[1]).toBeCloseTo(0.7100827073638482,10)
    expect(mineral.weights[2]).toBeCloseTo(0.7458293126421998,10)
    expect(mineral.weights[3]).toBeCloseTo(0.7339249473261159,10)
    expect(nucleo.weights[0]).toBeCloseTo(0.00008599091093416738,10)
  })

  it("usa vendas do mesmo trimestre anterior, piso de R$ 5 mil e normalização por linha", () => {
    const result = calculateOtbSeasonalWeights({
      minimumHistoricalSales: 5000,
      groups: [
        { line: 1, name: "1.LINHA / A", projected90Sales: 60 },
        { line: 1, name: "1.LINHA / B", projected90Sales: 40 },
      ],
      historical: [
        { line: 1, name: "1.LINHA / A", sales: [70000, 3000, 70000, 10000] },
        { line: 1, name: "1.LINHA / B", sales: [30000, 97000, 30000, 90000] },
      ],
    })
    expect(result.state).toBe("calculado")
    if (result.state !== "calculado") return
    const a = result.groups.find(g => g.name === "1.LINHA / A")!
    const b = result.groups.find(g => g.name === "1.LINHA / B")!
    expect(a.averageShare).toBeCloseTo(0.6)
    expect(a.weights[0]).toBeCloseTo(0.7)
    expect(a.weights[1]).toBeCloseTo(0.6 / (0.6 + 0.97))
    expect(a.weights[2]).toBeCloseTo(0.7)
    expect(a.weights[3]).toBeCloseTo(0.1)
    for (let month = 0; month < 4; month++) {
      expect(a.weights[month] + b.weights[month]).toBeCloseTo(1)
    }
  })

  it("rateia chaves históricas repetidas pela venda 90d como OTB!BL", () => {
    const result = calculateOtbSeasonalWeights({
      minimumHistoricalSales: 5000,
      groups: [
        { line: 3, name: "3.OUTROS / PEÇA-A", projected90Sales: 80 },
        { line: 3, name: "3.OUTROS / PEÇAA", projected90Sales: 20 },
      ],
      historical: [{ line: 3, name: "3.OUTROS / PEÇA-A", sales: [100000, 100000, 100000, 100000] }],
    })
    expect(excelOtbGroupKey("3.OUTROS / PEÇA-A")).toBe(excelOtbGroupKey("3.OUTROS / PEÇAA"))
    expect(result.state).toBe("calculado")
    if (result.state !== "calculado") return
    expect(result.groups[0].weights).toEqual([0.8, 0.8, 0.8, 0.8])
    expect(result.groups[1].weights).toEqual([0.2, 0.2, 0.2, 0.2])
  })

  it("separa zero comprovado de ausência de histórico e recusa dados incompletos", () => {
    const base = {
      minimumHistoricalSales: 5000,
      groups: [{ line: 2, name: "2.SAÚDE / A", projected90Sales: 100 }],
    } as const
    expect(calculateOtbSeasonalWeights({ ...base, historical: [] }).state).toBe("indisponivel")
    const result = calculateOtbSeasonalWeights({
      ...base, historical: [{ line: 2, name: "2.SAÚDE / A", sales: [0, 0, 0, 0] }],
    })
    expect(result.state).toBe("calculado")
    if (result.state === "calculado") expect(result.groups[0].weights).toEqual([1, 1, 1, 1])
    expect(calculateOtbSeasonalWeights({ ...base,
      historical: [{ line: 2, name: "2.SAÚDE / A", sales: [0, 0, Number.NaN, 0] }],
    }).state).toBe("indisponivel")
  })
})
