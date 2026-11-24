import { describe, expect, it } from "vitest"
import { calculateFreeCashForOtb238 } from "./otb-free-cash-reconciliation-238"
import type { CashForecastResult } from "./zacarini-cash-forecast"

/** Teste determinístico: mesma competência da Zacarini 2.3.8, caixa inicial
 * de referência e pagamentos que o próprio simulador já subtraiu.
 */
const months=Array.from({length:12},(_,i)=>
 new Date(Date.UTC(2026,10+i,1)).toISOString().slice(0,10))
const purchases=months.map(()=>[0,0,0,0])
purchases[1]=[200000,0,0,0] // dez/26; +47 dias -> jan/27
purchases[2]=[0,150000,0,0] // jan/27; +73 dias -> mar/27
purchases[3]=[0,0,0,100000] // fev/27; +146 dias -> jun/27
purchases[4]=[99000,0,0,0] // março: NÃO faz parte das três compras da OTB
const forecast={
 state:"simulado",authorizesPurchases:false,
 monthLabels:months,safetyFloor:500000,
 // Já descontou no fluxo esses pagamentos de compras nos meses de vencimento.
 monthlyWorst:months.map((_,i)=>1_500_000
   -(i>=2?200000:0)-(i>=4?150000:0)
   -(i>=7?100000:0)-(i>=5?99000:0)),
 monthlyNewPurchasesByLine:{noventa:purchases,plano:purchases.map(row=>[...row]),historico:purchases.map(row=>[...row])},
 monthly:{
  noventa:months.map((_,i)=>1_500_000-(i>=2?200000:0)-(i>=4?150000:0)-(i>=7?100000:0)-(i>=5?99000:0)),
  plano:months.map((_,i)=>1_700_000-(i>=2?200000:0)-(i>=4?150000:0)-(i>=7?100000:0)-(i>=5?99000:0)),
  historico:months.map((_,i)=>1_800_000-(i>=2?200000:0)-(i>=4?150000:0)-(i>=7?100000:0)-(i>=5?99000:0)),
 },
} as unknown as CashForecastResult
describe("Projeção 12M!C607:C613 e OTB!B10/B11 - caixa livre sem duplicidade",()=>{
 it("deduz o mínimo de caixa uma única vez e recompõe a compra futura já subtraída",()=>{
  const result=calculateFreeCashForOtb238(forecast,[47,73,78,146])
  expect(result.authorizesPurchases).toBe(false)
  expect(result.safetyFloor).toBe(500000)
  expect(result.returnedPaymentsTotal).toBe(450000)
  expect(result.freeCashForOtb[0]).toBe(1000000)
  expect(result.freeCashForOtb[1]).toBe(1000000)
  expect(result.freeCashForOtb[2]).toBe(1000000)
  expect(result.freeCashForOtb[4]).toBe(1000000)
  // Compra de março não é devolvida: ela permanece fora do recorte da OTB.
  expect(result.freeCashForOtb[6]).toBe(901000)
  expect(result.freeCashForOtb[8]).toBe(901000)
  expect(result.returnedPaymentsByMonth[2]).toBe(200000)
  expect(result.returnedPaymentsByMonth[3]).toBe(200000)
  expect(result.returnedPaymentsByMonth[4]).toBe(350000)
  expect(result.returnedPaymentsByMonth[7]).toBe(450000)
 })
 it("nunca libera teto maior omitindo o mínimo, e não confunde B10 com B11",()=>{
  const noPurchase={...forecast,
    monthlyNewPurchasesByLine:{noventa:months.map(()=>[0,0,0,0]),plano:months.map(()=>[0,0,0,0]),historico:months.map(()=>[0,0,0,0])},
  } as unknown as CashForecastResult
  const out=calculateFreeCashForOtb238(noPurchase,[47,73,78,146])
  expect(out.returnedPaymentsTotal).toBe(0)
  expect(out.freeCashForOtb[0]).toBe(1000000)
 })
 it("usa o menor entre três cenários e pior caso corrigido, como C613 da Zacarini",()=>{
  const candidate={...forecast,monthly:{
    ...(forecast as Extract<CashForecastResult,{state:"simulado"}>).monthly,
    plano:months.map((_,i)=>i===2?600000:2000000),
  }} as CashForecastResult
  const out=calculateFreeCashForOtb238(candidate,[47,73,78,146])
  // Jan/27 é definido pelo cenário plano (600k + 200k devolvidos - 500k)
  expect(out.freeCashForOtb[2]).toBe(300000)
  expect(out.authorizesPurchases).toBe(false)
 })
 it("falha fechado com caixa faltante, parcelas negativas ou mês truncado",()=>{
  expect(()=>calculateFreeCashForOtb238({
    ...forecast,safetyFloor:undefined,
  } as CashForecastResult,[47,73,78,146])).toThrow(/saldo mínimo/)
  expect(()=>calculateFreeCashForOtb238(forecast,[47,-10,78,146])).toThrow()
  expect(()=>calculateFreeCashForOtb238({
    ...forecast,monthLabels:months.slice(0,11),
  } as CashForecastResult,[47,73,78,146])).toThrow()
  expect(()=>calculateFreeCashForOtb238({
    ...forecast,monthlyNewPurchasesByLine:{noventa:months.map(()=>[0,0,0,0]).slice(0,11),plano:purchases,historico:purchases},
  } as CashForecastResult,[47,73,78,146])).toThrow()
 })
})
