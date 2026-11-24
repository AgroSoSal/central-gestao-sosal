import { describe, expect, it } from "vitest"
import {
  DASHBOARD_BLOCKS,
  DASHBOARD_CHARTS,
  dashboardReference,
  metricWithTarget,
  summarizeDashboardSales,
  type DashboardReferenceRow,
} from "./dashboard-zacarini-237"

const base: DashboardReferenceRow = {
  codigo: "meta_linha_1", grupo: "metas_linha", dimensao: "1",
  competencia: "2026-11-01", rotulo: "Nutrição", valor: 2840000,
  unidade: "BRL", origem_aba: "Dashboard", origem_celula: "D36",
  versao: "2.3.7", situacao: "referencia",
}

describe("Dashboard Zacarini 2.3.7", () => {
  it("mantém os onze gráficos e cinco velocímetros exatamente na ordem da aba", () => {
    expect(DASHBOARD_CHARTS.map(c => [c.id, c.type])).toEqual([
      ["saldo_26_semanas", "linha"], ["vendas_por_loja", "barras"],
      ["dde_por_linha", "barras"], ["estoque_parado_por_loja", "barras"],
      ["vendas_mes", "velocimetro"], ["vendas_ano", "velocimetro"],
      ["margem_bruta", "velocimetro"], ["margem_ebitda", "velocimetro"],
      ["lucro_liquido", "velocimetro"],
      ["saldo_12m", "linha"], ["verba_comprador", "barras"],
    ])
    expect(DASHBOARD_CHARTS.every(c => c.origem_versao === "2.3.7")).toBe(true)
  })
  it("cobre todos os blocos visíveis da aba Dashboard, inclusive DRE e lojas", () => {
    expect(DASHBOARD_BLOCKS.map((block) => block.id)).toEqual([
      "velocimetros", "caixa", "indicadores", "linhas", "lojas", "dre", "graficos",
    ])
    expect(DASHBOARD_BLOCKS.find((block) => block.id === "dre")?.indicadores)
      .toContain("ebitda")
    expect(DASHBOARD_BLOCKS.find((block) => block.id === "lojas")?.indicadores)
      .toContain("inadimplencia")
  })

  it("importa somente parâmetros da versão/célula/período exatos, nunca resultados de outro mês", () => {
    const reference = dashboardReference([base], "meta_linha_1", "2026-11-01")
    expect(reference).toEqual({ valor: 2840000, estado: "referencia", origem: "Dashboard!D36 · Zacarini 2.3.7" })
    expect(dashboardReference([base], "meta_linha_1", "2026-12-01")).toEqual({ valor: null, estado: "indisponivel", origem: null })
  })

  it("prioriza carga integral 2.3.8 sem usar a célula 2.3.7 para o mesmo código", () => {
    const current = {...base, versao: "2.3.8", valor: 3200000, origem_celula: "E36"}
    expect(dashboardReference([base, current], base.codigo, base.competencia)).toEqual({
      valor: 3200000, estado: "referencia", origem: "Dashboard!E36 · Zacarini 2.3.8",
    })
  })
  it("bloqueia a mescla de versões quando a carga 2.3.8 está incompleta", () => {
    const another = {...base, codigo: "meta_linha_2", versao: "2.3.8", valor: 100}
    expect(dashboardReference([base, another], base.codigo, base.competencia))
      .toEqual({valor: null, estado: "indisponivel", origem: null})
  })
  it("não escolhe uma célula arbitrária quando a versão 2.3.8 traz valores duplicados", () => {
    const row = {...base, versao: "2.3.8", valor: 3200000}
    expect(dashboardReference([base, row, {...row, valor: 3100000}], base.codigo, base.competencia).valor)
      .toBeNull()
  })
  it("não transforma referência de Excel em orçamento homologado", () => {
    expect(metricWithTarget(1420000, dashboardReference([base], base.codigo, base.competencia))).toEqual({
      realizado: 1420000, meta: 2840000, percentual: 0.5, estado: "referencia",
    })
    expect(metricWithTarget(null, dashboardReference([base], base.codigo, base.competencia)).percentual).toBeNull()
  })

  it("rejeita valores não finitos, duplicados ou sem rastreabilidade; preserva zero válido", () => {
    expect(dashboardReference([{ ...base, valor: "NaN" }], base.codigo, base.competencia).valor).toBeNull()
    expect(dashboardReference([base, base], base.codigo, base.competencia).valor).toBeNull()
    expect(dashboardReference([{ ...base, origem_celula: "" }], base.codigo, base.competencia).valor).toBeNull()
    expect(dashboardReference([{ ...base, valor: 0 }], base.codigo, base.competencia).valor).toBe(0)
  })
})

describe("consolidacao gerencial do Dashboard", () => {
  it("separa faturamento vendido de margem de saida e agrega filiais e linhas", () => {
    const result = summarizeDashboardSales([
      { filial: "AN", loja: "Anastácio", linha: 1, visao: "vendido", vendido_mes: 100, custo_mes: 80, lucro_mes: 20, vendido_ano: 500 },
      { filial: "AN", loja: "Anastácio", linha: 2, visao: "vendido", vendido_mes: -10, custo_mes: -8, lucro_mes: -2, vendido_ano: 90 },
      { filial: "AN", loja: "Anastácio", linha: 1, visao: "saida", vendido_mes: 80, custo_mes: 50, lucro_mes: 30, vendido_ano: 400 },
      { filial: "CG", loja: "Campo Grande", linha: 1, visao: "vendido", vendido_mes: 200, custo_mes: 130, lucro_mes: 70, vendido_ano: 400 },
      { filial: "CG", loja: "Campo Grande", linha: 0, visao: "vendido", vendido_mes: 999, custo_mes: 0, lucro_mes: 999, vendido_ano: 999 },
    ])
    expect(result.vendidoMes).toBe(290)
    expect(result.vendidoAno).toBe(990)
    expect(result.linhas[1].vendidoMes).toBe(300)
    expect(result.lojas.AN.vendidoMes).toBe(90)
    expect(result.lojas.AN.margemBruta).toBeCloseTo(0.375)
    expect(result.lojas.CG.margemBruta).toBeNull()
  })

  it("nao transforma dados ausentes ou invalidos em valor financeiro", () => {
    const result = summarizeDashboardSales([{ filial: "CG", loja: "Campo Grande", linha: 1, visao: "saida", vendido_mes: "NaN", custo_mes: 30, lucro_mes: 10, vendido_ano: 100 }])
    expect(result.vendidoMes).toBe(0)
    expect(result.lojas.CG.margemBruta).toBeNull()
  })
})
