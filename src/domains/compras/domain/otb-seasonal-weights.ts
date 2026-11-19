/** Peso sazonal da Zacarini 2.3.7, OTB!D/G/AY:BP.
 * O histórico é de VENDA ENTREGUE por quatro janelas móveis do ano anterior.
 * Nunca utilizar CMV90d como substituto dessas séries.
 */
export type OtbLine = 1 | 2 | 3 | 4
export type OtbSeasonalWindows = readonly [number, number, number, number]
export type OtbSeasonalGroup = {line:OtbLine;name:string;projected90Sales:number}
export type OtbHistoricalGroup = {line:OtbLine;name:string;sales:OtbSeasonalWindows}
export type OtbSeasonalInput = {
  groups:readonly OtbSeasonalGroup[]
  /** Fonte integral: inclusive grupos do histórico que não aparecem na OTB. */
  historical:readonly OtbHistoricalGroup[]
  minimumHistoricalSales:number
}
export type OtbSeasonalResult =
  | {state:"indisponivel";reason:string}
  | {state:"calculado";groups:{line:OtbLine;name:string;averageShare:number;
      allocatedHistory:OtbSeasonalWindows;weights:OtbSeasonalWindows}[]}

/** Mesma remoção da fórmula OTB!BK48 e fx_VendaSubgrupo!F6. */
export function excelOtbGroupKey(name:string):string {
  return name.trim().toUpperCase().replace(/[ ./()+-]/g,"").replace(/[ÇÃÁÀÂÉÊÍÓÔÕÚÜ]/g,"")
}
const valid=(value:unknown):value is number=>typeof value==="number"&&Number.isFinite(value)&&value>=0
const isLine=(line:unknown):line is OtbLine=>line===1||line===2||line===3||line===4
const unavailable=(reason:string):OtbSeasonalResult=>({state:"indisponivel",reason})

/**
 * G = D / ΣD(linha)
 * BL = D / ΣD(chave) (ou 1/n com D total igual a zero)
 * BE:BG, BO = venda janela × BL / venda linha, ou G se < mínimo
 * BH:BJ, BP = peso bruto / Σpesos brutos da linha; se divisor zero, G.
 */
export function calculateOtbSeasonalWeights(input:OtbSeasonalInput):OtbSeasonalResult {
  if(!input||!valid(input.minimumHistoricalSales)||!Array.isArray(input.groups)||!input.groups.length||
    !Array.isArray(input.historical)||!input.historical.length){
    return unavailable("Sem vendas projetadas ou histórico completo das quatro janelas.")
  }
  const uniqueNames=new Set<string>()
  for(const group of input.groups){
    const key=`${group.line}\0${group.name}`
    if(!isLine(group.line)||!group.name?.trim()||!valid(group.projected90Sales)||uniqueNames.has(key)){
      return unavailable("Cadastro ou venda prevista de 90 dias inválidos.")
    }
    uniqueNames.add(key)
  }
  const historicalByKey=new Map<string,number[]>()
  const lineHistorical=new Map<OtbLine,number[]>()
  for(const entry of input.historical){
    if(!isLine(entry.line)||!entry.name?.trim()||!Array.isArray(entry.sales)||
      entry.sales.length!==4||entry.sales.some((value:unknown)=>!valid(value))){
      return unavailable("Histórico sazonal incompleto ou inválido.")
    }
    const key=excelOtbGroupKey(entry.name)
    const history=historicalByKey.get(key)??[0,0,0,0]
    const line=lineHistorical.get(entry.line)??[0,0,0,0]
    for(let i=0;i<4;i++){
      history[i]+=entry.sales[i]
      line[i]+=entry.sales[i]
    }
    historicalByKey.set(key,history)
    lineHistorical.set(entry.line,line)
  }
  const totalByLine=new Map<OtbLine,number>()
  const groupsByKey=new Map<string,OtbSeasonalGroup[]>()
  for(const group of input.groups){
    totalByLine.set(group.line,(totalByLine.get(group.line)??0)+group.projected90Sales)
    const key=excelOtbGroupKey(group.name)
    const entries=groupsByKey.get(key)??[]
    entries.push(group)
    groupsByKey.set(key,entries)
  }
  const rawByLine=new Map<OtbLine,number[]>()
  const intermediate=input.groups.map(group=>{
    const total90=totalByLine.get(group.line)??0
    const averageShare=total90>0?group.projected90Sales/total90:0
    const twins=groupsByKey.get(excelOtbGroupKey(group.name))!
    const twinTotal=twins.reduce((sum,item)=>sum+item.projected90Sales,0)
    const share=twinTotal>0?group.projected90Sales/twinTotal:1/twins.length
    const source=historicalByKey.get(excelOtbGroupKey(group.name))??[0,0,0,0]
    const allocatedHistory=source.map(value=>value*share) as unknown as OtbSeasonalWindows
    const lineHistory=lineHistorical.get(group.line)??[0,0,0,0]
    const raw=allocatedHistory.map((value,index)=>
      value<input.minimumHistoricalSales||lineHistory[index]<=0?averageShare:value/lineHistory[index]) as unknown as OtbSeasonalWindows
    const sums=rawByLine.get(group.line)??[0,0,0,0]
    for(let i=0;i<4;i++)sums[i]+=raw[i]
    rawByLine.set(group.line,sums)
    return {line:group.line,name:group.name,averageShare,allocatedHistory,raw}
  })
  const groups=intermediate.map(group=>{
    const sum=rawByLine.get(group.line)!
    const weights=group.raw.map((value,index)=>sum[index]>0?value/sum[index]:group.averageShare) as unknown as OtbSeasonalWindows
    return {line:group.line,name:group.name,averageShare:group.averageShare,allocatedHistory:group.allocatedHistory,weights}
  })
  if(groups.some(group=>group.weights.some(value=>!Number.isFinite(value)))){
    return unavailable("Pesos sazonais não finitos.")
  }
  return {state:"calculado",groups}
}
