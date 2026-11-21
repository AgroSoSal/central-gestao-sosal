import { describe, expect, it } from "vitest"
import { rankSuppliersByNeed, type SupplierPriorityItem } from "./supplier-priority-237"

const item = (overrides:Partial<SupplierPriorityItem>):SupplierPriorityItem => ({
  code:"100",supplier:"Alfa",line:1,stock:30,sales90d:90,suggestedQuantity:5,lastCost:10,
  ...overrides,
})

describe("COMP-058 — pré-ranking dos fornecedores encontrados",()=>{
  it("prioriza mais SKUs com estoque real inferior a 30 dias, preservando o valor referencial",()=>{
    const result=rankSuppliersByNeed([
      item({code:"A1",supplier:"Alfa",stock:2,suggestedQuantity:5,lastCost:10}),
      item({code:"A2",supplier:"Alfa",stock:70,suggestedQuantity:2,lastCost:20}),
      item({code:"B1",supplier:"Beta",stock:0,suggestedQuantity:3,lastCost:8}),
      item({code:"B2",supplier:"Beta",stock:1,suggestedQuantity:8,lastCost:7}),
    ])
    expect(result.map(x=>x.supplier)).toEqual(["Beta","Alfa"])
    expect(result[0]).toMatchObject({skuCount:2,urgentCount:2,unverifiedCount:0,
      suggestedUnits:11,referenceValue:80})
    expect(result[1]).toMatchObject({skuCount:2,urgentCount:1,unverifiedCount:0,
      suggestedUnits:7,referenceValue:90})
  })

  it("não transforma ausência de venda, estoque, sugestão ou custo em zero",()=>{
    const result=rankSuppliersByNeed([
      item({code:"A1",supplier:"Alfa",stock:2,suggestedQuantity:5,lastCost:10}),
      item({code:"A2",supplier:"Alfa",sales90d:null,stock:null,suggestedQuantity:null,lastCost:null}),
      item({code:"X",supplier:null,stock:0,suggestedQuantity:0,lastCost:12}),
    ])
    expect(result[0]).toMatchObject({supplier:"Alfa",urgentCount:1,unverifiedCount:1,
      suggestedUnits:null,referenceValue:null})
    expect(result[1]).toMatchObject({supplier:null,unverifiedCount:1,
      suggestedUnits:null,referenceValue:null})
  })

  it("aceita venda real zero como ausência de giro, sem inventar cobertura ou urgência",()=>{
    const result=rankSuppliersByNeed([item({sales90d:0,stock:40,suggestedQuantity:0})])
    expect(result[0]).toMatchObject({urgentCount:0,unverifiedCount:0,suggestedUnits:0,referenceValue:0})
  })

  it("não inclui serviço ou custo negativo como compra elegível",()=>{
    const result=rankSuppliersByNeed([
      item({code:"A1",line:5}),item({code:"A2",lastCost:-10}),
    ])
    expect(result[0]).toMatchObject({unverifiedCount:2,suggestedUnits:null,referenceValue:null})
  })
})
