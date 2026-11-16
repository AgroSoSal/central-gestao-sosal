import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  failPurchases: false,
  failDecisions: false,
  failFollowUp: false,
  purchases: [
    { loja: "SO SAL", pedido: "100", produto_codigo: "P1", descricao: "Sal para rebanho", fornecedor_nome: "Fornecedor A", data_pedido: "2026-11-12", condicao_pagamento: "30/60", quantidade_pendente: 40, quantidade_recebida: 60, situacao_recebimento: "Chegada parcial", valor_pendente: 400, total_itens: 6 },
    { loja: "COXIM", pedido: "101", produto_codigo: "P2", descricao: "Ração segurada", fornecedor_nome: "Fornecedor B", data_pedido: "2026-11-12", condicao_pagamento: "30", quantidade_pendente: 20, valor_pendente: 200, total_itens: 6 },
    { loja: "CAMPO GRANDE", pedido: "102", produto_codigo: "P3", descricao: "Compra sem decisão", fornecedor_nome: "Fornecedor C", data_pedido: "2026-11-12", condicao_pagamento: null, quantidade_pendente: 30, valor_pendente: 300, total_itens: 6 },
    { loja: "CAMPO GRANDE", pedido: "103", produto_codigo: "P4", descricao: "Pedido a cancelar", fornecedor_nome: "Fornecedor D", data_pedido: "2026-11-12", condicao_pagamento: "30", quantidade_pendente: 10, valor_pendente: 100, total_itens: 6 },
    { loja: "COXIM", pedido: "104", produto_codigo: "P5", descricao: "Condição especial", fornecedor_nome: "Fornecedor E", data_pedido: "2026-11-12", condicao_pagamento: "BONIFICAÇÃO", quantidade_pendente: 7, valor_pendente: 70, total_itens: 6 },
    { loja: "COXIM", pedido: "105", produto_codigo: "P6", descricao: "Totalmente recebido", fornecedor_nome: "Fornecedor F", data_pedido: "2026-11-12", condicao_pagamento: "30", quantidade_pendente: 0, valor_pendente: 0, total_itens: 6 },
  ],
}))

vi.mock("next/server", () => ({ connection: async () => undefined }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock("@/components/compras/global-payment-forecast", () => ({ GlobalPaymentForecast: () => <div aria-label="Resumo global">Consolidação da carteira completa</div> }))
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { email: "master@sosal.com.br" } }, error: null }) },
    rpc: async (name: string) => {
      if (name === "fn_listar_pedidos_compra_conciliados") return { data: state.purchases, error: state.failPurchases ? { code: "42501" } : null }
      if (name === "fn_listar_decisoes_compra") return { data: [
        { loja: "SO SAL", pedido: "100", produto_codigo: "P1", decisao: "Aprovado" },
        { loja: "COXIM", pedido: "101", produto_codigo: "P2", decisao: "Segurar" },
        { loja: "CAMPO GRANDE", pedido: "103", produto_codigo: "P4", decisao: "Cancelar" },
        { loja: "COXIM", pedido: "104", produto_codigo: "P5", decisao: "Aprovado" },
      ], error: state.failDecisions ? { code: "500" } : null }
      if (name === "fn_listar_followup_compras") return { data: [{ loja: "SO SAL", pedido: "100", produto_codigo: "P1", previsao_entrega: "2026-11-20" }], error: state.failFollowUp ? { code: "500" } : null }
      throw new Error(`RPC inesperada: ${name}`)
    },
  }),
}))

beforeEach(() => vi.setSystemTime(new Date("2026-11-16T15:00:00Z")))
afterEach(() => { cleanup(); vi.useRealTimers(); state.failPurchases = false; state.failDecisions = false; state.failFollowUp = false })

describe("previsão financeira sem alterar o banco", () => {
  it("separa consolidação global do lote detalhado e diferencia falta de aprovação", async () => {
    const { PurchaseForecastContent } = await import("./page")
    render(await PurchaseForecastContent({ searchParams: Promise.resolve({ loja: "SO SAL" }) }))
    expect(screen.getByRole("heading", { name: /Previsão de pagamentos/i })).toBeInTheDocument()
    expect(screen.getByLabelText("Resumo global")).toHaveTextContent(/carteira completa/i)
    expect(screen.getByText("Sal para rebanho")).toBeInTheDocument()
    expect(screen.getByText("Chegada parcial")).toBeInTheDocument()
    expect(screen.getByText(/60 recebidas · 40 pendentes/i)).toBeInTheDocument()
    expect(screen.getAllByText("BANDEIRANTES").length).toBeGreaterThan(0)
    expect(screen.getByText("Compra sem decisão")).toBeInTheDocument()
    expect(screen.getAllByText("Aguardando aprovação").length).toBeGreaterThan(0)
    expect(screen.getByText(/30 dias padrão/i)).toBeInTheDocument()
    expect(screen.getByText(/50 itens por lote/i)).toBeInTheDocument()
  })

  it("avisa que condições não reconhecidas não são somadas e retidos ficam fora da projeção", async () => {
    const { PurchaseForecastContent } = await import("./page")
    render(await PurchaseForecastContent({ searchParams: Promise.resolve({}) }))
    expect(screen.getByText("Ração segurada")).toBeInTheDocument()
    expect(screen.getByText("Pedido a cancelar")).toBeInTheDocument()
    expect(screen.getByText("Condição especial")).toBeInTheDocument()
    expect(screen.getAllByText(/conferir condição/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/BONIFICAÇÃO/).length).toBeGreaterThan(0)
  })

  it("não exibe números inventados quando a consulta de decisões falha", async () => {
    state.failDecisions = true
    const { PurchaseForecastContent } = await import("./page")
    render(await PurchaseForecastContent({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole("alert")).toHaveTextContent(/decisões/i)
    expect(screen.queryByText("Sal para rebanho")).not.toBeInTheDocument()
  })

  it("não usa previsão falsa de fornecedor quando a consulta de Follow-up falha", async () => {
    state.failFollowUp = true
    const { PurchaseForecastContent } = await import("./page")
    render(await PurchaseForecastContent({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole("alert")).toHaveTextContent(/Follow-up indisponível/i)
    expect(screen.getByText("Sal para rebanho")).toBeInTheDocument()
  })

  it("recusa classificação financeira quando a conciliação falha", async () => {
    state.failPurchases = true
    const { PurchaseForecastContent } = await import("./page")
    render(await PurchaseForecastContent({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole("alert")).toHaveTextContent(/conciliar/i)
    expect(screen.queryByText("Sal para rebanho")).not.toBeInTheDocument()
  })
})
