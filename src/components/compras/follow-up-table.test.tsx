import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FollowUpTable } from "./follow-up-table"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const row = {
  item: { loja: "SO SAL", pedido: "42", produto_codigo: "100", descricao: "Sal mineral", fornecedor_nome: "Fornecedor A", fornecedor_codigo: "20", data_pedido: "2026-11-10", quantidade: 100, quantidade_recebida: 60, quantidade_pendente: 40, valor_total: 1000, valor_pendente: 400, situacao_recebimento: "Chegada parcial" },
  tracking: null,
}

afterEach(cleanup)

describe("follow-up de entrega", () => {
  it("evidencia o saldo não entregue, inclusive com recebimento parcial", () => {
    render(<FollowUpTable rows={[row]} trackingAvailable />)
    expect(screen.getByRole("table")).toHaveTextContent("Sal mineral")
    expect(screen.getByRole("table")).toHaveTextContent("40")
    fireEvent.click(screen.getByRole("row", { name: /Sal mineral/ }))
    expect(screen.getByText("40 unidades pendentes")).toBeInTheDocument()
    expect(screen.getAllByText("R$ 400,00").length).toBeGreaterThan(1)
    expect(screen.getByLabelText("Previsão de entrega")).toBeInTheDocument()
    expect(screen.getByLabelText("Resposta do fornecedor")).toBeInTheDocument()
    expect(screen.getByLabelText("Posicionamento do comprador")).toBeInTheDocument()
  })

  it("não simula gravação quando a função protegida de follow-up não existe", () => {
    render(<FollowUpTable rows={[row]} trackingAvailable={false} />)
    fireEvent.click(screen.getByRole("row", { name: /Sal mineral/ }))
    expect(screen.getByRole("button", { name: /Salvar acompanhamento/ })).toBeDisabled()
    expect(screen.getByRole("alert")).toHaveTextContent(/não foi habilitado/i)
    expect(screen.getByRole("table")).toHaveTextContent("Indisponível")
  })

  it("mostra previsão e resposta do fornecedor no histórico auditado", () => {
    const tracking = { loja: "SO SAL", pedido: "42", produto_codigo: "100", previsao_entrega: "2026-11-20", proximo_contato: null, retorno_fornecedor: "Entrega confirmada em 20/11", posicionamento_comprador: "Cobrado por e-mail", transportadora: null, codigo_rastreio: null, status_entrega: "Previsão informada", atualizado_em: "2026-11-16", alteracoes: [{ quando: "2026-11-16T12:00:00Z", por: "comprador@sosal.com.br", anterior: null, novo: { previsao_entrega: "2026-11-20", retorno_fornecedor: "Entrega confirmada em 20/11", status_entrega: "Previsão informada" } }] }
    render(<FollowUpTable rows={[{ ...row, tracking }]} trackingAvailable />)
    fireEvent.click(screen.getByRole("row", { name: /Sal mineral/ }))
    expect(screen.getByText(/Histórico auditado/)).toBeInTheDocument()
    expect(screen.getByText(/Fornecedor: Entrega confirmada em 20\/11/)).toBeInTheDocument()
    expect(screen.getAllByText(/20\/11\/2026/).length).toBeGreaterThan(0)
  })
})
