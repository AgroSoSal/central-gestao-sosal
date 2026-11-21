import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AtendimentoFornecedor } from "./atendimento-fornecedor"
import { parseManualInput } from "@/domains/compras/domain/siscom-manual-inputs"
const cloud = vi.hoisted(() => ({ entries: [] as unknown[] }))
vi.mock("@/app/compras/entradas-manuais/actions", () => ({ fetchRemoteManualInputs: async () => ({ status: "success", records: cloud.entries }) }))

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
afterEach(cleanup)

const props = {
  products: [{
    produto_cod: "90001", descricao: "Sal mineral de teste", marca: "Marca de teste",
    fornecedor: "Fornecedor A", grupo_subgrupo: "1.LINHA / MINERAL", linha: 1,
    estoque_qtde: 10, pedido_pendente_qtde: 0, venda_qtde_90d: 900,
    venda_valor_90d: 9000, cmv_90d: 6000, ultimo_custo: 10, preco_venda_medio: 20,
  }],
  branch: "CG", baseDate: "2026-11-19", drafts: [], ddeMetas: [], ddeObservado: [],
  posicaoConectada: false, competencia: "2026-12-01",
}

describe("Atendimento Fornecedor — conferência financeira sem atualização do banco", () => {
  it("inclui comparativo auxiliar de propostas para a negociação selecionada",()=>{
    render(<AtendimentoFornecedor {...props}/> )
    fireEvent.change(screen.getByLabelText("Quantidade 90001"),{target:{value:"10"}})
    expect(screen.getByRole("heading",{name:"Comparar cotações"})).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Fornecedor concorrente/i),{target:{value:"Fornecedor B"}})
    fireEvent.change(screen.getByLabelText(/Custo concorrente 90001/i),{target:{value:"8"}})
    expect(screen.getByText(/-R\$\s*20,00/)).toBeInTheDocument()
    expect(screen.getByText(/não salva os valores no banco/i)).toBeInTheDocument()
  })

  it("executa as cinco validações K22:K26 com premissas editáveis, sem autorizar pedido real", () => {
    render(<AtendimentoFornecedor {...props} />)
    fireEvent.change(screen.getByLabelText("Quantidade 90001"), { target: { value: "10" } })
    expect(screen.getByText(/Parcelas × caixa: falta calendário acumulado/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Ativar conferência financeira de teste/i }))
    const sandbox = screen.getByRole("status", { name: "Conferência financeira de teste" })
    expect(sandbox).toHaveTextContent(/não autoriza pedidos/i)
    expect(screen.getByText(/TESTE: as fórmulas permitiriam gravar/i)).toBeInTheDocument()
    expect(screen.getByText(/Todas as parcelas cabem no caixa/i)).toBeInTheDocument()
    expect(screen.getByText(/Cabe na verba da\(s\) linha\(s\)/i)).toBeInTheDocument()
    expect(screen.queryByText("✔ PODE GRAVAR O PEDIDO")).not.toBeInTheDocument()
    expect(screen.getByText(/RASCUNHO – NÃO ENVIAR SEM APROVAÇÃO/i)).toBeInTheDocument()

    fireEvent.change(within(sandbox.parentElement!).getByLabelText(/Teto acumulado de caixa.*teste/i), {
      target: { value: "0" },
    })
    expect(screen.getByText(/parcela\(s\) acima do limite/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Encerrar conferência de teste/i }))
    expect(screen.getByText(/Parcelas × caixa: falta calendário acumulado/i)).toBeInTheDocument()
  })

  it("bloqueia caixa, giro e verba com valores incompatíveis ou incompletos", () => {
    render(<AtendimentoFornecedor {...props} />)
    fireEvent.change(screen.getByLabelText("Quantidade 90001"), { target: { value: "10" } })
    fireEvent.click(screen.getByRole("button", { name: /Ativar conferência financeira de teste/i }))
    const sandbox = screen.getByRole("status", { name: "Conferência financeira de teste" })

    fireEvent.change(within(sandbox).getByLabelText(/Custo diário previsto/i), { target: { value: "0.5" } })
    expect(screen.getByText(/Paga antes de vender/i)).toBeInTheDocument()

    fireEvent.change(within(sandbox).getByLabelText(/Saldo da linha 1/i), { target: { value: "20" } })
    expect(screen.getByText(/Estoura a verba/i)).toBeInTheDocument()

    fireEvent.change(within(sandbox).getByLabelText(/Custo diário previsto/i), { target: { value: "" } })
    expect(screen.getByText(/PMP × giro: falta custo diário previsto/i)).toBeInTheDocument()
    expect(within(sandbox).getByRole("alert")).toHaveTextContent(/Revise as premissas/i)
    expect(screen.queryByText("✔ PODE GRAVAR O PEDIDO")).not.toBeInTheDocument()
  })

  it("K23 usa o vencimento mais próximo mesmo com parcelas informadas fora de ordem", () => {
    render(<AtendimentoFornecedor {...props} />)
    fireEvent.change(screen.getByLabelText("Quantidade 90001"), { target: { value: "10" } })
    fireEvent.change(screen.getByLabelText(/Condição especial/i), { target: { value: "90/30" } })
    fireEvent.click(screen.getByRole("button", { name: /Ativar conferência financeira de teste/i }))
    const sandbox = screen.getByRole("status", { name: "Conferência financeira de teste" })
    fireEvent.change(within(sandbox).getByLabelText(/Data de liberação/i), { target: { value: "2027-01-01" } })
    expect(screen.getByText(/1ª parcela antes de 2027-01-01/i)).toBeInTheDocument()
  })

  it("exibe pré-ranking indicativo da busca, sem confundir sugestão com verba aprovada",()=>{
    render(<AtendimentoFornecedor {...props} ddeMetas={[{
      produto_codigo:"90001",grupo_subgrupo:"1.LINHA / MINERAL",competencia:"2026-12-01",
      dde_meta:45,origem:"Plano de Estoque",
    }]}/> )
    expect(screen.getByRole("heading",{name:/Pré-ranking de fornecedores/i})).toBeInTheDocument()
    expect(screen.getByText(/Fornecedor A/)).toBeInTheDocument()
    expect(screen.getByText(/4\.400,00/)).toBeInTheDocument()
    expect(screen.getByText(/não representa cotação concorrente nem autorização/i)).toBeInTheDocument()
  })

  it("não sugere compra de estoque e vendas desconhecidos e sinaliza pendência no fornecedor",()=>{
    const missing={...props.products[0],estoque_qtde:null,venda_qtde_90d:null,
      pedido_pendente_qtde:null,ultimo_custo:null}
    render(<AtendimentoFornecedor {...props} products={[missing]} ddeMetas={[{
      produto_codigo:"90001",grupo_subgrupo:"1.LINHA / MINERAL",competencia:"2026-12-01",
      dde_meta:45,origem:"Plano de Estoque",
    }]}/> )
    expect(screen.getByRole("heading",{name:/Pré-ranking de fornecedores/i})).toBeInTheDocument()
    expect(screen.getByText(/1 produto\(s\) com fonte pendente/i)).toBeInTheDocument()
    expect(screen.getByText(/Sugestão indisponível/i)).toBeInTheDocument()
    expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument()
  })

  it("confere K23-K25 pelo calendário do Supabase da filial, sem liberar pedido", async () => {
    const inputs = [
      { tipo: "custo_diario_previsto", valor: "20" },
      { tipo: "primeira_data_liberada", data: "2027-03-01" },
      { tipo: "limite_caixa_acumulado", data: "2027-01-01", valor: "50" },
      { tipo: "limite_caixa_acumulado", data: "2027-04-01", valor: "1000" },
      { tipo: "saldo_verba_linha", linha: "1", valor: "90" },
    ].map(row => parseManualInput({ competencia: "2026-12", filial: "CG", ...row }))
    cloud.entries = inputs
    render(<AtendimentoFornecedor {...props} userId="master-a" />)
    fireEvent.change(screen.getByLabelText("Quantidade 90001"), { target: { value: "10" } })
    fireEvent.click(screen.getByRole("button", { name: /Ativar conferência financeira de teste/i }))
    fireEvent.click(screen.getByRole("button", { name: /Carregar entradas manuais/i }))
    await waitFor(() => expect(screen.getByText(/1ª parcela antes de 2027-03-01/i)).toBeInTheDocument())
    expect(screen.getByText(/parcela\(s\) acima do limite/i)).toBeInTheDocument()
    expect(screen.getByText(/Estoura a verba/i)).toBeInTheDocument()
    expect(screen.getAllByText(/sem aprovação real/i).length).toBeGreaterThan(0)
    expect(screen.queryByText("✔ PODE GRAVAR O PEDIDO")).not.toBeInTheDocument()
    cloud.entries = []
  })
})
