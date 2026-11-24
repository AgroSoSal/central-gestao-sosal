import {cleanup,render,screen} from "@testing-library/react"
import {afterEach,describe,expect,it,vi} from "vitest"

const state=vi.hoisted(()=>({denied:false,missing:false,calls:[] as Array<{name:string;args:unknown}>}))
vi.mock("next/server",()=>({connection:async()=>undefined}))
vi.mock("@/lib/supabase/server",()=>({
  createSupabaseServerClient:async()=>({
    auth:{getUser:async()=>({data:{user:{id:"master-id",email:"master@example.test"}},error:null})},
    rpc:async(name:string,args:unknown)=>{
      state.calls.push({name,args})
      if(state.denied)return {data:null,error:{code:"42501"}}
      if(state.missing)return {data:null,error:null}
      return {data:{
        source:"DESPESA_RASCUNHO_238",id:42,filial:"BDS",
        tipo_pedido:"Despesa/Investimento",authorizesPurchases:false,
        total:39.80,criado_em:"2026-11-24T16:00:00+00:00",
        observacao:"CIF · revisão",status:"RASCUNHO",
        itens:[{codigo:"106374",descricao:"COMBUSTIVEL E OLEO LUBRIFICANTE",
          grupo:"5.DESPESAS",area:"LOGISTICA",conta:"COMBUSTIVEL TROC OLEO",
          tipo:"MAT",quantidade:2,valor_unitario:19.90}],
      },error:null}
    },
  }),
}))
afterEach(()=>{cleanup();state.denied=false;state.missing=false;state.calls=[]})

describe("consulta de despesas Zacarini 2.3.8",()=>{
  it("lista todos os itens, somas e classificações sem gerar títulos ou pedidos",async()=>{
    const {ExpenseContent}=await import("./page")
    render(await ExpenseContent({params:Promise.resolve({id:"42"})}))
    expect(screen.getByRole("heading",{name:"Despesa / investimento #42"})).toBeInTheDocument()
    expect(screen.getByRole("table")).toHaveTextContent("106374")
    expect(screen.getByRole("table")).toHaveTextContent("COMBUSTIVEL E OLEO LUBRIFICANTE")
    expect(screen.getByRole("table")).toHaveTextContent("5.DESPESAS")
    expect(screen.getAllByText("R$ 39,80").length).toBeGreaterThan(0)
    expect(screen.getByText(/não altera gastos efetivos/i)).toBeInTheDocument()
    expect(state.calls).toEqual([{name:"fn_compras_despesa_rascunho_detalhar_238",args:{p_id:42}}])
  })
  it("não revela itens se o banco negar acesso Master",async()=>{
    state.denied=true
    const {ExpenseContent}=await import("./page")
    render(await ExpenseContent({params:Promise.resolve({id:"42"})}))
    expect(screen.getByRole("alert")).toHaveTextContent(/Acesso restrito ao Master ativo/i)
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })
  it("não revela itens de uma cotação ausente ou não relacionada",async()=>{
    state.missing=true
    const {ExpenseContent}=await import("./page")
    render(await ExpenseContent({params:Promise.resolve({id:"42"})}))
    expect(screen.getByRole("alert")).toHaveTextContent(/não encontrado ou indisponível/i)
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })
  it("rejeita ID inválido antes da consulta",async()=>{
    const {ExpenseContent}=await import("./page")
    render(await ExpenseContent({params:Promise.resolve({id:"42/../1"})}))
    expect(screen.getByRole("alert")).toHaveTextContent(/Número de rascunho inválido/)
    expect(state.calls).toHaveLength(0)
  })
})
