/**
 * Auditoria da carteira de pedidos × contas a pagar.
 * A relação entre um pedido e um título é CANDIDATA: o RPA do título
 * não contém chave do pedido. Nenhum abatimento automático é permitido.
 */
export type OtbApCandidate239={
  loja:string;pedido:string;codigo:string;titulo:string;parcela:string;
  vencimento:string|null;pendente:number;valor:number;
  resultado:"CANDIDATO_NAO_COMPROVADO"
}
export type OtbApAudit239=
 | {state:"indisponivel";reason:string}
 | {state:"auditado";base:string;latestImportedAt:string|null;
    latestImport:number;apRows:number;apValue12m:number;orderGroups:number;
    orderPending:number;candidatePairs:number;uniqueCandidates:number;
    uniqueCandidateValue:number;duplicateApKeys:number;duplicateApExtraRows:number;
    samples:readonly OtbApCandidate239[];
    confirmedMatches:0;cashAddition:0;authorizesPurchases:false}

function finite(value:unknown):number|null{
 if(typeof value!=="number" && typeof value!=="string")return null
 const n=Number(value)
 return Number.isFinite(n)&&n>=0&&n<1e15?n:null
}
export function interpretOtbApAudit239(raw:unknown,error:unknown,base:string):OtbApAudit239{
 const fail=(reason:string):OtbApAudit239=>({state:"indisponivel",reason})
 if(error||!raw||Array.isArray(raw)||typeof raw!=="object")
   return fail("Auditoria entre pedidos e contas a pagar indisponível.")
 const x=raw as Record<string,unknown>
 if(x.date!==base||x.authorizesPurchases!==false||x.cashAddition!==0||
    x.confirmedMatches!==0||!Array.isArray(x.samples)||x.samples.length>20)
   return fail("Auditoria não comprova sua origem ou preservação do caixa.")
 const intNames=["latestImport","apRows","orderGroups","candidatePairs","uniqueCandidates","duplicateApKeys","duplicateApExtraRows"] as const
 const moneyNames=["apValue12m","orderPending","uniqueCandidateValue"] as const
 const parsed:Record<string,number>={}
 for(const key of [...intNames,...moneyNames]){
   const n=finite(x[key])
   if(n===null||(intNames as readonly string[]).includes(key)&&!Number.isSafeInteger(n))return fail("Contagem ou valor financeiro inconsistente.")
   parsed[key]=n
 }
 if(typeof x.latestImportedAt!=="string" || !Number.isFinite(Date.parse(x.latestImportedAt)))
   return fail("Importação de títulos sem data comprovada.")
 const samples:OtbApCandidate239[]=[]
 for(const entry of x.samples){
  if(!entry||Array.isArray(entry)||typeof entry!=="object")return fail("Candidato inválido.")
  const s=entry as Record<string,unknown>
  if(["loja","pedido","codigo","titulo","parcela"].some(k=>typeof s[k]!=="string")||
     s.resultado!=="CANDIDATO_NAO_COMPROVADO"||
     (s.vencimento!==null&&typeof s.vencimento!=="string")||
     finite(s.pendente)===null||finite(s.valor)===null)return fail("Candidato inválido.")
  samples.push({
    loja:s.loja as string,pedido:s.pedido as string,codigo:s.codigo as string,
    titulo:s.titulo as string,parcela:s.parcela as string,
    vencimento:s.vencimento as string|null,pendente:Number(s.pendente),
    valor:Number(s.valor),resultado:"CANDIDATO_NAO_COMPROVADO",
  })
 }
 return {
  state:"auditado",base,latestImportedAt:x.latestImportedAt,
  latestImport:parsed.latestImport,apRows:parsed.apRows,
  apValue12m:parsed.apValue12m,orderGroups:parsed.orderGroups,
  orderPending:parsed.orderPending,candidatePairs:parsed.candidatePairs,
  uniqueCandidates:parsed.uniqueCandidates,uniqueCandidateValue:parsed.uniqueCandidateValue,
  duplicateApKeys:parsed.duplicateApKeys,duplicateApExtraRows:parsed.duplicateApExtraRows,
  samples,cashAddition:0,confirmedMatches:0,authorizesPurchases:false,
 }
}
