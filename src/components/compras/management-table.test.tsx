import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ManagementTable } from "./management-table"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const sample = (pedido: string, descricao: string) => ({
  loja: "SO SAL", pedido, produto_codigo: "SKU" + pedido, descricao,
  fornecedor_nome: "Fornecedor " + pedido, fornecedor_codigo: pedido,
  data_pedido: "2026-11-14", quantidade: 10, quantidade_recebida: 4,
  quantidade_pendente: 6, valor_total: 1000, valor_pendente: 600,
  situacao_recebimento: "Chegada parcial",
})

afterEach(cleanup)

describe("gestão tabular de pedidos", () => {
  it("separa aguardando, aprovados e segurados por decisão registrada", () => {
    render(<ManagementTable rows={[
      { item: sample("1", "Pendente"), record: null },
      { item: sample("2", "Aprovado e a caminho"), record: { loja: "SO SAL", pedido: "2", produto_codigo: "SKU2", decisao: "Aprovado", observacao: null, atualizado_em: "2026-11-16", alteracoes: [] } },
      { item: sample("3", "Retido"), record: { loja: "SO SAL", pedido: "3", produto_codigo: "SKU3", decisao: "Segurar", observacao: null, atualizado_em: "2026-11-16", alteracoes: [] } },
    ]} />)

    expect(screen.getByRole("table")).toHaveTextContent("Pendente")
    expect(screen.getByRole("table")).not.toHaveTextContent("Aprovado e a caminho")
    fireEvent.click(screen.getByRole("button", { name: /Aprovados/ }))
    expect(screen.getByRole("table")).toHaveTextContent("Aprovado e a caminho")
    expect(screen.getByRole("table")).not.toHaveTextContent("Fornecedor 1")
    fireEvent.click(screen.getByRole("button", { name: /Segurados/ }))
    expect(screen.getByRole("table")).toHaveTextContent("Retido")
  })

  it("seleciona a linha e mostra gerenciar pedido fora da tabela", () => {
    render(<ManagementTable rows={[{ item: sample("1", "Sal mineral"), record: null }]} />)
    fireEvent.click(screen.getByRole("row", { name: /Sal mineral/ }))
    expect(screen.getByText("Gerenciar pedido")).toBeInTheDocument()
    expect(within(screen.getByRole("table")).queryByText("Gerenciar pedido")).not.toBeInTheDocument()
    expect(screen.getByText("6 unidades pendentes")).toBeInTheDocument()
  })
})
