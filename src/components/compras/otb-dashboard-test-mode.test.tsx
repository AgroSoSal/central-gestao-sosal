import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { OtbDashboard } from "./otb-dashboard"

vi.mock("@/components/compras/compras-auth", () => ({ ComprasSair: () => null }))
afterEach(cleanup)

const baseProps = {
  email: "master@sosal.com.br", simulationBaseDate: "2026-11-19",
  purchaseSource: { status: "indisponivel" as const, itemCount: null, lastImportedAt: null },
  historicalSource: { status: "indisponivel" as const, firstMonth: null, lastMonth: null, monthCount: null,
    totalRecords: null, excludedRecords: null, unmappedRecords: null, completeLast12Months: false as const },
  stockPosition: { status: "indisponivel" as const, snapshotAt: null, stockCost: null,
    cmv90d: null, stockSkus: null, subgroups: [] as [] },
}

describe("OTB — modo teste separado da aprovação", () => {
  it("abre cálculos e indicadores demonstrativos mesmo sem projeção financeira homologada", () => {
    render(<OtbDashboard {...baseProps} />)
    expect(screen.getByRole("button", { name: /Iniciar simulação de teste/i })).toBeInTheDocument()
    expect(screen.queryByLabelText("Indicadores de OTB do mês")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Iniciar simulação de teste/i }))
    expect(screen.getByRole("status", { name: /Simulação de teste ativa/i })).toHaveTextContent("não autoriza compras")
    expect(screen.getByLabelText("Indicadores de OTB do mês")).toBeInTheDocument()
    expect(screen.getByText(/Exemplo · Mineral/i)).toBeInTheDocument()
    expect(screen.getAllByText(/TRAVADO · TESTE/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Cenário recebido exclusivamente da fonte oficial/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Encerrar simulação/i }))
    expect(screen.queryByLabelText("Indicadores de OTB do mês")).not.toBeInTheDocument()
  })

  it("recalcula as verbas ao editar teto de caixa sem gravar ou homologar valores", () => {
    render(<OtbDashboard {...baseProps} />)
    fireEvent.click(screen.getByRole("button", { name: /Iniciar simulação de teste/i }))
    const indicators = screen.getByLabelText("Indicadores de OTB do mês")
    expect(within(indicators).getAllByText(/120\.000,00/).length).toBeGreaterThan(0)
    fireEvent.change(screen.getByLabelText("Teto de caixa · mês 1"), { target: { value: "0" } })
    expect(within(indicators).getByText("Verba calculada (teste)").parentElement).toHaveTextContent(/R\$\s*0,00/)
    expect(screen.getByRole("status", { name: /Simulação de teste ativa/i })).toHaveTextContent("dados de exemplo")
  })
})
