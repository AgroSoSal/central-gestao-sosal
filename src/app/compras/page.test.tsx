import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const callLog = vi.hoisted(() => ({ methods: [] as string[] }))
vi.mock("next/server", () => ({ connection: async () => undefined }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }))
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { email: "master@sosal.com.br" } }, error: null }) },
    rpc: async (name: string) => {
      callLog.methods.push(name)
      return name === "fn_listar_pedidos_compra_conciliados" ? {
        data: [{ loja: "SO SAL", pedido: "101", produto_codigo: "XYZ", descricao: "Sal mineral", quantidade: 10, quantidade_recebida: 0, quantidade_pendente: 10, valor_total: 100, valor_pendente: 100, situacao_recebimento: "Em aberto", total_itens: 1, total_pedidos: 1, soma_total: 100 }],
        error: null,
      } : { data: [], error: null }
    },
  }),
}))
afterEach(() => { cleanup(); callLog.methods.length = 0 })

describe("consulta principal de compras", () => {
  it("oferece entrada destacada para gerenciar, sem editor por linha nem buscar decisões", async () => {
    const { ComprasContent } = await import("./page")
    const element = await ComprasContent({ searchParams: Promise.resolve({ busca: "sal", loja: "SO SAL", inicio: "2026-11-01", fim: "2026-11-16" }) })
    render(element)
    const links = screen.getAllByRole("link", { name: /gerenciar pedidos/i })
    expect(links.length).toBeGreaterThan(0)
    expect(links[0]).toHaveAttribute("href", "/compras/gerenciar?busca=sal&loja=SO+SAL&inicio=2026-11-01&fim=2026-11-16")
    expect(screen.getByRole("link", { name: /Follow-up de entregas/i })).toHaveAttribute("href", "/compras/follow-up?busca=sal&loja=SO+SAL&inicio=2026-11-01&fim=2026-11-16")
    expect(screen.getByRole("link", { name: /Previsão de pagamentos/i })).toHaveAttribute("href", "/compras/previsao?busca=sal&loja=SO+SAL&inicio=2026-11-01&fim=2026-11-16")
    expect(screen.getByRole("link", { name: /Entradas manuais SISCOM/i })).toHaveAttribute("href", "/compras/entradas-manuais")
    expect(screen.queryByText("Gerenciar", { exact: true })).not.toBeInTheDocument()
    expect(callLog.methods).toEqual(["fn_listar_pedidos_compra_conciliados"])
  })
})
