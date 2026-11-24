import { describe, expect, it } from "vitest"
import { buildZacarini238CumulativeDues, buildOtbAutomaticReference238 } from "./otb-automatic-reference-238"
import type { OtbSubgroupPreview } from "./otb-subgroup-preview"
import type { CashForecastResult } from "./zacarini-cash-forecast"
import type { DashboardReferenceRow } from "./dashboard-zacarini-237"

const months=Array.from({length:12},(_,i)=>new Date(Date.UTC(2026,10+i,1)).toISOString().slice(0,10))
const paymentDays=[47,73,78,146]
const workbook:readonly (readonly number[])[]=[
  [1565551.0957383164,2791157.847256938,685442.6538236892,3339438.8728266233],
  [1419865.9274980277,1514470.5981388188,871203.1318207411,2582269.4838753743],
  [1373377.7419921095,1837498.747735234,928961.2261188435,1778118.9357764099],
]
function ref(code:string,value:number):DashboardReferenceRow {
 return {codigo:code,valor:value,grupo:"fonte",dimensao:null,competencia:null,
  rotulo:code,unidade:"dias",origem_aba:"Premissas 12M",origem_celula:"G77",
  versao:"2.3.7",situacao:"referencia"}
}
const refs=paymentDays.map((v,i)=>ref("prazo_pagamento_linha_"+(i+1),v))
function forecast():CashForecastResult {
 return {state:"simulado",authorizesPurchases:false,warnings:[],
  monthLabels:months,monthlyWorst:months.map((_,i)=>3000000+i*500000),
  monthlyCmvByLine:{noventa:months.map(()=>[200000,100000,50000,60000]),plano:[],historico:[]},
 } as unknown as CashForecastResult
}
function preview():OtbSubgroupPreview {
 const m=[months[1],months[2],months[3]] as const
 const data=(cost:number,stock:number,need:number)=>m.map(month=>({
  month,openingStock:stock,forecastCost:cost,targetStock:cost,need,closingStock:stock,
 }))
 return {state:"calculado",months:m,authorizesPurchases:false,
   rows:[
    {line:1,name:"1.LINHA NUTRIÇÃO / MATERIA PRIMA",kind:"S",stockCost:120000,
      cmv90d:5000,share:0.01,curveAShare:0.7,targets:m.map(()=>({days:63,source:"plano"})),
      months:data(200,120000,0),issue:null,seasonalWeights:null,
      projectedSales90d:0,projectedCmv90d:0},
    {line:1,name:"1.LINHA NUTRIÇÃO / PRODUÇÃO",kind:"P",stockCost:50000,
      cmv90d:70000,share:0.5,curveAShare:null,targets:[],months:data(80000,50000,0),
      issue:null,seasonalWeights:null,projectedSales90d:null,projectedCmv90d:null},
    {line:1,name:"1.LINHA NUTRIÇÃO / MINERAL",kind:"S",stockCost:20000,
      cmv90d:30000,share:0.5,curveAShare:0.7,targets:[],months:data(15000,20000,5000),
      issue:null,seasonalWeights:null,projectedSales90d:null,projectedCmv90d:null},
    {line:1,name:"1.LINHA NUTRIÇÃO / NUCLEO E PREMIX",kind:"M",stockCost:3000,
      cmv90d:1000,share:0.1,curveAShare:null,targets:[],months:null,issue:"Não comprável",
      seasonalWeights:null,projectedSales90d:null,projectedCmv90d:null},
    {line:2,name:"2.SAUDE / VETERINÁRIO",kind:"S",stockCost:10000,
      cmv90d:20000,share:0.5,curveAShare:0.8,targets:[],months:data(12000,10000,6000),
      issue:null,seasonalWeights:null,projectedSales90d:null,projectedCmv90d:null},
   ],totals:{1:[5000,5000,5000],2:[6000,6000,6000]},unmatchedPlanGroups:[],
   reconciledPlanGroups:[],seasonality:"cmv_90d"}
}

describe("Zacarini 2.3.8: vencimentos por linha iguais aos valores da planilha",()=>{
 it("reproduz os vencimentos acumulados, inclusive virada de ano e prazos de 146 dias",()=>{
  const out=buildZacarini238CumulativeDues({
   forecastMonths:months,otbMonths:[months[1],months[2],months[3]],
   needsByMonthLine:workbook,paymentDays,
  })
  expect(out[0][2]).toBeCloseTo(757524.7237443466,2) // E630
  expect(out[0][3]).toBeCloseTo(3361518.684423872,2) // F630
  expect(out[1][3]).toBeCloseTo(549625.5203218171,2) // F631
  expect(out[2][4]).toBeCloseTo(588590.4608537612,2) // G632
  expect(out[0][11]).toBeCloseTo(8381590.469645567,2)
  expect(out[1][11]).toBeCloseTo(6387809.141332962,2)
  expect(out[2][11]).toBeCloseTo(5917956.651622597,2)
 })
 it("bloqueia prazo de linha ou mês ausente sem completar como zero",()=>{
  expect(()=>buildZacarini238CumulativeDues({
   forecastMonths:months.slice(0,11),otbMonths:[months[1],months[2],months[3]],
   needsByMonthLine:workbook,paymentDays,
  })).toThrow()
  expect(()=>buildZacarini238CumulativeDues({
   forecastMonths:months,otbMonths:[months[1],months[2],months[3]],
   needsByMonthLine:workbook,paymentDays:[47,73,78],
  })).toThrow()
 })
})
describe("OTB operacional automática, sem liberação",()=>{
 it("monta os três meses usando CMV real e MP por produção, nunca exemplo local",()=>{
  const out=buildOtbAutomaticReference238({
   baseDate:"2026-11-24",preview:preview(),forecast:forecast(),references:refs,
  })
  expect(out.state,out.state==="indisponivel"?out.reason:"").toBe("referencia_parcial")
  expect(out.authorizesPurchases).toBe(false)
  if(out.state!=="referencia_parcial")throw new Error(out.reason)
  expect(out.result.months).toHaveLength(3)
  expect(out.result.source).toContain("NAO_HOMOLOGADA")
  expect(out.result.months[0].month).toBe("2026-12-01")
  expect(out.rawMaterialNeeds[0]).toBeGreaterThan(0)
  expect(out.result.months[0].mpNeed).toBe(out.rawMaterialNeeds[0])
  expect(out.result.months[0].subgroups.some(s=>s.name==="1.LINHA NUTRIÇÃO / MATERIA PRIMA")).toBe(false)
  expect(out.limitations.some(t=>t.includes("Pedidos"))).toBe(false) // texto explícito sobre "Pedido"
  expect(out.limitations.join(" ")).toContain("Pedido anterior")
 })
 it("se não existe estoque de MP, produção, juros ou projeção, não gera teto de caixa falso",()=>{
  const broken=preview()
  if(broken.state==="calculado")broken.rows[0].targets=[]
  expect(buildOtbAutomaticReference238({
   baseDate:"2026-11-24",preview:broken,forecast:forecast(),references:refs,
  }).state).toBe("indisponivel")
  expect(buildOtbAutomaticReference238({
   baseDate:"2026-11-24",preview:preview(),forecast:forecast(),references:[],
  }).state).toBe("indisponivel")
 })
})
