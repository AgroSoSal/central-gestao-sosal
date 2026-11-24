import {describe,expect,it} from "vitest"
import {mergeOtbAbcStock238} from "./otb-abc-stock-merge-238"
import type {OtbAbcProjection} from "./otb-abc-projection-237"

const abc:OtbAbcProjection={
  state:"conectado",snapshotAt:"2026-11-24",pendingProductionCosts:0,
  groups:[{line:1,name:"MINERAL",projectedSales90:50000,projectedCmv90:36000,
    curveASales90:25000,skuCount:3,pendingProductionCosts:0},
    {line:2,name:"PRODUTO NOVO",projectedSales90:0,projectedCmv90:0,
    curveASales90:0,skuCount:1,pendingProductionCosts:0}],
}
describe("OTB 2.3.8: cruzamento estoque × ABC sem zeros artificiais",()=>{
  const stock=[
    {line:1,subgroup:"MINERAL",stockCost:10000,cmv90d:9000},
    {line:1,subgroup:"PROTEINADO",stockCost:15000,cmv90d:7000},
  ]
  it("preserva valores ABC existentes e campos indefinidos quando não existe correspondente",()=>{
    const result=mergeOtbAbcStock238(stock,abc)
    expect(result.missingAbc).toEqual(["Linha 1 · PROTEINADO"])
    expect(result.positions.find(x=>x.subgroup==="MINERAL")).toMatchObject({
      projectedSales90d:50000,projectedCmv90d:36000,stockCost:10000,
    })
    const missing=result.positions.find(x=>x.subgroup==="PROTEINADO")
    expect(missing).not.toHaveProperty("projectedSales90d")
    expect(missing).not.toHaveProperty("projectedCmv90d")
  })
  it("aceita zero apenas se ABC retornou o subgrupo explicitamente",()=>{
    const result=mergeOtbAbcStock238(stock,abc)
    expect(result.positions.find(x=>x.subgroup==="PRODUTO NOVO")).toMatchObject({
      stockCost:0,cmv90d:0,projectedSales90d:0,projectedCmv90d:0,
    })
  })
  it("se fonte ABC falhou, mantém o histórico sem criar valores projetados",()=>{
    const result=mergeOtbAbcStock238(stock,{state:"indisponivel",reason:"RPC indisponível",groups:[]})
    expect(result.positions).toEqual(stock)
    expect(result.missingAbc).toEqual([])
  })
})
