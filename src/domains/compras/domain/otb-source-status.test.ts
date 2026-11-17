import { describe, expect, it } from "vitest"
import { interpretOtbPurchaseSource } from "./otb-source-status"

describe("Conciliação da fonte OTB", () => {
  it("confirma a fonte apenas com total e data de importação", () => {
    expect(interpretOtbPurchaseSource([{
      total_itens: "125",
      ultima_importacao: "2026-11-17T12:20:42.000Z",
    }], null)).toEqual({
      status: "conectado", itemCount: 125, lastImportedAt: "2026-11-17T12:20:42.000Z",
    })
  })

  it("não converte consulta vazia, parcial ou com erro em zero", () => {
    const invalid = [
      { rows: [], error: null },
      { rows: [{ total_itens: 0, ultima_importacao: null }], error: null },
      { rows: [{ total_itens: "12", ultima_importacao: "2026-11-17T12:20:42.000Z" }], error: { code: "42501" } },
    ]
    for (const item of invalid) {
      expect(interpretOtbPurchaseSource(item.rows, item.error)).toEqual({
        status: "indisponivel", itemCount: null, lastImportedAt: null,
      })
    }
  })
})
