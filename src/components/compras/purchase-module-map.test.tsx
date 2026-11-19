import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { PurchaseModuleMap } from "./purchase-module-map"

afterEach(cleanup)

describe("mapa de cobertura da planilha Zacarini", () => {
  it("permite navegar às funções operacionais, sem oferecer ações falsas nas pendentes", () => {
    render(<PurchaseModuleMap />)

    expect(screen.getByRole("link", { name: /consultar pedidos/i })).toHaveAttribute("href", "/compras")
    expect(screen.getByRole("link", { name: /gerenciar pedidos/i })).toHaveAttribute("href", "/compras/gerenciar")
    expect(screen.getByText("Produção própria")).toBeInTheDocument()
    expect(screen.getByText("Liquidação por filial")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /abrir produção própria/i })).not.toBeInTheDocument()
  })

  it("identifica a OTB como parcial até existir cenário financeiro homologado", () => {
    render(<PurchaseModuleMap />)
    expect(screen.getByText(/Teto de caixa e verba liberada pendentes/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /ver posição operacional do OTB/i })).toHaveAttribute("href", "/compras/otb")
  })
})
