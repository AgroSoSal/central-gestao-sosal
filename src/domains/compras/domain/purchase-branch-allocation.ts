import { distributePurchase } from "./purchase-zacarini-237"

export type BranchAllocationMetric={filial:string;stock:number|null;pending:number|null;sales90d:number|null}
export const PURCHASE_BRANCHES=["BDS","CG","RIO","CX","PG","AN"] as const

/** Retorna null quando o rateio não possui seis fontes completas e verificáveis. */
export function allocatePurchaseByBranch(input:{quantity:number;targetDde:number|null;rows:BranchAllocationMetric[]}):number[]|null {
  if(!Number.isInteger(input.quantity)||input.quantity<1||input.quantity>100000000
    ||input.targetDde===null||!Number.isFinite(input.targetDde)||input.targetDde<0
    ||input.rows.length!==PURCHASE_BRANCHES.length)return null
  const indexed=new Map<string,BranchAllocationMetric>()
  for(const row of input.rows){
    if(!PURCHASE_BRANCHES.some(f=>f===row.filial)||indexed.has(row.filial)
      ||[row.stock,row.pending,row.sales90d].some(n=>n===null||!Number.isFinite(n)||n<0))return null
    indexed.set(row.filial,row)
  }
  const ordered=PURCHASE_BRANCHES.map(branch=>indexed.get(branch))
  if(ordered.some(row=>!row))return null
  const totalSales=ordered.reduce((sum,row)=>sum+row!.sales90d!,0)
  if(!Number.isFinite(totalSales)||totalSales<=0)return null
  const weights=ordered.map(row=>{
    const sales=row!.sales90d!
    const need=input.targetDde!*(sales/90)-row!.stock!-row!.pending!
    return Math.max(0.0001*sales,need)
  })
  if(weights.some(w=>!Number.isFinite(w)||w<0)||!weights.some(w=>w>0))return null
  return distributePurchase(input.quantity,weights)
}
