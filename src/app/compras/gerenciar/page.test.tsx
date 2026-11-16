import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const fake = vi.hoisted(() => ({
  failDecisions: false,
  purchases: [
    { loja: "SO SAL", pedido: "101", produto_codigo: "XYZ", descricao: "Sal mineral", fornecedor_nome: "Fornecedor A", data_pedido: "2026-11-15", quantidade: 10, quantidade_recebida: 3, quantidade_pendente: 7, valor_total: 150, valor_pendente: 105, situacao_recebimento: "Chegada parcial", total_itens: 2 },
    { loja: "SO SAL", pedido: "102", produto_codigo: "ABC", descricao: "Produto entregue", fornecedor_nome: "Fornecedor B", data_pedido: "2026-11-15", quantidade: 3, quantidade_recebida: 3, quantidade_pendente: 0, valor_total: 30, valor_pendente: 0, situacao_recebimento: "Já chegou – conferir/baixar", total_itens: 2 },
  ],
}))

vi.mock("next/server", () => ({ connection: async () => undefined }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }))
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { email: "master@sosal.com.br" } }, error: null }) },
    rpc: async (name: string) => name === "fn_listar_pedidos_compra_conciliados"
      ? { data: fake.purchases, error: null }
      : { data: [], error: fake.failDecisions ? { code: "500" } : null },
  }),
}))

afterEach(() => { cleanup(); fake.failDecisions = false })

describe("tela dedicada Gerenciar pedidos", () => {
  it("mostra somente os itens que exigem atenção e mantém Bandeirantes", async () => {
    const { ManagementContent } = await import("./page")
    const element = await ManagementContent({ searchParams: Promise.resolve({ busca: "sal", loja: "SO SAL", inicio: "2026-11-01", fim: "2026-11-16" }) })
    render(element)
    expect(screen.getByText("Sal mineral")).toBeInTheDocument()
    expect(screen.queryByText("Produto entregue")).not.toBeInTheDocument()
    expect(screen.getAllByText("BANDEIRANTES").length).toBeGreaterThan(0)
    expect(screen.getByRole("link", { name: /voltar à consulta/i })).toHaveAttribute("href", "/compras?busca=sal&loja=SO+SAL&inicio=2026-11-01&fim=2026-11-16")
  })

  it("não exibe fila presumida se falhar a consulta de decisões", async () => {
    fake.failDecisions = true
    const { ManagementContent } = await import("./page")
    const element = await ManagementContent({ searchParams: Promise.resolve({}) })
    render(element)
    expect(screen.getByRole("alert")).toHaveTextContent(/decisões/i)
    expect(screen.queryByText("Sal mineral")).not.toBeInTheDocument()
  })

  it("apresenta a navegação para o follow-up e status operacional sem aprovação automática", async () => {
    const { ManagementContent } = await import("./page")
    render(await ManagementContent({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole("link", { name: /Follow-up/ })).toHaveAttribute("href", "/compras/follow-up")
    expect(screen.getByRole("link", { name: /Previsão de pagamentos/i })).toHaveAttribute("href", "/compras/previsao")
    expect(screen.getByRole("button", { name: /Aguardando aprovação/ })).toBeInTheDocument()
    expect(screen.queryByText("Aprovado")).not.toBeInTheDocument()
  })
})
