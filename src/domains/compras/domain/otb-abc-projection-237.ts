/** ABCEstoque_DDE!D:P e U:V — cálculo da Zacarini 2.3.7, isolado do Excel.
 * A foto mensal vem do Supabase. Não transforma projeção em verba aprovada.
 */
export type OtbAbcSkuInput = {
  qty90:number;sales90:number;cost90:number
  priorNextQty:number;newStoreQty90:number;priorNextSales:number;priorNextCost:number
  productGrowth:number|null;subgroupGrowth:number|null;productionUnitCost:number
}

export function calculateOtbAbcSku(x:OtbAbcSkuInput) {
  const growthSource=x.productGrowth!==null?"Produto":x.subgroupGrowth!==null?"Subgrupo":"Sem histórico"
  const growth=Math.min(4,Math.max(0,x.productGrowth??x.subgroupGrowth??1))
  const projectedQty=growth*x.priorNextQty+x.newStoreQty90
  const salePrice=x.qty90>0?x.sales90/x.qty90:
    x.priorNextQty>0?x.priorNextSales/x.priorNextQty:0
  const grossUnit=x.qty90>0?(x.sales90-x.cost90-x.qty90*x.productionUnitCost)/x.qty90:
    x.priorNextQty>0?(x.priorNextSales-x.priorNextCost)/x.priorNextQty-x.productionUnitCost:0
  return {growthSource,growth,projectedQty,
    projectedSales90:projectedQty*salePrice,projectedGross90:projectedQty*grossUnit}
}

export type OtbAbcSubgroup={line:1|2|3|4;name:string;projectedSales90:number;
  projectedCmv90:number;curveASales90:number;skuCount:number;pendingProductionCosts:number}
export type OtbAbcProjection=
  | {state:"indisponivel";reason:string;groups:[]}
  | {state:"conectado";snapshotAt:string;groups:OtbAbcSubgroup[];pendingProductionCosts:number}

const unavailable=(reason:string):OtbAbcProjection=>({state:"indisponivel",reason,groups:[]})
const nonnegative=(value:unknown):number|null=>{
  if((typeof value!=="string"&&typeof value!=="number")||value==="")return null
  const n=Number(value)
  return Number.isFinite(n)&&n>=0&&n<=1e15?n:null
}
export function interpretOtbAbcProjection(data:unknown,error:unknown):OtbAbcProjection{
  if(error||!Array.isArray(data)||data.length===0)return unavailable("Projeção ABC por SKU não disponível na consulta Master.")
  let snapshotAt=""
  const groups:OtbAbcSubgroup[]=[]
  const keys=new Set<string>()
  let pendingProductionCosts=0
  for(const raw of data){
    if(!raw||typeof raw!=="object"||Array.isArray(raw))return unavailable("Projeção ABC inválida.")
    const r=raw as Record<string,unknown>
    const line=r.linha
    const name=r.grupo_subgrupo
    const sale=nonnegative(r.venda_projetada_90d)
    const cmv=nonnegative(r.cmv_projetado_90d)
    const curveA=nonnegative(r.venda_curva_a_90d)
    const sku=nonnegative(r.skus)
    const pending=nonnegative(r.custos_producao_pendentes)
    const date=r.data_fim
    if((line!==1&&line!==2&&line!==3&&line!==4)||typeof name!=="string"||!name.trim()||name.length>250||
      sale===null||cmv===null||curveA===null||curveA>sale+0.01||
      sku===null||!Number.isSafeInteger(sku)||sku<1||pending===null||!Number.isSafeInteger(pending)||
      typeof date!=="string"||!/^20\d\d-\d\d-\d\d$/.test(date)||
      (snapshotAt!==""&&date!==snapshotAt))return unavailable("Projeção ABC incompleta ou inconsistente.")
    const key=`${line}\0${name}`
    if(keys.has(key))return unavailable("Subgrupo ABC duplicado.")
    keys.add(key)
    snapshotAt=date
    pendingProductionCosts+=pending
    groups.push({line,name,projectedSales90:sale,projectedCmv90:cmv,
      curveASales90:curveA,skuCount:sku,pendingProductionCosts:pending})
  }
  return {state:"conectado",snapshotAt,groups,pendingProductionCosts}
}
