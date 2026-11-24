/** Contrato da carteira real de pedidos (Zacarini 2.3.8, OTB!J/V/AE/AN).
 * Fonte: RPC Master fn_otb_carteira_subgrupos_238, sem exportar linhas do cliente.
 * Apenas pendência atual e pedidos ainda abertos. NÃO autoriza compras.
 */
export type OtbOrderGroup238={
  name:string;items:number;pending:number;prior:number;
  recorded:readonly [number,number,number]
}
export type OtbUnmappedProduct238={code:string;description:string;items:number;pending:number}
export type OtbOrderSource238=
 | {state:"indisponivel";reason:string;authorizesPurchases:false}
 | {state:"conectado";base:string;snapshot:string;items:number;pending:number;
    unmappedItems:number;unmappedValue:number;groups:OtbOrderGroup238[];
    unmappedTop:OtbUnmappedProduct238[];authorizesPurchases:false}

const unavailable=(reason:string):OtbOrderSource238=>({
 state:"indisponivel",reason,authorizesPurchases:false,
})
const num=(x:unknown,min=0)=>{
 if((typeof x!=="number"&&typeof x!=="string")||x==="")return null
 const n=Number(x)
 return Number.isFinite(n)&&n>=min&&n<=1e15?n:null
}
const date=(x:unknown)=>typeof x==="string"&&/^20\d{2}-\d\d-\d\d$/.test(x)
export function interpretOtbOrderSource238(data:unknown,error:unknown,requestedDate:string):OtbOrderSource238 {
 if(error||!data||typeof data!=="object"||Array.isArray(data))return unavailable("Carteira de pedidos do Supabase indisponível.")
 const x=data as Record<string,unknown>
 const items=num(x.items),pending=num(x.pending),unmappedItems=num(x.unmappedItems),unmappedValue=num(x.unmappedValue)
 if(x.source!=="painel.alex_pedidos_em_aberto"||!date(x.date)||x.date!==requestedDate||
    typeof x.snapshot!=="string"||!Number.isFinite(Date.parse(x.snapshot))||
    items===null||!Number.isSafeInteger(items)||pending===null||
    unmappedItems===null||!Number.isSafeInteger(unmappedItems)||unmappedValue===null||
    x.authorizesPurchases!==false||!Array.isArray(x.groups)||!Array.isArray(x.unmappedTop)||
    x.groups.length>1000||x.unmappedTop.length>100){
    return unavailable("Resposta da carteira inválida, incompleta ou fora da data-base.")
 }
 const seen=new Set<string>(),groups:OtbOrderGroup238[]=[]
 for(const raw of x.groups){
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return unavailable("Grupo de pedidos inválido.")
  const g=raw as Record<string,unknown>
  const n=g.name,c=num(g.items),p=num(g.pending),prior=num(g.prior),recorded=g.recorded
  if(typeof n!=="string"||!n.trim()||seen.has(n)||c===null||!Number.isSafeInteger(c)||
      p===null||prior===null||!Array.isArray(recorded)||recorded.length!==3||
      recorded.some(v=>num(v)===null)){
    return unavailable("Subgrupo ou valor de pedido inválido.")
  }
  seen.add(n)
  groups.push({name:n,items:c,pending:p,prior,recorded:recorded.map(Number) as [number,number,number]})
 }
 const unmappedTop:OtbUnmappedProduct238[]=[]
 for(const r of x.unmappedTop){
  if(!r||typeof r!=="object"||Array.isArray(r))return unavailable("Item sem cadastro inválido.")
  const p=r as Record<string,unknown>;const pendingAmount=num(p.pending);const count=num(p.items)
  if(typeof p.code!=="string"||typeof p.description!=="string"||pendingAmount===null||
     count===null||!Number.isSafeInteger(count))return unavailable("Item sem cadastro inválido.")
  unmappedTop.push({code:p.code,description:p.description,items:count,pending:pendingAmount})
 }
 return {state:"conectado",base:requestedDate,snapshot:x.snapshot,items,pending,
   unmappedItems,unmappedValue,groups,unmappedTop,authorizesPurchases:false}
}

/** A exportação legada substitui algumas letras acentuadas por espaços.
 * Só corresponde se a chave normalizada apontar para UM único grupo.
 */
const accent=/[ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüýÿ]/g
const lost=(s:string)=>s.replace(accent," ").trim().replace(/\s+/g," ").toLocaleUpperCase("pt-BR")
const tidy=(s:string)=>s.trim().replace(/\s+/g," ").toLocaleUpperCase("pt-BR")
export type OtbOrderMatch238={matched:Map<string,OtbOrderGroup238>;unmatched:OtbOrderGroup238[]}
export function matchOtbOrders238(source:Extract<OtbOrderSource238,{state:"conectado"}>,
  previewNames:readonly string[]):OtbOrderMatch238{
 const byName=new Map(previewNames.map(name=>[name,name] as const))
 const aliases=new Map<string,string[]>()
 for(const n of previewNames) {
  for(const a of [tidy(n),lost(n)]) {
   const entries=aliases.get(a)??[]
   if(!entries.includes(n))entries.push(n)
   aliases.set(a,entries)
  }
 }
 const matched=new Map<string,OtbOrderGroup238>(),unmatched:OtbOrderGroup238[]=[]
 for(const group of source.groups){
  const exact=byName.get(group.name)
  const targets=exact?[exact]:[...new Set([
   ...(aliases.get(tidy(group.name))??[]),
   ...(aliases.get(lost(group.name))??[]),
  ])]
  const target=targets.length===1?targets[0]:null
  if(!target||matched.has(target))unmatched.push(group)
  else matched.set(target,group)
 }
 return {matched,unmatched}
}
