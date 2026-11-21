import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ManualSiscomInputs } from "./siscom-manual-inputs"
import { parseManualInput, type ManualInput } from "@/domains/compras/domain/siscom-manual-inputs"

const server = vi.hoisted(() => ({ entries: [] as ManualInput[], available: true, saved: 0 }))
vi.mock("@/app/compras/entradas-manuais/actions", () => ({
  fetchRemoteManualInputs: async () => server.available
    ? { status: "success", records: server.entries }
    : { status: "error", message: "Supabase indisponível" },
  saveRemoteManualInputs: async (rows: ManualInput[]) => {
    if (!server.available) return { status: "error", message: "Supabase indisponível" }
    server.saved += rows.length
    server.entries = [...rows, ...server.entries.filter(row => !rows.some(next => next.id === row.id))]
    return { status: "success", message: "Entrada gravada no Supabase" }
  },
  deleteRemoteManualInput: async (row: ManualInput) => {
    server.entries = server.entries.filter(next => next.id !== row.id)
    return { status: "success", message: "Excluída" }
  },
}))

afterEach(() => { cleanup(); localStorage.clear(); server.entries = []; server.available = true; server.saved = 0 })

describe("entradas manuais compartilhadas no Supabase", () => {
  it("persiste valor entre sessões Master distintas pelo servidor, sem depender de localStorage", async () => {
    const first = render(<ManualSiscomInputs userId="master-a" remote />)
    await waitFor(() => expect(screen.getByRole("button", { name: "Registrar entrada" })).toBeEnabled())
    fireEvent.change(screen.getByLabelText("Valor informado"), { target: { value: "155" } })
    fireEvent.click(screen.getByRole("button", { name: "Registrar entrada" }))
    await waitFor(() => expect(server.saved).toBe(1))
    first.unmount()
    render(<ManualSiscomInputs userId="master-b" remote />)
    await waitFor(() => expect(screen.getByRole("table", { name: "Entradas manuais para o SISCOM" })).toHaveTextContent("155,00"))
    expect(localStorage.length).toBe(0)
  })

  it("erro de gravação nunca confirma registro nem salva cópia local como se fosse Supabase", async () => {
    server.entries = [parseManualInput({ tipo: "custo_diario_previsto", competencia: "2026-12", filial: "REDE", valor: "30" })]
    render(<ManualSiscomInputs userId="master-a" remote />)
    await waitFor(() => expect(screen.getByRole("table", { name: "Entradas manuais para o SISCOM" })).toHaveTextContent("30,00"))
    server.available = false
    fireEvent.change(screen.getByLabelText("Valor informado"), { target: { value: "45" } })
    fireEvent.click(screen.getByRole("button", { name: "Registrar entrada" }))
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Supabase indisponível"))
    expect(screen.getByRole("table", { name: "Entradas manuais para o SISCOM" })).toHaveTextContent("30,00")
    expect(localStorage.length).toBe(0)
  })
})
