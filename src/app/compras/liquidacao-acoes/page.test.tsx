import {cleanup,render,screen} from "@testing-library/react"
import {afterEach,describe,expect,it,vi} from "vitest"

const state=vi.hoisted(()=>({denied:false,calls:[] as Array<{name:string;args:unknown}>}))
vi.mock("next/server",()=>({connection:async()=>undefined}))
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn()})}))
vi.mock("@/lib/supabase/server",()=>({
 createSupabaseServerClient:async()=>({
  auth:{getUser:async()=>({data:{user:{email:"master@example.test"}},error:null})},
  rpc:async(name:string,args:unknown)=>{
   state.calls.push({name,args})
   return {
    error:state.denied?{code:"42501"}:null,
    data:{
     source:"LIQUIDACAO_ACOES_238",status:"planejamento_nao_executado",
     authorizesTransfers:false,total:1,pagina:1,tamanho:30,
     itens:[{id:12,filial:"BDS",produto_codigo:"100101",
      tipo_acao:"transferencia",filial_destino:"CG",
      meta_quantidade:5,responsavel:"Equipe de Compras",data_limite:"2026-12-15",
      situacao:"Planejada",observacao:null,atualizado_em:"2026-11-24T10:00:00Z"}],
    },
   }
  },
 }),
}))
afterEach(()=>{cleanup();state.denied=false;state.calls=[]})
describe("ações planejadas de liquidação 2.3.8",()=>{
 it("consulta e permite planejar sem executar transferência no SISCOM",async()=>{
  const {ActionsContent}=await import("./page")
  render(await ActionsContent({searchParams:Promise.resolve({filial:"BDS",sku:"100101"})}))
  expect(screen.getByRole("heading",{name:"Plano operacional de liquidação"})).toBeInTheDocument()
  expect(screen.getByRole("table")).toHaveTextContent("100101")
  expect(screen.getByRole("table")).toHaveTextContent("Equipe de Compras")
  expect(screen.getByRole("table")).toHaveTextContent("CG")
  expect(screen.getByText(/Não movimenta o SISCOM/i)).toBeInTheDocument()
  expect(state.calls).toEqual([{name:"fn_compras_liquidacao_acoes_listar_238",
    args:{p_filial:"BDS",p_produto_codigo:"100101",p_pagina:1,p_tamanho:30}}])
 })
 it("bloqueia formulário e detalhes quando banco nega Master",async()=>{
  state.denied=true
  const {ActionsContent}=await import("./page")
  render(await ActionsContent({searchParams:Promise.resolve({})}))
  expect(screen.getByRole("alert")).toHaveTextContent(/Acesso restrito ao Master ativo/i)
  expect(screen.queryByRole("button",{name:"Salvar planejamento"})).not.toBeInTheDocument()
  expect(screen.queryByRole("table")).not.toBeInTheDocument()
 })
})
