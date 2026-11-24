import {cleanup,render,screen} from "@testing-library/react"
import {afterEach,describe,expect,it,vi} from "vitest"

const state = vi.hoisted(()=>({ denied:false }))
vi.mock("next/server",()=>({connection:async()=>undefined}))
vi.mock("@/lib/supabase/server",()=>({
  createSupabaseServerClient:async()=>({
    auth:{getUser:async()=>({data:{user:{email:"master@sosal.com.br"}},error:null})},
    rpc:async()=>({
      error:state.denied?{code:"42501"}:null,
      data:{
        source:"COTACAO_RASCUNHO_238",id:42,filial:"BDS",total:195.75,
        status:"RASCUNHO",tipo_pedido:"Mercadoria",
        criado_em:"2026-11-24T16:00:00+00:00",observacao:"Somente teste",
        estado_operacional:"RASCUNHO_NAO_AUTORIZADO",authorizesPurchases:false,
        itens:[{produto_codigo:"100101",descricao:"Produto de teste",quantidade:10,
          custo_unitario:20.50,desconto_percentual:4.5,
          fornecedor:"Fornecedor teste",frete:"CIF",condicao_pagamento:"30/60"}],
      },
    }),
  }),
}))
afterEach(()=>{cleanup();state.denied=false})

describe("detalhamento da cotação salva 2.3.8",()=>{
  it("mostra a cotação preservada sem confundir com pedido aprovado",async()=>{
    const {QuoteContent}=await import("./page")
    render(await QuoteContent({params:Promise.resolve({id:"42"})}))
    expect(screen.getByRole("heading",{name:"Cotação registrada #42"})).toBeInTheDocument()
    expect(screen.getByRole("table")).toHaveTextContent("100101")
    expect(screen.getByRole("table")).toHaveTextContent("Fornecedor teste")
    expect(screen.getByRole("table")).toHaveTextContent("30/60")
    expect(screen.getByText("R$ 195,75")).toBeInTheDocument()
    expect(screen.getByText(/Cotação salva não é autorização/)).toBeInTheDocument()
  })
  it("nega acesso e não vaza itens se a RPC retornar erro",async()=>{
    state.denied=true
    const {QuoteContent}=await import("./page")
    render(await QuoteContent({params:Promise.resolve({id:"42"})}))
    expect(screen.getByRole("alert")).toHaveTextContent(/Acesso restrito ao Master ativo/)
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })
  it("recusa ID inválido sem consultar rascunhos",async()=>{
    const {QuoteContent}=await import("./page")
    render(await QuoteContent({params:Promise.resolve({id:"../42"})}))
    expect(screen.getByRole("alert")).toHaveTextContent(/Número da cotação inválido/)
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })
})
