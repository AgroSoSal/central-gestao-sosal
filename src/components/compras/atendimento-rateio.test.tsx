import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AtendimentoFornecedor } from "./atendimento-fornecedor"

const mocks=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn()})}))
vi.mock("@/lib/supabase/client",()=>({createSupabaseBrowserClient:()=>({rpc:mocks.rpc})}))
afterEach(()=>{cleanup();mocks.rpc.mockReset()})

const product={produto_cod:"90001",descricao:"Sal mineral de teste",marca:"Marca A",fornecedor:"Fornecedor A",
  grupo_subgrupo:"1.LINHA / MINERAL",linha:1,estoque_qtde:10,pedido_pendente_qtde:0,
  venda_qtde_90d:900,venda_valor_90d:9000,cmv_90d:6000,ultimo_custo:10,preco_venda_medio:20}
const props={products:[product],branch:"REDE",baseDate:"2026-11-19",drafts:[],ddeMetas:[{
  produto_codigo:"90001",grupo_subgrupo:"1.LINHA / MINERAL",competencia:"2026-12-01",
  dde_meta:45,origem:"Plano de Estoque"}],ddeObservado:[],posicaoConectada:false,competencia:"2026-12-01"}
const rows=["BDS","CG","RIO","CX","PG","AN"].map(filial=>({produto_codigo:"90001",filial,
  estoque_qtde:0,pedido_pendente:0,venda_qtde_90d:filial==="BDS"?450:filial==="CG"?900:0}))

describe("Atendimento — rateio da rede com origem verificada",()=>{
  it("não calcula partes quando um campo da RPC retorna nulo",async()=>{
    mocks.rpc.mockResolvedValueOnce({data:rows.map((r,i)=>i===0?{...r,estoque_qtde:null}:r),error:null})
    render(<AtendimentoFornecedor {...props}/> )
    fireEvent.change(screen.getByLabelText("Quantidade 90001"),{target:{value:"9"}})
    fireEvent.click(screen.getByRole("button",{name:/Calcular rateio/i}))
    expect(await screen.findByText(/Sem fonte suficiente para rateio/i)).toBeInTheDocument()
    expect(screen.queryByText("✔ Confere")).not.toBeInTheDocument()
  })

  it("exibe a soma exata quando as seis filiais possuem métricas completas",async()=>{
    mocks.rpc.mockResolvedValueOnce({data:rows,error:null})
    render(<AtendimentoFornecedor {...props}/> )
    fireEvent.change(screen.getByLabelText("Quantidade 90001"),{target:{value:"9"}})
    fireEvent.click(screen.getByRole("button",{name:/Calcular rateio/i}))
    expect(await screen.findByText("✔ Confere")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText("6")).toBeInTheDocument()
  })
})
