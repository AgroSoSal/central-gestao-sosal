import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  failTracking: false,
  decisions: [{ loja: "SO SAL", pedido: "42", produto_codigo: "100", decisao: "Aprovado", observacao: null, atualizado_em: "2026-11-16", alteracoes: [] }],
  purchases: [
    { loja: "SO SAL", pedido: "42", produto_codigo: "100", descricao: "Sal mineral", fornecedor_nome: "Fornecedor A", data_pedido: "2026-11-15", quantidade: 100, quantidade_recebida: 60, quantidade_pendente: 40, valor_total: 1000, valor_pendente: 400, situacao_recebimento: "Chegada parcial", total_itens: 3 },
    { loja: "SO SAL", pedido: "43", produto_codigo: "101", descricao: "Ainda não aprovado", fornecedor_nome: "Fornecedor B", data_pedido: "2026-11-15", quantidade: 10, quantidade_recebida: 0, quantidade_pendente: 10, valor_total: 100, valor_pendente: 100, situacao_recebimento: "Em aberto", total_itens: 3 },
    { loja: "SO SAL", pedido: "44", produto_codigo: "102", descricao: "Já entregue", fornecedor_nome: "Fornecedor C", data_pedido: "2026-11-15", quantidade: 1, quantidade_recebida: 1, quantidade_pendente: 0, valor_total: 100, valor_pendente: 0, situacao_recebimento: "Já chegou – conferir/baixar", total_itens: 3 },
  ],
}))

vi.mock("next/server", () => ({ connection: async () => undefined }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { email: "master@sosal.com.br" } }, error: null }) },
    rpc: async (name: string) => name === "fn_listar_pedidos_compra_conciliados"
      ? { data: state.purchases, error: null }
      : name === "fn_listar_decisoes_compra"
        ? { data: state.decisions, error: null }
        : { data: [], error: state.failTracking ? { code: "PGRST202" } : null },
  }),
}))

afterEach(() => { cleanup(); state.failTracking = false; state.decisions = [{ loja: "SO SAL", pedido: "42", produto_codigo: "100", decisao: "Aprovado", observacao: null, atualizado_em: "2026-11-16", alteracoes: [] }] })

describe("página Follow-up", () => {
  it("mostra apenas aprovados explicitamente com saldo de entrega positivo", async () => {
    const { FollowUpContent } = await import("./page")
    render(await FollowUpContent({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole("table")).toHaveTextContent("Sal mineral")
    expect(screen.queryByText("Ainda não aprovado")).not.toBeInTheDocument()
    expect(screen.queryByText("Já entregue")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Previsão de pagamentos/i })).toHaveAttribute("href", "/compras/previsao")
  })

  it("não apresenta acompanhamento falso se a RPC ainda não está instalada", async () => {
    state.failTracking = true
    const { FollowUpContent } = await import("./page")
    render(await FollowUpContent({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole("alert")).toHaveTextContent(/não foi habilitado/i)
  })

  it("não confunde o padrão financeiro com uma aprovação operacional", async () => {
    state.decisions = []
    const { FollowUpContent } = await import("./page")
    render(await FollowUpContent({ searchParams: Promise.resolve({}) }))
    expect(screen.getByText(/Nenhum item aprovado/i)).toBeInTheDocument()
    expect(screen.queryByText("Sal mineral")).not.toBeInTheDocument()
  })
})
