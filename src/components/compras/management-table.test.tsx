import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ManagementTable } from "./management-table"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const tabs = {
  padrao:"/compras/gerenciar?situacao=padrao",
  aprovados:"/compras/gerenciar?situacao=aprovados",
  retidos:"/compras/gerenciar?situacao=retidos",
} as const
const sample = (pedido: string, descricao: string) => ({
  loja: "SO SAL", pedido, produto_codigo: "SKU" + pedido, descricao,
  fornecedor_nome: "Fornecedor " + pedido, fornecedor_codigo: pedido,
  data_pedido: "2026-11-14", quantidade: 10, quantidade_recebida: 4,
  quantidade_pendente: 6, valor_total: 1000, valor_pendente: 600,
  situacao_recebimento: "Chegada parcial",
})

afterEach(cleanup)

describe("gestão tabular de pedidos", () => {
  it("a fila do Supabase entrega itens de uma situação antes de paginar", () => {
    const rows = [
      { item: sample("1", "Aprovado padrão"), record: null },
    ]
    const { rerender } = render(<ManagementTable rows={rows} activeTab="padrao" tabHrefs={tabs} />)
    expect(screen.getByRole("table")).toHaveTextContent("Aprovado padrão")
    expect(screen.getByRole("table")).toHaveTextContent("Aprovado (padrão Zacarini)")
    expect(screen.getByRole("link", { name: /Aprovados por padrão/ })).toHaveAttribute("aria-current","page")
    expect(screen.getByRole("link", { name: /Segurar \/ Cancelar/ })).toHaveAttribute("href",tabs.retidos)
    rerender(<ManagementTable rows={[{ item: sample("3", "Retido"), record: {
      loja: "SO SAL", pedido: "3", produto_codigo: "SKU3",
      decisao: "Segurar", observacao: null, atualizado_em: "2026-11-16", alteracoes: [],
    } }]} activeTab="retidos" tabHrefs={tabs} />)
    expect(screen.getByRole("table")).toHaveTextContent("Retido")
    expect(screen.getByRole("table")).not.toHaveTextContent("Aprovado padrão")
  })

  it("não apresenta pedido já pago com a sinalização de cancelado", () => {
    render(<ManagementTable rows={[
      { item: sample("77", "Pagamento realizado"), record: { loja: "SO SAL", pedido: "77", produto_codigo: "SKU77", decisao: "Já pago", observacao: null, atualizado_em: "2026-11-19", alteracoes: [] } },
    ]} activeTab="padrao" tabHrefs={tabs} />)

    
    const decision = within(screen.getByRole("table")).getByText("Já pago")
    expect(decision).toHaveClass("text-violet-200")
    expect(decision).not.toHaveClass("text-rose-200")
  })

  it("abre a gestão em janela centralizada e fecha sem rolar a tabela", () => {
    render(<ManagementTable rows={[{ item: sample("1", "Sal mineral"), record: null }]} activeTab="padrao" tabHrefs={tabs} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("row", { name: /Sal mineral/ }))
    const dialog = screen.getByRole("dialog", { name: /Gerenciar pedido #1/ })
    expect(dialog).toHaveClass("left-1/2", "top-1/2", "-translate-x-1/2", "-translate-y-1/2")
    expect(dialog).not.toHaveClass("right-0", "inset-y-0")
    expect(within(dialog).getByText("6 unidades pendentes")).toBeInTheDocument()
    const decisionField = within(dialog).getByLabelText("Decisão do item")
    expect(decisionField).toBeVisible()
    expect(decisionField).toHaveValue("")
    const saveButton = within(dialog).getByRole("button", { name: "Salvar decisão" })
    expect(saveButton).toBeDisabled()
    fireEvent.change(decisionField, { target: { value: "Aprovado" } })
    expect(saveButton).toBeEnabled()
    expect(within(screen.getByRole("table", { hidden: true })).queryByText("Gerenciar pedido")).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole("button", { name: "Fechar painel" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("permite abrir a gestão da linha pelo teclado", () => {
    render(<ManagementTable rows={[{ item: sample("2", "Fertilizante"), record: null }]} activeTab="padrao" tabHrefs={tabs} />)
    fireEvent.keyDown(screen.getByRole("row", { name: /Fertilizante/ }), { key: "Enter" })
    expect(screen.getByRole("dialog", { name: /Gerenciar pedido #2/ })).toBeInTheDocument()
  })
})
