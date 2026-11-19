import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { ComprasExecutiveDashboard } from "./compras-executive-dashboard"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }))

describe("dashboard de caixa", () => {
  it("identifica títulos existentes como compromissos e não os chama de saldo final da projeção", () => {
    const today = "2026-11-19"
    const weeks = Array.from({ length: 26 }, (_, i) => {
      const d = new Date("2026-11-19T12:00:00Z")
      d.setUTCDate(d.getUTCDate() + i * 7)
      const e = new Date(d)
      e.setUTCDate(e.getUTCDate() + 6)
      return { inicio: d.toISOString().slice(0,10), fim: e.toISOString().slice(0,10),
        receber_identificado: 50, pagar_identificado: 100, titulos_receber: 1,
        titulos_pagar: 1, ultima_importacao_pagar: "2026-11-19T14:00:00Z" }
    })
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date("2026-11-01T12:00:00Z")
      d.setUTCMonth(d.getUTCMonth() + i)
      return { mes: d.toISOString().slice(0,10), receber_identificado: 100,
        pagar_identificado: 1000, titulos_receber: 1, titulos_pagar: 1,
        saldo_contratado_identificado: -900, ultima_importacao_pagar: "2026-11-19T14:00:00Z" }
    })
    const html = renderToStaticMarkup(<ComprasExecutiveDashboard
      month="2026-11" today={today} email="master@example.com" referenceRows={[]}
      salesRows={[]} shopPositions={[]} stockRows={[]}
      bankRows={[{ conta_ref:"BDS 1234", filial:"BANDEIRANTES", banco:"PENDENTE_IDENTIFICACAO",
        data_corte_comum:"2026-11-11",data_ultimo_saldo:"2026-11-18",ultimo_saldo:1900,
        data_saldo_base:"2026-11-11",saldo_base:1000,data_arquivo:"2026-11-18",
        diferenca_arquivo:0,conciliado:false }]}
      contractedWeeks={weeks} contractedMonths={months} errors={{}}
    />)
    expect(html).toContain("Títulos a receber · 13 semanas")
    expect(html).toContain("Fornecedores a pagar · 13 semanas")
    expect(html).toContain("Títulos a receber · 12 meses")
    expect(html).not.toContain("Saldo final · títulos 12M")
    expect(html).not.toContain("Menor saldo · títulos 12M")
  })
})
