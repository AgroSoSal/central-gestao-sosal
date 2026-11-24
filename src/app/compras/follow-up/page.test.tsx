import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  failTracking: false,
  failListing: false,
  emptyList: false,
  pageTotal: 2,
  calls: [] as Array<{ name: string; args: Record<string, unknown> | undefined }>,
  purchases: [
    { loja: "SO SAL", pedido: "42", produto_codigo: "100", descricao: "Sal mineral", fornecedor_nome: "Fornecedor A", data_pedido: "2026-11-15", quantidade: 100, quantidade_recebida: 60, quantidade_pendente: 40, valor_total: 1000, valor_pendente: 400, situacao_recebimento: "Chegada parcial", total_itens: 2 },
    { loja: "SO SAL", pedido: "45", produto_codigo: "103", descricao: "Compra já paga", fornecedor_nome: "Fornecedor D", data_pedido: "2026-11-14", quantidade: 20, quantidade_recebida: 0, quantidade_pendente: 20, valor_total: 200, valor_pendente: 200, situacao_recebimento: "Em aberto", total_itens: 2 },
  ],
}))

vi.mock("next/server", () => ({ connection: async () => undefined }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { email: "master@sosal.com.br" } }, error: null }) },
    rpc: async (name: string, args?: Record<string, unknown>) => {
      state.calls.push({ name, args })
      if (name === "fn_listar_followup_ativos_238") return {
        data: state.emptyList ? [{ loja: null, pedido: null, produto_codigo: null, total_itens: 0 }] : state.purchases.map((row) => ({ ...row, total_itens: state.pageTotal })),
        error: state.failListing ? { code: "PGRST202" } : null,
      }
      if (name === "fn_listar_followup_compras") return { data: [], error: state.failTracking ? { code: "PGRST202" } : null }
      return { data: [], error: { code: "PGRST202" } }
    },
  }),
}))

afterEach(() => { cleanup(); state.failTracking = false; state.failListing = false; state.emptyList = false; state.pageTotal = 2; state.calls = [] })

describe("página Follow-up", () => {
  it("recebe itens com saldo já conciliado e decisão em branco igual a Aprovado operacional", async () => {
    const { FollowUpContent } = await import("./page")
    render(await FollowUpContent({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole("table")).toHaveTextContent("Sal mineral")
    expect(screen.getByRole("table")).toHaveTextContent("Compra já paga")
    expect(state.calls.map((entry) => entry.name)).toEqual(["fn_listar_followup_ativos_238", "fn_listar_followup_compras"])
    expect(screen.getByRole("link", { name: /Previsão de pagamentos/i })).toHaveAttribute("href", "/compras/previsao")
  })

  it("pagina pelo total de pendências elegíveis em vez do total bruto de origem", async () => {
    state.pageTotal = 51
    const { FollowUpContent } = await import("./page")
    render(await FollowUpContent({ searchParams: Promise.resolve({ loja: "SO SAL", pagina: "1" }) }))
    expect(screen.getByRole("link", { name: /Próximo lote/i })).toHaveAttribute("href", "/compras/follow-up?loja=SO+SAL&pagina=2")
    expect(state.calls[0]).toMatchObject({ name: "fn_listar_followup_ativos_238", args: { p_loja: "SO SAL", p_pagina: 1, p_tamanho: 50 } })
  })

  it("não apresenta acompanhamento falso se a RPC ainda não está instalada", async () => {
    state.failTracking = true
    const { FollowUpContent } = await import("./page")
    render(await FollowUpContent({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole("alert")).toHaveTextContent(/indisponível/i)
  })

  it("não transforma ausência de itens elegíveis em pendência fictícia", async () => {
    state.emptyList = true
    const { FollowUpContent } = await import("./page")
    render(await FollowUpContent({ searchParams: Promise.resolve({}) }))
    expect(screen.getByText(/Nenhum item/i)).toBeInTheDocument()
    expect(screen.queryByText("Sal mineral")).not.toBeInTheDocument()
    expect(state.calls.map((entry) => entry.name)).toEqual(["fn_listar_followup_ativos_238"])
  })

  it("não usa a listagem antiga quando a consulta de pendentes falha", async () => {
    state.failListing = true
    const { FollowUpContent } = await import("./page")
    render(await FollowUpContent({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole("alert")).toHaveTextContent(/não foi possível consultar os pedidos em acompanhamento/i)
    expect(state.calls.map((entry) => entry.name)).toEqual(["fn_listar_followup_ativos_238"])
  })
})
