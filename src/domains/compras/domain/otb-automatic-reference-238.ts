import { calculateOtb, type OtbResult, type OtbSubgroupInput, type OtbTriple } from "./otb-calculation"
import { calculateWorstCaseOtbCaps, type OtbWorstCashResult } from "./otb-cash-projection"
import { dashboardReference, type DashboardReferenceRow } from "./dashboard-zacarini-237"
import type { OtbSubgroupPreview } from "./otb-subgroup-preview"
import type { CashForecastResult } from "./zacarini-cash-forecast"

/**
 * Executa AUTOMATICAMENTE a OTB no modo demonstrativo operacional com dados do
 * Supabase. Reproduz a sequência da Zacarini 2.3.8:
 * estoque/produção -> necessidade 3M -> vencimentos por linha (615:632)
 * -> limite do pior caso (638:640/652) -> rateio OTB (S:AO).
 *
 * Este contrato é INFORMATIVO e NÃO confere autorização, alçada, pedidos
 * anteriores, compras gravadas, vendas casadas, conciliação bancária ou
 * aprovação financeira. Tais lacunas permanecem visíveis, nunca são
 * silenciosamente convertidas em valores aprovados.
 */
export type OtbAutomaticReference238 =
  | {state:"indisponivel";reason:string;authorizesPurchases:false}
  | {
      state:"referencia_parcial"
      authorizesPurchases:false
      result:OtbResult
      cash:OtbWorstCashResult
      excludedSubgroups:string[]
      mpMethod:"PRODUCAO_P_MULTIPLICADA_H12_ESTOQUE_MP_SEM_PEDIDOS"
      rawMaterialNeeds:OtbTriple<number>
      limitations:readonly string[]
    }

export type AutomaticInput238 = {
  baseDate:string
  preview:OtbSubgroupPreview|null
  forecast:CashForecastResult
  references:readonly DashboardReferenceRow[]
}

const DAY=86400000
const isoMs=(s:string)=>Date.parse(s+"T00:00:00.000Z")
const dateAt=(ms:number)=>new Date(ms).toISOString().slice(0,10)
function nextMonth(date:string,offset:number):string{
  const [year,month]=date.split("-").map(Number)
  return new Date(Date.UTC(year,month-1+offset,1)).toISOString().slice(0,10)
}
function endMonthMs(date:string):number{
  const [year,month]=date.split("-").map(Number)
  return Date.UTC(year,month,0)
}
function validAmount(n:unknown):n is number {
  return typeof n==="number"&&Number.isFinite(n)&&n>=0&&n<=1e12
}
const unavailable=(reason:string):OtbAutomaticReference238=>({state:"indisponivel",reason,authorizesPurchases:false})

/** Zacarini 'Projeção 12M'!C615:N626: divide os valores de compras
 * uniformemente pelos dias do mês original deslocados pelo prazo de
 * pagamento da linha. C630:N632 acumulam por mês de vencimento.
 */
export function buildZacarini238CumulativeDues(input:{
  forecastMonths:readonly string[]
  otbMonths:readonly string[]
  needsByMonthLine:readonly (readonly number[])[]
  paymentDays:readonly number[]
}):[number[],number[],number[]] {
  const {forecastMonths,otbMonths,needsByMonthLine,paymentDays}=input
  if(forecastMonths.length!==12||otbMonths.length!==3||needsByMonthLine.length!==3||
     paymentDays.length!==4||forecastMonths.some((m,i)=>m!==nextMonth(forecastMonths[0],i))||
     otbMonths.some((m,i)=>m!==nextMonth(forecastMonths[0],i+1))||
     paymentDays.some(n=>!Number.isSafeInteger(n)||n<0||n>365)||
     needsByMonthLine.some(row=>row.length!==4||row.some(n=>!validAmount(n)))){
    throw new RangeError("Calendário, vencimentos ou necessidades da Projeção 12M incompletos.")
  }
  return otbMonths.map((purchasingMonth,monthIndex)=>{
    const windowStart=isoMs(purchasingMonth)
    const windowEnd=endMonthMs(purchasingMonth)
    const days=(windowEnd-windowStart)/DAY+1
    const dueByMonth=forecastMonths.map(month=>{
      const from=isoMs(month)
      const to=endMonthMs(month)
      return needsByMonthLine[monthIndex].reduce((sum,amount,line)=>{
        const first=windowStart+paymentDays[line]*DAY
        const last=windowEnd+paymentDays[line]*DAY
        const intersection=Math.max(0,Math.floor((Math.min(last,to)-Math.max(first,from))/DAY)+1)
        return sum+amount*intersection/days
      },0)
    })
    return dueByMonth.map((_,index)=>dueByMonth.slice(0,index+1).reduce((s,n)=>s+n,0))
  }) as [number[],number[],number[]]
}

