import { describe, expect, it } from "vitest"
import { buildZacarini238CumulativeDues, buildOtbAutomaticReference238 } from "./otb-automatic-reference-238"
import type { OtbSubgroupPreview } from "./otb-subgroup-preview"
import type { CashForecastResult } from "./zacarini-cash-forecast"
import type { DashboardReferenceRow } from "./dashboard-zacarini-237"
import type { OtbOrderSource238 } from "./otb-order-source-238"

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
  safetyFloor:500000,
  monthlyNewPurchasesByLine:{
    noventa:months.map(()=>[20000,10000,5000,6000]),
    plano:months.map(()=>[20000,10000,5000,6000]),
    historico:months.map(()=>[20000,10000,5000,6000]),
  },
  monthly:{
    noventa:months.map((_,i)=>3000000+i*500000),
    plano:months.map((_,i)=>3300000+i*500000),
    historico:months.map((_,i)=>3500000+i*500000),
  },
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

function openOrders():OtbOrderSource238 {
 return {state:"conectado",base:"2026-11-24",snapshot:"2026-11-24T07:37:05Z",
   items:4,pending:42000,unmappedItems:1,unmappedValue:500,
   unmappedTop:[{code:"X1",description:"Produto não identificado",items:1,pending:500}],
   groups:[
    {name:"1.LINHA NUTRIÇÃO / MATERIA PRIMA",items:1,pending:10000,prior:10000,recorded:[0,0,0]},
    {name:"1.LINHA NUTRIÇÃO / MINERAL",items:1,pending:2000,prior:2000,recorded:[400,0,0]},
    {name:"2.SAUDE / VETERINÁRIO",items:1,pending:29500,prior:29500,recorded:[0,0,0]},
   ],authorizesPurchases:false}
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
   baseDate:"2026-11-24",preview:preview(),forecast:forecast(),references:refs,orders:openOrders(),
  })
  expect(out.state,out.state==="indisponivel"?out.reason:"").toBe("referencia_parcial")
  expect(out.authorizesPurchases).toBe(false)
  if(out.state!=="referencia_parcial")throw new Error(out.reason)
  expect(out.result.months).toHaveLength(3)
  expect(out.result.source).toContain("NAO_HOMOLOGADA")
  expect(out.result.months[0].month).toBe("2026-12-01")
  expect(out.rawMaterialNeeds[0]).toBeGreaterThan(0)
  expect(out.mpPriorOrders).toBe(10000)
  expect(out.freeCashReconciliation.safetyFloor).toBe(500000)
  expect(out.freeCashReconciliation.returnedPaymentsTotal).toBe(123000)
  expect(out.freeCashReconciliation.freeCashForOtb[0]).toBe(2500000)
  expect(out.cash.source).toContain("ESTIMATIVA_238")
  expect(out.result.months[0].subgroups.find(s=>s.name==="1.LINHA NUTRIÇÃO / MINERAL")?.openingStock).toBe(22000)
  expect(out.result.months[0].subgroups.find(s=>s.name==="1.LINHA NUTRIÇÃO / MINERAL")?.recorded).toBe(400)
  expect(out.orderSummary.unmappedItems).toBe(1)
  expect(out.result.months[0].mpNeed).toBe(out.rawMaterialNeeds[0])
  expect(out.result.months[0].subgroups.some(s=>s.name==="1.LINHA NUTRIÇÃO / MATERIA PRIMA")).toBe(false)
  expect(out.limitations.join(" ")).toContain("Pedidos de MP")
  expect(out.limitations.join(" ")).toContain("totalmente recebidos")
  expect(out.limitations.join(" ")).toContain("V48/V173")
 })
 it("recalcula MP no mês seguinte quando o caixa NÃO liberou a compra anterior",()=>{
  const stock=preview()
  if(stock.state!=="calculado")throw Error("prévia ausente")
  // MP sem estoque: a compra solicitada é grande, mas o caixa fica travado.
  stock.rows[0].stockCost=100
  stock.rows[3].stockCost=0
  const ord=openOrders()
  if(ord.state!=="conectado")throw new Error("carteira de teste não conectada")
  ord.groups=ord.groups.map(g=>g.name.includes("MATERIA PRIMA")?{...g,prior:0,pending:0}:g)
  const f=forecast()
  if(f.state!=="simulado")throw new Error("cenário de teste indisponível")
  f.monthlyWorst=months.map(()=>-2000000)
  const result=buildOtbAutomaticReference238({
    baseDate:"2026-11-24",preview:stock,forecast:f,references:refs,orders:ord,
  })
  expect(result.state,result.state==="indisponivel"?result.reason:"").toBe("referencia_parcial")
  if(result.state!=="referencia_parcial")return
  expect(result.authorizesPurchases).toBe(false)
  expect(result.result.months[0].mpReleased).toBe(0)
  expect(result.result.months[0].mpNeed).toBeGreaterThan(0)
  // Excel OTB!AA173 = MAX(0,R173+T173-Q173); T173=0.
  // A abertura do segundo mês é estoque (100) menos consumo (80 mil), ou 0,
  // e NÃO estoque acrescido da necessidade teórica do primeiro mês.
  const firstRawConsumption=80000
  const firstClosing=Math.max(0,100+result.result.months[0].mpReleased-firstRawConsumption)
  expect(result.result.months[1].materialBuyer?.openingStock).toBeCloseTo(firstClosing,5)
  expect(result.rawMaterialNeeds[1]).toBeGreaterThan(result.rawMaterialNeeds[0]*0.3)
  expect(result.result.months[1].mpNeed).toBe(result.rawMaterialNeeds[1])
 })
 it("se não existe estoque de MP, produção, juros ou projeção, não gera teto de caixa falso",()=>{
  const broken=preview()
  if(broken.state==="calculado")broken.rows[0].targets=[]
  expect(buildOtbAutomaticReference238({
   baseDate:"2026-11-24",preview:broken,forecast:forecast(),references:refs,orders:openOrders(),
  }).state).toBe("indisponivel")
  expect(buildOtbAutomaticReference238({
   baseDate:"2026-11-24",preview:preview(),forecast:forecast(),references:[],
  }).state).toBe("indisponivel")
 })
})
