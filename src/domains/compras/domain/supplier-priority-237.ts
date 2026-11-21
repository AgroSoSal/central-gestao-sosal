/** COMP-058: somente pré-ranking indicativo do lote consultado, sem autorização financeira. */
export type SupplierPriorityItem = {
  code:string; supplier:string|null; line:number|null; stock:number|null;
  sales90d:number|null; suggestedQuantity:number|null; lastCost:number|null
}
export type SupplierPriority = {
  supplier:string|null; skuCount:number; urgentCount:number; unverifiedCount:number;
  suggestedUnits:number|null; referenceValue:number|null
}

const validMoney=(value:number|null):value is number=>value!==null&&Number.isFinite(value)&&value>=0

export function rankSuppliersByNeed(items:SupplierPriorityItem[]):SupplierPriority[] {
  const groups=new Map<string,{row:SupplierPriority;quantity:number;cents:number}>()
  for(const item of items){
    const supplier=item.supplier?.trim()||null
    const key=supplier??"\0sem_fornecedor"
    let group=groups.get(key)
    if(!group){
      group={row:{supplier,skuCount:0,urgentCount:0,unverifiedCount:0,
        suggestedUnits:null,referenceValue:null},quantity:0,cents:0}
      groups.set(key,group)
    }
    group.row.skuCount++
    const knownCoverage=validMoney(item.stock)&&validMoney(item.sales90d)
    if(validMoney(item.stock)&&validMoney(item.sales90d)&&item.sales90d>0
      &&item.stock/(item.sales90d/90)<30)group.row.urgentCount++
    const eligible=supplier!==null&&Number.isInteger(item.line)&&item.line!==null
      &&item.line>=1&&item.line<=4&&knownCoverage&&Number.isInteger(item.suggestedQuantity)
      &&validMoney(item.suggestedQuantity)&&validMoney(item.lastCost)
    if(!eligible){group.row.unverifiedCount++;continue}
    group.quantity+=item.suggestedQuantity!
    group.cents+=Math.round(item.suggestedQuantity!*item.lastCost!*100)
  }
  for(const group of groups.values()){
    if(group.row.unverifiedCount!==0)continue
    group.row.suggestedUnits=group.quantity
    group.row.referenceValue=group.cents/100
  }
  return [...groups.values()].map(g=>g.row).sort((a,b)=>{
    if(a.supplier===null)return 1
    if(b.supplier===null)return -1
    return b.urgentCount-a.urgentCount||(b.referenceValue??-1)-(a.referenceValue??-1)
      ||a.supplier.localeCompare(b.supplier,"pt-BR")
  })
}
