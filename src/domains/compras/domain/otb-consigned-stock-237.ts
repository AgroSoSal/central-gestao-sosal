import type { OtbStockPosition } from "./otb-position-source"

/** OTB!I: valor da posição de estoque menos o estoque da marca que
 * Liquidação Lojas!B7 define como consignada (GALLAGHER na versão 2.3.7).
 * Não altera a foto de estoque observada nem os registros no Supabase.
 */
type Stocked=Extract<OtbStockPosition,{status:"conectado"}>
type Group=Stocked["subgroups"][number]
export type OtbConsignedStock=
  | {state:"indisponivel";reason:string;subgroups:[]}
  | {state:"conectado";snapshotAt:string;subgroups:Group[];stockCost:number;consignedCost:number}

const unavailable=(reason:string):OtbConsignedStock=>({state:"indisponivel",reason,subgroups:[]})
const nonnegative=(value:unknown):number|null=>{
  if((typeof value!=="string"&&typeof value!=="number")||value==="")return null
  const n=Number(value)
  return Number.isFinite(n)&&n>=0&&n<=1e15?n:null
}

export function subtractOtbConsignedStock(stock:OtbStockPosition,source:unknown,error:unknown):OtbConsignedStock{
  if(stock.status!=="conectado"||error||!Array.isArray(source)){
    return unavailable("Estoque ou posição da marca consignada indisponíveis na mesma data-base.")
  }
  const values=new Map<string,number>()
  const position=new Map(stock.subgroups.map(row=>[`${row.line}\0${row.subgroup}`,row]))
  for(const raw of source){
    if(!raw||typeof raw!=="object"||Array.isArray(raw))return unavailable("Saldo consignado inválido.")
    const row=raw as Record<string,unknown>
    const key=`${row.linha}\0${row.grupo_subgrupo}`
    const value=nonnegative(row.valor_consignado)
    const date=row.ultima_atualizacao
    if(!Number.isInteger(row.linha)||typeof row.grupo_subgrupo!=="string"||!position.has(key)||
      values.has(key)||value===null||typeof date!=="string"||
      !Number.isFinite(Date.parse(date))||Date.parse(date)!==Date.parse(stock.snapshotAt)){
      return unavailable("Marca consignada sem correspondência exata com a posição de estoque.")
    }
    const observed=position.get(key)!
    if(value>observed.stockCost+0.01)return unavailable("Valor da marca consignada excede estoque observado do subgrupo.")
    values.set(key,value)
  }
  const subgroups=stock.subgroups.map(row=>({...row,
    stockCost:Math.max(0,row.stockCost-(values.get(`${row.line}\0${row.subgroup}`)??0)),
  }))
  const consignedCost=[...values.values()].reduce((sum,value)=>sum+value,0)
  const stockCost=subgroups.reduce((sum,row)=>sum+row.stockCost,0)
  if(!Number.isFinite(stockCost)||!Number.isFinite(consignedCost))return unavailable("Consolidação de estoque consignado inválida.")
  return {state:"conectado",snapshotAt:stock.snapshotAt,subgroups,stockCost,consignedCost}
}
