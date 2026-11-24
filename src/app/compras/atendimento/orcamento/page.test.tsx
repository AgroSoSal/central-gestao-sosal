import {cleanup,render,screen} from "@testing-library/react"
import {afterEach,describe,expect,it,vi} from "vitest"

const state=vi.hoisted(()=>({error:false}))
vi.mock("next/server",()=>({connection:async()=>undefined}))
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn()})}))
vi.mock("@/lib/supabase/server",()=>({
 createSupabaseServerClient:async()=>({
  auth:{getUser:async()=>({data:{user:{email:"master@example.test"}},error:null})},
  rpc:async()=>({
   error:state.error?{code:"42501"}:null,
   data:{
    source:"ORC_DADOS_REPLANEJADO_238",
    competencia:"2026-11-01",status:"manual_sem_homologacao",authorizesPurchases:false,
    grupos:["Administrativo","Industrial","Investimento","Logística","Marketing","Pessoal"].map(
      grupo=>grupo==="Logística"?{grupo,qtd_itens:2,orcamento:90,saldo_assinado:-90}:
      {grupo,qtd_itens:0,orcamento:null,saldo_assinado:null}),
    itens:[{id:1,grupo:"Logística",item:"FRETE",valor:-110,atualizado_em:"2026-11-24T00:00:00Z"},
           {id:2,grupo:"Logística",item:"SERVICO",valor:20,atualizado_em:"2026-11-24T00:00:00Z"}],
   },
  }),
 }),
}))
afterEach(()=>{cleanup();state.error=false})

describe("Orc_Dados Replanejado Zacarini 2.3.8",()=>{
 it("exibe ABS(SOMA dos valores) por grupo e mantém grupos ausentes sem valor",async()=>{
  const {BudgetContent}=await import("./page")
  render(await BudgetContent({searchParams:Promise.resolve({mes:"2026-11"})}))
  expect(screen.getByRole("heading",{name:/Orçamento Replanejado por grupo/i})).toBeInTheDocument()
  expect(screen.getByText("R$ 90,00")).toBeInTheDocument()
  expect(screen.getAllByText("Não cadastrado").length).toBe(5)
  expect(screen.getByRole("table")).toHaveTextContent("FRETE")
  expect(screen.getByRole("table")).toHaveTextContent("-R$ 110,00")
  expect(screen.getByText(/não representam aprovação financeira/i)).toBeInTheDocument()
 })
 it("não exibe dados nem formulário de gravação sem permissão Master",async()=>{
  state.error=true
  const {BudgetContent}=await import("./page")
  render(await BudgetContent({searchParams:Promise.resolve({mes:"2026-11"})}))
  expect(screen.getByRole("alert")).toHaveTextContent(/Acesso restrito ao Master ativo/i)
  expect(screen.queryByRole("table")).not.toBeInTheDocument()
  expect(screen.queryByRole("button",{name:"Salvar item"})).not.toBeInTheDocument()
 })
})
