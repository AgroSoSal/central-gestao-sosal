import { beforeEach, describe, expect, it, vi } from "vitest"

const database = vi.hoisted(() => {
  const state = {
    authorized: true,
    writes: [] as Array<Record<string, unknown>>,
    removed: false,
    fetched: [] as Array<Record<string, unknown>>,
    error: null as { message: string } | null,
  }
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.order = () => chain
  chain.limit = async () => ({ data: state.fetched, error: state.error })
  chain.delete = () => { state.removed = true; return chain }
  chain.eq = () => chain
  chain.is = () => chain
  chain.then = (resolve: (value: { error: { message: string } | null }) => unknown) => resolve({ error: state.error })
  return { state, chain }
})

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "master-uuid" } }, error: null }) },
    rpc: async () => ({ data: [], error: database.state.authorized ? null : { code: "42501" } }),
    from: () => ({
      ...database.chain,
      upsert: async (rows: Array<Record<string, unknown>>) => {
        database.state.writes.push(...rows)
        return { error: database.state.error }
      },
    }),
  }),
}))

beforeEach(() => {
  database.state.authorized = true
  database.state.writes.length = 0
  database.state.removed = false
  database.state.fetched = []
  database.state.error = null
})

const row = {
  tipo: "saldo_verba_linha", competencia: "2026-12", filial: "CG", linha: 2,
  sku: null, data: null, valor: -30, observacao: "Limite negativo conferido",
}

describe("ações protegidas de insumos manuais Supabase", () => {
  it("rejeita dados inválidos e usuários sem Master, sem gravar", async () => {
    const { saveRemoteManualInputs } = await import("./actions")
    const bad = await saveRemoteManualInputs([{ ...row, valor: "infinito" }])
    expect(bad.status).toBe("error")
    expect(database.state.writes).toHaveLength(0)
    database.state.authorized = false
    const denied = await saveRemoteManualInputs([row])
    expect(denied.status).toBe("error")
    expect(database.state.writes).toHaveLength(0)
  })

  it("grava linha negativa por competência e filial, sem aceitar autor forjado", async () => {
    const { saveRemoteManualInputs } = await import("./actions")
    const result = await saveRemoteManualInputs([{ ...row, usuario_id: "outro-usuario" }])
    expect(result.status).toBe("success")
    expect(database.state.writes).toHaveLength(1)
    expect(database.state.writes[0]).toMatchObject({
      competencia: "2026-12-01", filial: "CG", tipo: "saldo_verba_linha", linha: 2,
      valor: -30, usuario_id: "master-uuid", situacao: "pendente_integracao",
    })
  })

  it("lista e converte datas/valores do banco sem supor zero", async () => {
    database.state.fetched = [{
      tipo: "primeira_data_liberada", competencia: "2026-12-01", filial: "CG",
      linha: null, produto_codigo: null, data_referencia: "2027-01-05", valor: null,
      observacao: "", atualizado_em: "2026-11-21T13:00:00.000Z",
    }]
    const { fetchRemoteManualInputs } = await import("./actions")
    const result = await fetchRemoteManualInputs()
    expect(result.status).toBe("success")
    if (result.status === "success") {
      expect(result.records).toEqual([expect.objectContaining({
        competencia: "2026-12", filial: "CG", tipo: "primeira_data_liberada",
        data: "2027-01-05", valor: null,
      })])
    }
  })

  it("não transforma erro do Supabase em tabela vazia", async () => {
    database.state.error = { message: "RLS indisponível" }
    const { fetchRemoteManualInputs } = await import("./actions")
    expect((await fetchRemoteManualInputs()).status).toBe("error")
  })

  it("exclui somente a chave validada após autorização Master", async () => {
    const { deleteRemoteManualInput } = await import("./actions")
    expect((await deleteRemoteManualInput(row)).status).toBe("success")
    expect(database.state.removed).toBe(true)
    database.state.authorized = false
    expect((await deleteRemoteManualInput(row)).status).toBe("error")
  })
})
