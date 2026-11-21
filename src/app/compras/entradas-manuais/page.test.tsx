import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ authorized: false, authenticated: true, calls: [] as string[] }))
vi.mock("next/server", () => ({ connection: async () => undefined }))
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.authenticated ? { id: "master-1", email: "master@sosal.test" } : null }, error: null }) },
    rpc: async (name: string) => {
      state.calls.push(name)
      return { data: [], error: state.authorized ? null : { code: "42501" } }
    },
  }),
}))
afterEach(() => { cleanup(); state.calls.length = 0; state.authorized = false; state.authenticated = true })

describe("permissão da tela de entradas manuais", () => {
  it("nega acesso sem autorização Master do Supabase", async () => {
    const { EntradasManuaisContent } = await import("./page")
    render(await EntradasManuaisContent())
    expect(screen.getByText(/Acesso restrito ao Master ativo/i)).toBeInTheDocument()
    expect(screen.queryByRole("table", { name: /Entradas manuais/i })).not.toBeInTheDocument()
    expect(state.calls).toEqual(["fn_listar_decisoes_compra"])
  })

  it("oferece a grade somente após verificar Master ativo", async () => {
    state.authorized = true
    const { EntradasManuaisContent } = await import("./page")
    render(await EntradasManuaisContent())
    expect(screen.getByRole("table", { name: "Entradas manuais para o SISCOM" })).toBeInTheDocument()
    expect(state.calls).toEqual(["fn_listar_decisoes_compra"])
  })
})
