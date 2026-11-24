import { describe,expect,it } from "vitest"
import { interpretOtbOrderSource238,matchOtbOrders238 } from "./otb-order-source-238"

const data={
 source:"painel.alex_pedidos_em_aberto",
 date:"2026-11-24",snapshot:"2026-11-24T07:37:05Z",
 authorizesPurchases:false,items:4,pending:6300,
 unmappedItems:1,unmappedValue:300,unmappedTop:[
  {code:"X1",description:"A classificar",items:1,pending:300},
 ],
 groups:[
  {name:"1.LINHA NUTRIÇÃO / MATERIA PRIMA",items:2,pending:5000,prior:4800,recorded:[200,0,0]},
  {name:"3.OUTROS / ACESS RIOS",items:1,pending:1000,prior:1000,recorded:[0,0,0]},
 ],
}
describe("RPC carteira de pedidos 2.3.8",()=>{
 it("valida três meses e não homologa dados por ser apenas uma fotografia aberta",()=>{
  const out=interpretOtbOrderSource238(data,null,"2026-11-24")
  expect(out.state).toBe("conectado")
  expect(out.authorizesPurchases).toBe(false)
  if(out.state!=="conectado")throw Error(out.reason)
  expect(out.groups[0].prior).toBe(4800)
  expect(out.groups[0].recorded).toEqual([200,0,0])
  expect(out.unmappedValue).toBe(300)
 })
 it("corresponde nomes inteiros e recupera acentos perdidos sem correspondência parcial",()=>{
  const out=interpretOtbOrderSource238(data,null,"2026-11-24")
  if(out.state!=="conectado")throw Error(out.reason)
  const match=matchOtbOrders238(out,[
   "1.LINHA NUTRIÇÃO / MATERIA PRIMA","3.OUTROS / ACESSÓRIOS","4.PASTAGEM / PRODUTOS",
  ])
  expect(match.matched.size).toBe(2)
  expect(match.unmatched).toHaveLength(0)
  expect(match.matched.get("3.OUTROS / ACESSÓRIOS")?.prior).toBe(1000)
 })
 it("bloqueia RPC faltante, data errada, negativos e subgrupo duplicado",()=>{
  expect(interpretOtbOrderSource238(null,null,"2026-11-24").state).toBe("indisponivel")
  expect(interpretOtbOrderSource238(data,null,"2026-11-25").state).toBe("indisponivel")
  expect(interpretOtbOrderSource238({...data,groups:[...data.groups,data.groups[0]]},null,"2026-11-24").state).toBe("indisponivel")
  expect(interpretOtbOrderSource238({...data,groups:[{...data.groups[0],prior:-5}]},null,"2026-11-24").state).toBe("indisponivel")
 })
 it("nunca atribui classificação ambígua",()=>{
  const out=interpretOtbOrderSource238(data,null,"2026-11-24")
  if(out.state!=="conectado")throw Error(out.reason)
  const match=matchOtbOrders238(out,["1.LINHA NUTRIÇÃO / MATERIA PRIMA","3.OUTROS / ACESSÓRIOS","3.OUTROS / ACESS RIOS"])
  expect(match.unmatched.some(g=>g.name==="3.OUTROS / ACESS RIOS")).toBe(false) // correspondência exata é prioritária
 })
})
