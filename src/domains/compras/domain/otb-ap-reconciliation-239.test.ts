import { describe, expect, it } from "vitest"
import { interpretOtbApAudit239 } from "./otb-ap-reconciliation-239"

const source={
 date:"2026-11-24",source:"RPA fornecedores_a_pagar: exclusivamente a importação mais recente + pedidos ainda abertos",
 latestImport:44,latestImportedAt:"2026-11-23T12:24:38Z",
 apRows:4306,apValue12m:28981926.41,orderGroups:2508,orderPending:63104289.74,
 candidatePairs:116,uniqueCandidates:59,uniqueCandidateValue:777205.86,
 duplicateApKeys:6,duplicateApExtraRows:20,confirmedMatches:0,cashAddition:0,
 authorizesPurchases:false,
 samples:[{loja:"ANASTACIO",pedido:"227",codigo:"100620",titulo:"63591",
  parcela:"1/1",vencimento:"2026-12-10",pendente:156,valor:156,resultado:"CANDIDATO_NAO_COMPROVADO"}],
}
describe("Auditoria Master de pedidos × AP",()=>{
 it("preserva diferença entre candidato e título conciliado",()=>{
   const r=interpretOtbApAudit239(source,null,"2026-11-24")
   expect(r.state).toBe("auditado")
   if(r.state!=="auditado")throw Error(r.reason)
   expect(r.apRows).toBe(4306)
   expect(r.uniqueCandidates).toBe(59)
   expect(r.cashAddition).toBe(0)
   expect(r.confirmedMatches).toBe(0)
   expect(r.authorizesPurchases).toBe(false)
   expect(r.samples[0].resultado).toBe("CANDIDATO_NAO_COMPROVADO")
 })
 it("não assume conferência aprovada por alteração na resposta",()=>{
  for(const diff of [
    {cashAddition:100},
    {confirmedMatches:59},
    {authorizesPurchases:true},
    {date:"2026-11-25"},
    {apRows:-1},
    {samples:[{...source.samples[0],resultado:"CONFIRMADO"}]},
  ]){
   expect(interpretOtbApAudit239({...source,...diff},null,"2026-11-24").state)
     .toBe("indisponivel")
  }
 })
 it("falha fechado quando Supabase não responde",()=>{
  expect(interpretOtbApAudit239(null,null,"2026-11-24").state).toBe("indisponivel")
  expect(interpretOtbApAudit239(source,{message:"fail"},"2026-11-24").state).toBe("indisponivel")
 })
})
