/** Necessidade de reposição física por subgrupo (prévia, nunca liberação financeira).
 * Equação OTB!S48/AB48/AK48 = MÁX(0, CMV previsto + estoque-alvo - estoque inicial).
 * A curva de venda entregue vem das quatro janelas fx_VendaSubgrupo da 2.3.7.
 * Até obter OTB!D por SKU, sua parcela média G usa CMV observado como PROXY,
 * sem transformar a prévia em verba ou cenário oficial.
 */

import { calculateOtbSeasonalWeights, type OtbHistoricalGroup,
  type OtbSeasonalWindows } from "./otb-seasonal-weights"

export type PreviewStockSubgroup = {line:number;subgroup:string;stockCost:number;cmv90d:number|null}
export type PreviewDdePlan = {grupo_subgrupo:string;competencia:string;dde_meta:number|string|null}
export type PreviewSubgroupInput = {
  months: readonly [string,string,string]
  referenceMonths: readonly string[]
  projectedCmv: readonly (readonly number[])[]
  positions: readonly PreviewStockSubgroup[]
  plans: readonly PreviewDdePlan[]
  fallbackDde: Readonly<Record<number,number>>
  /** Vendas entregues no ano anterior: histórico completo de toda a linha. */
  historicalSales?: readonly OtbHistoricalGroup[]
}

export type PreviewTarget = {days:number;source:"plano"|"linha"}
export type PreviewSubgroupMonth = {
  month:string;openingStock:number;forecastCost:number;targetStock:number;need:number;closingStock:number
}
export type PreviewSubgroupRow = {
  line:number;name:string;stockCost:number;cmv90d:number|null;share:number|null
  targets:PreviewTarget[];months:PreviewSubgroupMonth[]|null;issue:string|null
  seasonalWeights:OtbSeasonalWindows|null
}
export type OtbSubgroupPreview =
  | {state:"indisponivel";reason:string;authorizesPurchases:false}
  | {state:"calculado";months:readonly [string,string,string];rows:PreviewSubgroupRow[];
    totals:Record<number,(number|null)[]>;unmatchedPlanGroups:string[];
    reconciledPlanGroups:string[];seasonality:"venda_entregue"|"cmv_90d";authorizesPurchases:false}

const MONEY_TOLERANCE=1e-6
/** Exportação legada substituiu cada caractere acentuado por um espaço literal.
 * Não é busca aproximada: só aceita correspondência integral e única. */
const accentInExport=/[ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüýÿ]/g
const lostAccents=(value:string)=>value.replace(accentInExport," ")
function monthISO(value:unknown):value is string {
  if(typeof value!=="string"||!/^20\d\d-(0[1-9]|1[0-2])-01$/.test(value))return false
  const d=new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value
}
function monthDays(value:string){const [year,month]=value.split("-").map(Number);return new Date(Date.UTC(year,month,0)).getUTCDate()}
function nonnegative(value:unknown):value is number{return typeof value==="number"&&Number.isFinite(value)&&value>=0}
function parsedDays(value:unknown):number|null {
  if(value===null||value===undefined||value==="")return null
  const days=Number(value)
  return Number.isFinite(days)&&days>=0&&days<=365?days:null
}
const unavailable=(reason:string):OtbSubgroupPreview=>({state:"indisponivel",reason,authorizesPurchases:false})

