import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { ManualSiscomInputs } from "./siscom-manual-inputs"
import { manualInputsStorageKey } from "@/domains/compras/domain/siscom-manual-inputs-storage"

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe("tabela de entradas manuais · SISCOM futuro", () => {
  it("adiciona e altera valores por filial, linha e competência sem envio ao SISCOM", async () => {
    render(<ManualSiscomInputs userId="usuario-1" />)
    await waitFor(() => expect(screen.getByRole("button", { name: "Registrar entrada" })).toBeEnabled())
    fireEvent.change(screen.getByLabelText("Tipo de entrada"), { target: { value: "saldo_verba_linha" } })
    fireEvent.change(screen.getByLabelText("Filial da entrada"), { target: { value: "CG" } })
    fireEvent.change(screen.getByLabelText("Linha OTB"), { target: { value: "2" } })
    fireEvent.change(screen.getByLabelText("Valor informado"), { target: { value: "120" } })
    fireEvent.click(screen.getByRole("button", { name: "Registrar entrada" }))
    const table = screen.getByRole("table", { name: "Entradas manuais para o SISCOM" })
    expect(within(table).getByText("Linha 2")).toBeInTheDocument()
    expect(within(table).getByText(/120,00/)).toBeInTheDocument()
    expect(screen.getByText(/nenhum pedido é emitido/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Valor informado"), { target: { value: "180" } })
    fireEvent.click(screen.getByRole("button", { name: "Registrar entrada" }))
    expect(within(table).getAllByRole("row")).toHaveLength(2)
    expect(within(table).getByText(/180,00/)).toBeInTheDocument()
  })

  it("recupera dados após remontar e não mistura rascunhos de dois Masters", async () => {
    const first = render(<ManualSiscomInputs userId="usuario-1" />)
    await waitFor(() => expect(screen.getByRole("button", { name: "Registrar entrada" })).toBeEnabled())
    fireEvent.change(screen.getByLabelText("Valor informado"), { target: { value: "250" } })
    fireEvent.click(screen.getByRole("button", { name: "Registrar entrada" }))
    first.unmount()
    const second = render(<ManualSiscomInputs userId="usuario-1" />)
    await waitFor(() => expect(screen.getByRole("table", { name: "Entradas manuais para o SISCOM" })).toHaveTextContent("250,00"))
    second.unmount()
    render(<ManualSiscomInputs userId="usuario-2" />)
    await waitFor(() => expect(screen.getByRole("button", { name: "Registrar entrada" })).toBeEnabled())
    expect(screen.getByText(/Nenhuma entrada cadastrada/i)).toBeInTheDocument()
  })

  it("preserva um backup local danificado e impede substituição acidental", async () => {
    localStorage.setItem(manualInputsStorageKey("usuario-1"), "{arquivo-corrompido")
    render(<ManualSiscomInputs userId="usuario-1" />)
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Backup local inválido/i))
    expect(screen.getByRole("button", { name: "Registrar entrada" })).toBeDisabled()
    expect(localStorage.getItem(manualInputsStorageKey("usuario-1"))).toBe("{arquivo-corrompido")
  })
})
