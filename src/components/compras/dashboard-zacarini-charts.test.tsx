import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { GroupedBarsChart, PerformanceGauge, ProjectionChart } from "./dashboard-zacarini-charts"

describe("gráficos do Dashboard Zacarini", () => {
  it("renderiza velocímetro com quatro zonas e sem ponteiro quando a meta não existe", () => {
    const present = renderToStaticMarkup(<PerformanceGauge label="Vendas do mês" value={0.92} headline="92%" detail="Fonte Supabase" />)
    expect(present.match(/<path /g)).toHaveLength(5)
    expect(present).toContain("92% do objetivo")
    const absent = renderToStaticMarkup(<PerformanceGauge label="Margem EBITDA" value={null} headline="—" detail="Sem base" />)
    expect(absent).toContain("sem índice de atingimento validado")
    expect(absent).not.toContain("NaN")
  })

  it("mostra apenas barras com números finitos e distingue ausência de zero", () => {
    const html = renderToStaticMarkup(<GroupedBarsChart title="Vendas por loja" subtitle="Novembro" labels={["Meta", "Real"]} unit="money" rows={[
      { label: "Anastácio", values: [100, 90] }, { label: "Campo Grande", values: [null, 0] },
    ]} />)
    expect(html).not.toContain("NaN")
    expect(html).toContain("Anastácio")
    expect(html).toContain("Campo Grande")
    expect(html.match(/<rect /g)?.length).toBe(3)
  })

  it("reserva o gráfico de projeção sem fabricar uma curva", () => {
    const html = renderToStaticMarkup(<ProjectionChart title="Caixa 12M" subtitle="Sem homologação" legends={["Base", "Estresse"]} />)
    expect(html).toContain("Série financeira indisponível")
    expect(html).not.toContain("<polyline")
    expect(html).toContain("Base")
  })
})