export function buildOtbSubgroupPreview(input:PreviewSubgroupInput):OtbSubgroupPreview {
  if(!Array.isArray(input.months)||input.months.length!==3||input.months.some(m=>!monthISO(m))||
    input.referenceMonths.length!==input.projectedCmv.length||input.referenceMonths.length<7||
    !input.referenceMonths.every(monthISO)||!input.positions.length){
    return unavailable("Competências, estoque ou projeção mensal incompletos.")
  }
  for(let index=1;index<input.referenceMonths.length;index++){
    const d=new Date(`${input.referenceMonths[index-1]}T00:00:00Z`)
    d.setUTCMonth(d.getUTCMonth()+1)
    if(d.toISOString().slice(0,10)!==input.referenceMonths[index])return unavailable("Competências da referência não são consecutivas.")
  }
  const indexes=input.months.map(m=>input.referenceMonths.indexOf(m))
  if(indexes.some((index,i)=>index<0||index+3>=input.referenceMonths.length||
    (i>0&&index!==indexes[0]+i))){return unavailable("Não há CMV futuro suficiente para o horizonte de três meses.")}
  if(input.projectedCmv.some(row=>row.length!==4||row.some(value=>!nonnegative(value)))){
    return unavailable("CMV por linha indisponível ou inválido.")
  }
  const seen=new Set<string>()
  for(const position of input.positions){
    const key=`${position.line}\0${position.subgroup}`
    if(seen.has(key)||!Number.isInteger(position.line)||position.line<1||position.line>4||
      !position.subgroup.trim()||!Number.isFinite(position.stockCost)||
      (position.cmv90d!==null&&!nonnegative(position.cmv90d))){
      return unavailable("Cadastro de posição por subgrupo inválido ou repetido.")
    }
    seen.add(key)
  }
  const names=new Set(input.positions.map(p=>p.subgroup))
  const plannedNames=[...new Set(input.plans.map(p=>p.grupo_subgrupo))]
  const canonicalByPlan=new Map<string,string>()
  const usedNames=new Set<string>()
  for(const name of plannedNames){
    if(names.has(name)){canonicalByPlan.set(name,name);usedNames.add(name)}
  }
  const reconciledPlanGroups:string[]=[]
  for(const planned of plannedNames.filter(name=>!canonicalByPlan.has(name)).sort((a,b)=>a.localeCompare(b,"pt-BR"))){
    const candidates=[...names].filter(name=>lostAccents(name)===planned)
    if(candidates.length!==1||usedNames.has(candidates[0]))continue
    canonicalByPlan.set(planned,candidates[0])
    usedNames.add(candidates[0])
    reconciledPlanGroups.push(planned)
  }
  const planByKey=new Map<string,number[]>()
  for(const plan of input.plans){
    if(!monthISO(plan.competencia))continue
    const key=`${canonicalByPlan.get(plan.grupo_subgrupo)??plan.grupo_subgrupo}\0${plan.competencia}`
    const entries=planByKey.get(key)??[]
    const value=parsedDays(plan.dde_meta)
    if(value!==null)entries.push(value)
    planByKey.set(key,entries)
  }
  const unmatchedPlanGroups=plannedNames.filter(name=>!canonicalByPlan.has(name)).sort((a,b)=>a.localeCompare(b,"pt-BR"))
  const seasonality=input.historicalSales===undefined?"cmv_90d":"venda_entregue"
  const seasonal=input.historicalSales===undefined?null:calculateOtbSeasonalWeights({
    groups:input.positions.map(row=>({line:row.line as 1|2|3|4,name:row.subgroup,
      projected90Sales:row.cmv90d??0})),
    historical:input.historicalSales,
    minimumHistoricalSales:5000,
  })
  if(seasonal?.state==="indisponivel")return unavailable(`Vendas sazonais incompletas: ${seasonal.reason}`)
  const bySeasonalGroup=new Map<string,OtbSeasonalWindows>(seasonal?.state==="calculado"?
    seasonal.groups.map(group=>[`${group.line}\0${group.name}`,group.weights] as const):[])
  const byLine=new Map<number,PreviewStockSubgroup[]>()
  for(const position of input.positions){
    const entries=byLine.get(position.line)??[]
    entries.push(position)
    byLine.set(position.line,entries)
  }
  const rows:PreviewSubgroupRow[]=[]
  const totals:Record<number,(number|null)[]>={}
  for(let line=1;line<=4;line++){
    const groups=byLine.get(line)??[]
    if(!groups.length){totals[line]=[null,null,null];continue}
    const completeCmv=groups.every(g=>g.cmv90d!==null)
    const lineCmv=completeCmv?groups.reduce((sum,g)=>sum+g.cmv90d!,0):0
    for(const group of groups){
      const targets:PreviewTarget[]=[]
      let issue:string|null=!completeCmv||lineCmv<=0?"CMV histórico incompleto na linha.":null
      for(const month of input.months){
        const values=planByKey.get(`${group.subgroup}\0${month}`)??[]
        const fallback=parsedDays(input.fallbackDde[line])
        if(values.length>1)issue="Metas DDE duplicadas para a competência."
        const days=values.length===1?values[0]:values.length>1?null:fallback
        if(days===null)issue=issue??"Meta DDE ausente para uma competência."
        else targets.push({days,source:values.length===1?"plano":"linha"})
      }
      const share=issue===null?group.cmv90d!/lineCmv:null
      const seasonalWeights=bySeasonalGroup.get(`${line}\0${group.subgroup}`)??null
      let opening=group.stockCost
      const months:PreviewSubgroupMonth[]=[]
      if(share!==null&&targets.length===3){
        for(let i=0;i<3;i++){
          const forecastIndex=indexes[i]
          const cost=input.projectedCmv[forecastIndex][line-1]*(seasonalWeights?.[i]??share)
          const nextCosts=[1,2,3].reduce((sum,offset)=>sum+input.projectedCmv[forecastIndex+offset][line-1]*(seasonalWeights?.[i+1]??share),0)
          const nextDays=[1,2,3].reduce((sum,offset)=>sum+monthDays(input.referenceMonths[forecastIndex+offset]),0)
          const targetStock=targets[i].days*nextCosts/nextDays
          const need=Math.max(0,cost+targetStock-opening)
          const closingStock=Math.max(0,opening+need-cost)
          if(![cost,targetStock,need,closingStock].every(Number.isFinite)){issue="Projeção numérica fora dos limites.";break}
          months.push({month:input.months[i],openingStock:opening,forecastCost:cost,targetStock,need,closingStock})
          opening=closingStock
        }
      }
      rows.push({line,name:group.subgroup,stockCost:group.stockCost,cmv90d:group.cmv90d,share,
        targets,months:issue===null&&months.length===3?months:null,issue,seasonalWeights})
    }
    const current=rows.filter(r=>r.line===line)
    totals[line]=current.every(row=>row.months!==null)
      ?[0,1,2].map(i=>{
        const sum=current.reduce((total,row)=>total+row.months![i].need,0)
        return Math.abs(sum)<MONEY_TOLERANCE?0:sum
      }) :[null,null,null]
  }
  return {state:"calculado",months:input.months,rows,totals,unmatchedPlanGroups,reconciledPlanGroups,
    seasonality,authorizesPurchases:false}
}
