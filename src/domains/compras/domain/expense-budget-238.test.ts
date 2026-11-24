import {describe,expect,it} from "vitest"
import {budgetForExpense238,budgetGroupForArea238,parseExpenseBudget238} from "./expense-budget-238"
const month="2026-11-01"
const groups=["Administrativo","Industrial","Investimento","Logística","Marketing","Pessoal"]
const empty=()=>({
 source:"ORC_DADOS_REPLANEJADO_238",status:"manual_sem_homologacao",
 competencia:month,authorizesPurchases:false,
 grupos:groups.map(grupo=>({grupo,qtd_itens:0,orcamento:null as number|null,saldo_assinado:null as number|null})),
 itens:[],
})
describe("Orc_Dados → Atendimento!I51:I58 Zacarini 2.3.8",()=>{
 it("traduz exatamente as 6 ÁREAS de Cad_Despesas!F/H para Grupo do orçamento",()=>{
  expect([
    ["LOGISTICA","Logística"],["MARKETING","Marketing"],
    ["PESSOAL","Pessoal"],["ADMINISTRATIVO","Administrativo"],
    ["INDUSTRIAL","Industrial"],["INVESTIMENTO","Investimento"],
  ].map(([area])=>budgetGroupForArea238(area))).toEqual([
    "Logística","Marketing","Pessoal","Administrativo","Industrial","Investimento",
  ])
  expect(budgetGroupForArea238("SEM REGRA")).toBeNull()
 })
 it("ausência de orçamento não vira zero",()=>{
  const valid=parseExpenseBudget238(empty(),month)
  expect(valid).not.toBeNull()
  expect(budgetForExpense238(valid,"LOGISTICA")).toBeNull()
 })
 it("preserva o ABS após soma de itens positivos e negativos",()=>{
  const payload=empty()
  const idx=payload.grupos.findIndex(x=>x.grupo==="Logística")
  payload.grupos[idx]={grupo:"Logística",qtd_itens:2,saldo_assinado:-90,orcamento:90}
  const parsed=parseExpenseBudget238(payload,month)
  expect(budgetForExpense238(parsed,"LOGISTICA")).toBe(90)
  expect(budgetForExpense238(parsed,"ADMINISTRATIVO")).toBeNull()
 })
 it("rejeita consulta não homologável, com mês errado ou grupo sem fonte apresentado como zero",()=>{
  const wrong=empty();wrong.competencia="2026-12-01"
  expect(parseExpenseBudget238(wrong,month)).toBeNull()
  const bad=empty();bad.grupos[0].orcamento=0
  expect(parseExpenseBudget238(bad,month)).toBeNull()
  const approve=empty();approve.authorizesPurchases=true
  expect(parseExpenseBudget238(approve,month)).toBeNull()
 })
})
