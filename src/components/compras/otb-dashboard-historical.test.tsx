import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { OtbDashboard } from "./otb-dashboard"

vi.mock("@/components/compras/compras-auth", () => ({ ComprasSair: () => null }))

describe("Origem comercial no OTB", () => {
  it("identifica corretamente itens agregados na fonte materializada como itens, não registros", () => {
    const html = renderToStaticMarkup(<OtbDashboard email="master@so-sal.example"
      purchaseSource={{ status: "conectado", itemCount: 5, lastImportedAt: "2026-11-19T12:00:00Z" }}
      historicalSource={{ status: "conectado", firstMonth: "2025-01-01", lastMonth: "2026-10-01",
        monthCount: 22, totalRecords: 464937, excludedRecords: 3006, unmappedRecords: 0,
        completeLast12Months: true }}
      stockPosition={{ status: "indisponivel", snapshotAt: null, stockCost: null, cmv90d: null,
        stockSkus: null, subgroups: [] }} />)

    expect(html).toContain("Leitura conectada")
    expect(html).toContain("itens de vendas e saídas")
    expect(html).not.toContain("registros de origem")
  })
})