/** Apenas a prévia; NUNCA usar o retorno para gravar aprovações no sistema. */
export function buildOtbAutomaticReference238(input:AutomaticInput238):OtbAutomaticReference238 {
  const {baseDate,preview,forecast,references}=input
  const baseMs=isoMs(baseDate)
  if(!/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(baseDate)||
    !Number.isFinite(baseMs)||dateAt(baseMs)!==baseDate)return unavailable("Data-base inválida.")
  if(forecast.state!=="simulado"||!preview||preview.state!=="calculado") {
    return unavailable("Projeção 12M ou subgrupos ainda não calculados pelas fontes do Supabase.")
  }
  const otbMonths=[1,2,3].map(i=>nextMonth(baseDate,i)) as OtbTriple<string>
  if(preview.months.some((month,i)=>month!==otbMonths[i])||
     forecast.monthLabels.length!==12||forecast.monthLabels.some((m,i)=>m!==nextMonth(baseDate,i))||
     forecast.monthlyWorst.length!==12||
     forecast.monthlyWorst.some(value=>!Number.isFinite(value))||
     forecast.monthlyCmvByLine.noventa.length!==12||
     forecast.monthlyCmvByLine.noventa.some(row=>row.length!==4||row.some(v=>!validAmount(v)))){
     return unavailable("Série financeira mensal ou competências de estoque não coincidem.")
  }
  const terms=[1,2,3,4].map(i=>dashboardReference(references,`prazo_pagamento_linha_${i}`,null).valor)
  if(terms.some(x=>x===null||!Number.isSafeInteger(x)||x<0||x>365)) {
    return unavailable("Prazos por linha da Projeção 12M ausentes ou inválidos.")
  }
  // A fórmula da referência 2.3.8 usa H12=1 para converter CMV de
  // produção própria em necessidade de MP. Fator financeiro de 1,3 em
  // outro relatório NÃO substitui esta regra. Mostra claramente a origem.
  const factorConsumption238=1
  const mpCandidates=preview.rows.filter(row=>row.line===1&&
    row.name.toLocaleUpperCase("pt-BR").includes("MATERIA PRIMA"))
  if(mpCandidates.length!==1) return unavailable("Subgrupo de matéria-prima não identificado unicamente.")
  const mp=mpCandidates[0]
  if(mp.kind!=="S"||mp.targets.length!==3||mp.targets.some(t=>!validAmount(t.days))) {
    return unavailable("DDE de matéria-prima incompleto.")
  }
  const sourceProduction=preview.rows.filter(row=>row.kind==="P")
  if(!sourceProduction.length||sourceProduction.some(row=>row.months===null||
    row.months.length!==3||row.months.some(m=>!validAmount(m.forecastCost)))) {
    return unavailable("Projeção de produção própria P incompleta; não estimar matéria-prima como zero.")
  }
  const rawProduction=[0,1,2].map(i=>sourceProduction.reduce((sum,r)=>sum+r.months![i].forecastCost,0))
  const denominator=forecast.monthlyCmvByLine.noventa[3].reduce((s,v)=>s+v,0)
  const productionShare=denominator>0?rawProduction[2]/denominator:NaN
  if(!validAmount(productionShare)||productionShare>1.2) {
    return unavailable("Sem fator verificável para o CMV futuro da produção própria.")
  }
  const mpCostForForecastIndex=(index:number)=>{
    if(index>=1&&index<=3)return rawProduction[index-1]
    return forecast.monthlyCmvByLine.noventa[index].reduce((s,v)=>s+v,0)*productionShare
  }
  // A planilha soma estoques dos grupos M à posição de MP. Pedidos MP
  // em aberto NÃO estão no contrato deste estágio, portanto o resultado
  // é explicitamente uma estimativa, nunca uma necessidade autorizada.
  let mpOpening=mp.stockCost+preview.rows.filter(row=>row.kind==="M")
    .reduce((sum,row)=>sum+row.stockCost,0)
  const mpNeeds:number[]=[]
  for(let monthIndex=0;monthIndex<3;monthIndex++){
    const i=monthIndex+1
    const currentCost=mpCostForForecastIndex(i)*factorConsumption238
    let forwardCost=0
    let forwardDays=0
    for(let offset=1;offset<=3;offset++){
      const future=i+offset
      forwardCost+=mpCostForForecastIndex(future)*factorConsumption238
      forwardDays+=(endMonthMs(forecast.monthLabels[future])-isoMs(forecast.monthLabels[future]))/DAY+1
    }
    const target=mp.targets[monthIndex].days*forwardCost/forwardDays
    const need=Math.max(0,currentCost+target-mpOpening)
    if(![currentCost,target,need].every(validAmount))return unavailable("Projeção de matéria-prima inválida.")
    mpNeeds.push(need)
    mpOpening=Math.max(0,mpOpening+need-currentCost)
  }

  const missing:string[]=[]
  const merchandise:OtbSubgroupInput[]=[]
  for(const row of preview.rows){
    if(row.kind!=="S"||row===mp)continue
    if(!row.months||row.months.length!==3||row.curveAShare===null||
       !Number.isFinite(row.curveAShare)||row.curveAShare<0||row.curveAShare>1||
       row.months.some((m,i)=>m.month!==otbMonths[i]||!validAmount(m.forecastCost)||
         !validAmount(m.targetStock)||!validAmount(m.need))){
      missing.push(`${row.line} · ${row.name}`)
      continue
    }
    merchandise.push({
      line:`Linha ${row.line}`,name:row.name,kind:"S",
      openingStock:row.stockCost,priorOrders:0,
      forecastCost:row.months.map(m=>m.forecastCost) as unknown as OtbTriple<number>,
      targetStock:row.months.map(m=>m.targetStock) as unknown as OtbTriple<number>,
      curveAShare:row.curveAShare,
      alreadyRecorded:[0,0,0],tiedSalesApproved:[0,0,0],
    })
  }
  if(!merchandise.length)return unavailable("Nenhum subgrupo S com DDE, CMV e curva ABC completos.")
  const needsByMonthLine=[0,1,2].map(index=>{
    const lineNeeds=[mpNeeds[index],0,0,0]
    for(const row of merchandise){
      const line=Number(row.line.slice(6))-1
      if(!Number.isInteger(line)||line<0||line>3)return [] // inválido: validação abaixo
      lineNeeds[line]+=preview.rows.find(p=>p.name===row.name&&p.line===line+1)!.months![index].need
    }
    return lineNeeds.map(v=>Math.max(0,v))
  })
  if(needsByMonthLine.some(row=>row.length!==4||row.some(v=>!validAmount(v)))){
    return unavailable("Necessidades por linha inválidas.")
  }
  let caps:OtbWorstCashResult
  let result:OtbResult
  try{
    const dues=buildZacarini238CumulativeDues({
      forecastMonths:forecast.monthLabels,otbMonths,
      needsByMonthLine,paymentDays:terms as number[],
    })
    caps=calculateWorstCaseOtbCaps({
      source:"PROJECAO_12M_SOSAL_ESTIMATIVA_238",
      forecastStart:forecast.monthLabels[0],
      cashBuffer:0, // Excel OTB!B11 = 0, distinto de minimo_caixa
      worstFreeCash:forecast.monthlyWorst,
      monthlyNeeds:needsByMonthLine.map(row=>row.reduce((s,v)=>s+v,0)),
      cumulativeDues:dues,
    })
    result=calculateOtb({
      source:"OTB_SOSAL_PREVIA_AUTOMATICA_NAO_HOMOLOGADA_238",
      baseDate,months:otbMonths,cashCaps:caps.cashCaps,mpNeeds:mpNeeds as OtbTriple<number>,
      buyerShare:0.9,subgroups:merchandise,
    })
  }catch(error){
    return unavailable(error instanceof Error?error.message:"Não foi possível calcular a trava da Projeção 12M.")
  }
  return {
    state:"referencia_parcial",authorizesPurchases:false,result,cash:caps,
    mpMethod:"PRODUCAO_P_MULTIPLICADA_H12_ESTOQUE_MP_SEM_PEDIDOS",
    rawMaterialNeeds:mpNeeds as OtbTriple<number>,
    excludedSubgroups:missing,
    limitations:[
      "Pedido anterior, pedido gravado, entrega e venda casada ainda não conciliados por subgrupo; simulação considera esses campos nulos e NÃO serve para autorização.",
      "A necessidade de MP é estimada com o consumo P e estoque informado, sem abater pedidos MP pendentes; não usar como pedido autorizado.",
      "O saldo do pior caso é simulação com referências financeiras, não saldo bancário homologado. A programação de pagamentos replica os prazos por linha da Zacarini.",
      ...(missing.length?[`${missing.length} subgrupo(s) S incompleto(s) excluído(s); valores são parciais.`]:[]),
    ],
  }
}
