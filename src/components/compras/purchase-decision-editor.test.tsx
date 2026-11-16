import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PurchaseDecisionEditor } from "./purchase-decision-editor"

const fake = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: fake.refresh }) }))
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    rpc: async (name: string) => ({
      data: name === "fn_listar_decisoes_compra" ? [{ loja: "SO SAL", pedido: "10", produto_codigo: "A", decisao: "Aprovado", observacao: null, atualizado_em: "2026-11-16T16:00:00Z", alteracoes: [] }] : null,
      error: null,
    }),
  }),
}))

afterEach(() => { cleanup(); fake.refresh.mockClear() })

describe("editor de decisão da fila", () => {
  it("limita a largura do formulário ao espaço de cartões estreitos", () => {
    render(<PurchaseDecisionEditor loja="SO SAL" pedido="10" produtoCodigo="A" record={null} available />)
    fireEvent.click(screen.getByText("Gerenciar"))
    expect(screen.getByRole("button", { name: "Salvar decisão" }).closest("form")).toHaveClass("w-full", "max-w-72")
  })

  it("revalida a fila após uma decisão salva", async () => {
    render(<PurchaseDecisionEditor loja="SO SAL" pedido="10" produtoCodigo="A" record={{ loja: "SO SAL", pedido: "10", produto_codigo: "A", decisao: "Segurar", observacao: null, atualizado_em: "2026-11-16T15:00:00Z", alteracoes: [] }} available />)
    fireEvent.click(screen.getByText("Gerenciar"))
    fireEvent.change(screen.getByLabelText("Decisão do item"), { target: { value: "Aprovado" } })
    fireEvent.click(screen.getByRole("button", { name: "Salvar decisão" }))
    await waitFor(() => expect(fake.refresh).toHaveBeenCalledTimes(1))
  })
})
