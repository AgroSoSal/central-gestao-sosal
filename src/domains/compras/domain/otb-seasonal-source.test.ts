import { describe, expect, it } from "vitest"
import { interpretOtbSeasonalHistory } from "./otb-seasonal-source"

const row = {
  linha: 1,
  grupo_subgrupo: "1.LINHA NUTRIÇÃO / MINERAL E PROTEICO",
  venda_janela_1: "3221150.45",
  venda_janela_2: "3379135.78",
  venda_janela_3: "3777907.81",
  venda_janela_4: "3994738.10",
  meses_linha: 6,
}

describe("fonte Master das quatro janelas sazonais OTB 2.3.7", () => {
  it("converte dados agregados completos e preserva as quatro vendas de saída", () => {
    const result = interpretOtbSeasonalHistory([row], null, "2026-12-01")
    expect(result.state).toBe("conectado")
    if (result.state !== "conectado") return
    expect(result.month).toBe("2026-12-01")
    expect(result.groups).toEqual([{ line: 1, name: row.grupo_subgrupo,
      sales: [3221150.45, 3379135.78, 3777907.81, 3994738.10] }])
    expect(result.windowMonths).toEqual([
      "2025-12 a 2026-02", "2026-01 a 2026-03",
      "2026-02 a 2026-04", "2026-03 a 2026-05",
    ])
  })

  it("recusa meses-base incompletos e linhas repetidas, sem criar zeros", () => {
    expect(interpretOtbSeasonalHistory([{ ...row, meses_linha: 5 }], null, "2026-12-01").state)
      .toBe("indisponivel")
    expect(interpretOtbSeasonalHistory([row, row], null, "2026-12-01").state)
      .toBe("indisponivel")
  })

  it("recusa falha de RPC e valores numéricos inválidos", () => {
    expect(interpretOtbSeasonalHistory([row], { code: "42501" }, "2026-12-01").state)
      .toBe("indisponivel")
    expect(interpretOtbSeasonalHistory([{ ...row, venda_janela_2: "abc" }], null, "2026-12-01").state)
      .toBe("indisponivel")
    expect(interpretOtbSeasonalHistory([row], null, "2026-12-18").state)
      .toBe("indisponivel")
  })
})
