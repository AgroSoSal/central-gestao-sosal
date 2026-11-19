import { describe, expect, it } from "vitest"
import { calculateOtbAbcSku, interpretOtbAbcProjection } from "./otb-abc-projection-237"

describe("ABCEstoque_DDE 2.3.7 — projeção de venda por SKU", () => {
  it("reproduz produto comparável, base do ano anterior e preço/margem atuais", () => {
    const x = calculateOtbAbcSku({qty90:1837,sales90:729321.8,cost90:604223.05,
      priorNextQty:3251,newStoreQty90:0,priorNextSales:0,priorNextCost:0,
      productGrowth:0.6491092176607282,subgroupGrowth:1.1315485362095532,productionUnitCost:0})
    expect(x.growthSource).toBe("Produto")
    expect(x.projectedQty).toBeCloseTo(2110.254066615027)
    expect(x.projectedSales90).toBeCloseTo(837808.5434518191)
    expect(x.projectedGross90).toBeCloseTo(143707.21062381973)
  })

  it("usa crescimento do subgrupo, limita em quatro e preserva a base Anastácio", () => {
    const x = calculateOtbAbcSku({qty90:30,sales90:55950,cost90:45349.7,
      priorNextQty:274,newStoreQty90:12,priorNextSales:0,priorNextCost:0,
      productGrowth:null,subgroupGrowth:3.7359964019952576,productionUnitCost:0})
    expect(x.growthSource).toBe("Subgrupo")
    expect(x.projectedQty).toBeCloseTo(274*3.7359964019952576+12)
    expect(x.projectedSales90).toBeCloseTo((274*3.7359964019952576+12)*1865)
    expect(calculateOtbAbcSku({...{
      qty90:10,sales90:100,cost90:60,priorNextQty:10,newStoreQty90:0,
      priorNextSales:0,priorNextCost:0,productGrowth:8,subgroupGrowth:2,productionUnitCost:0,
    }}).growth).toBe(4)
  })

  it("projeta pelo preço do ano anterior quando não houve venda em 90 dias e não inventa dados", () => {
    const x = calculateOtbAbcSku({qty90:0,sales90:0,cost90:0,priorNextQty:10,
      newStoreQty90:0,priorNextSales:120,priorNextCost:75,
      productGrowth:null,subgroupGrowth:null,productionUnitCost:2})
    expect(x.growthSource).toBe("Sem histórico")
    expect(x.projectedQty).toBe(10)
    expect(x.projectedSales90).toBe(120)
    expect(x.projectedGross90).toBe(25)
  })

  it("bloqueia RPC parcial, repetida ou com contagem incorreta", () => {
    const rows=[{linha:1,grupo_subgrupo:"1.LINHA / A",venda_projetada_90d:"1000",
      cmv_projetado_90d:"600",venda_curva_a_90d:"700",skus:2,data_fim:"2026-11-18",custos_producao_pendentes:0}]
    expect(interpretOtbAbcProjection(rows,null).state).toBe("conectado")
    expect(interpretOtbAbcProjection([...rows,...rows],null).state).toBe("indisponivel")
    expect(interpretOtbAbcProjection([{...rows[0],venda_curva_a_90d:"1100"}],null).state).toBe("indisponivel")
    expect(interpretOtbAbcProjection(rows,{message:"permission denied"}).state).toBe("indisponivel")
  })
})
