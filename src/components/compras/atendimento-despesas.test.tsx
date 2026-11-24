import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AtendimentoDespesas } from "./atendimento-despesas"
const state=vi.hoisted(()=>({save:vi.fn(async(_args:unknown)=>({data:42,error:null})),refresh:vi.fn()}))
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:state.refresh})}))
vi.mock("@/lib/supabase/client",()=>({createSupabaseBrowserClient:()=>({rpc:(name:string,args:unknown)=>{
  if(name!=="fn_compras_salvar_despesa_rascunho_237")throw new Error("RPC inesperada "+name)
  return state.save(args)
}})}))
afterEach(()=>{cleanup();state.save.mockClear();state.refresh.mockClear()})
const catalog=[
  {codigo:"106399",descricao:"SERVICO MANUTENCAO MAQUINA INDSUTRIAL",tipo:"SERV" as const,
    grupo:"5.DESPESAS" as const,area:"INDUSTRIAL",conta:"MANUT MAQUINAS"},
  {codigo:"106396",descricao:"VEICULOS",tipo:"MAT" as const,
    grupo:"6.INVESTIMENTO" as const,area:"INVESTIMENTO",conta:"VEICULOS"}
]
describe("Atendimento Fornecedor 2.3.7 · despesas e investimentos",()=>{
  it("informa cadastro e custo por linha fora da verba da OTB",()=>{
    render(<AtendimentoDespesas branch="BDS" catalog={catalog}/>)
    fireEvent.click(screen.getByRole("button",{name:"Abrir bloco ⑨"}))
    expect(screen.getByText(/grupos 5 e 6 ficam fora/i)).toBeInTheDocument()
    expect(screen.getByText(/não reserva orçamento/)).toBeInTheDocument()
  })
  it("salva apenas rascunho de despesa sem criar pedido operacional",async()=>{
    render(<AtendimentoDespesas branch="BDS" catalog={catalog}/>)
    fireEvent.click(screen.getByRole("button",{name:"Abrir bloco ⑨"}))
    fireEvent.change(screen.getByLabelText("Produto despesa 1"),{target:{value:"106399"}})
    fireEvent.change(screen.getByLabelText("Quantidade despesa 1"),{target:{value:"2"}})
    fireEvent.change(screen.getByLabelText("Custo despesa 1"),{target:{value:"35"}})
    expect(screen.getAllByText(/R\$\s*70,00/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole("button",{name:"Salvar rascunho no Supabase"}))
    await waitFor(()=>expect(state.save).toHaveBeenCalledTimes(1))
    expect((state.save.mock.calls[0][0] as {p_itens: unknown}).p_itens).toEqual([{codigo:"106399",quantidade:2,valor_unitario:35}])
    expect(await screen.findByText(/Nenhuma emissão realizada/)).toBeInTheDocument()
  })
  it("permite reabrir apenas os rascunhos de despesas fornecidos pelo servidor",()=>{
    render(<AtendimentoDespesas branch="BDS" catalog={catalog} drafts={[
      {id:42,filial:"BDS",total:39.80,itens_count:1,observacao:"teste",criado_em:"2026-11-24T16:00:00Z"},
    ]}/>)
    expect(screen.getByRole("link",{name:"Conferir despesa salva"})).toHaveAttribute(
      "href","/compras/atendimento/despesa/42")
    expect(screen.queryByRole("link",{name:/Cotação/i})).not.toBeInTheDocument()
  })
  it("não inventa histórico quando o Supabase não autoriza a listagem",()=>{
    render(<AtendimentoDespesas branch="BDS" catalog={catalog} draftsUnavailable/>)
    expect(screen.getByRole("alert")).toHaveTextContent(/Histórico de despesas indisponível/i)
    expect(screen.queryByRole("link",{name:/Conferir despesa salva/})).not.toBeInTheDocument()
  })
  it("não grava sem catálogo autorizado",()=>{
    render(<AtendimentoDespesas branch="BDS" catalog={[]} unavailable/>)
    fireEvent.click(screen.getByRole("button",{name:"Abrir bloco ⑨"}))
    expect(screen.getByRole("alert")).toHaveTextContent(/Catálogo indisponível/)
    expect(screen.getByRole("button",{name:"Salvar rascunho no Supabase"})).toBeDisabled()
  })
})
