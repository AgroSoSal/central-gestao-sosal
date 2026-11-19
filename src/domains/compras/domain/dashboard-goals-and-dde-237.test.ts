import { describe, expect, it } from "vitest"
import { accumulatedSalesTarget, accumulatedBudgetValue, summarizeDdePlanCoverage } from "./dashboard-goals-and-dde-237"
import type { DashboardReferenceRow } from "./dashboard-zacarini-237"

const row = (code: string, month: string, amount: number): DashboardReferenceRow => ({
  codigo: code, grupo: "metas_linha", dimensao: "Nutrição", competencia: month,
  valor: amount, rotulo: code, unidade: "R$", origem_aba: "Metas de Vendas",
  origem_celula: "D26", versao: "2.3.7", situacao: "referencia",
})

describe("metas e plano DDE independentes do Excel", () => {
  it("calcula a meta anual acumulada até a competência selecionada, incluindo janeiro", () => {
    const goals = [row("meta_linha_1", "2026-01-01", 100),row("meta_linha_1", "2026-02-01", 200),
      row("meta_linha_2", "2026-01-01", 50),row("meta_linha_2", "2026-02-01", 150)]
    expect(accumulatedSalesTarget(goals, ["meta_linha_1","meta_linha_2"], "2026-02")).toBe(500)
  })

  it("não inventa meta anual diante de competência ou linha ausente", () => {
    const goals = [row("meta_linha_1", "2026-01-01", 100)]
    expect(accumulatedSalesTarget(goals,["meta_linha_1"], "2026-02")).toBeNull()
    expect(accumulatedSalesTarget(goals,["meta_linha_1","meta_linha_2"], "2026-01")).toBeNull()
    expect(accumulatedSalesTarget(goals,["meta_linha_1"], "2036-01")).toBeNull()
  })

  it("aceita meta legítima zero e rejeita referência duplicada", () => {
    const goal = row("meta_loja_AN", "2026-01-01", 0)
    expect(accumulatedSalesTarget([goal],["meta_loja_AN"],"2026-01")).toBe(0)
    expect(accumulatedSalesTarget([goal,goal],["meta_loja_AN"],"2026-01")).toBeNull()
  })

  it("pondera o plano por CMV apenas dos subgrupos cobertos, com transparência da cobertura", () => {
    const result = summarizeDdePlanCoverage([
      {grupo_subgrupo:"1.LINHA NUTRIÇÃO / A",dde_meta:30,cmv_90d:900,valor_estoque:600},
      {grupo_subgrupo:"1.LINHA NUTRIÇÃO / B",dde_meta:90,cmv_90d:300,valor_estoque:100},
      {grupo_subgrupo:"2.SAÚDE / X",dde_meta:60,cmv_90d:0,valor_estoque:120},
    ])
    expect(result[1].targetDde).toBeCloseTo(45)
    expect(result[1].observedDde).toBeCloseTo(52.5)
    expect(result[1].covered).toBe(2)
    expect(result[2].targetDde).toBeNull()
    expect(result[2].covered).toBe(1)
  })

  it("não inclui dados sem CMV confiável nem subgrupos sem linha definida", () => {
    const result = summarizeDdePlanCoverage([
      {grupo_subgrupo:"1.LINHA NUTRIÇÃO / A",dde_meta:60,cmv_90d:null,valor_estoque:100},
      {grupo_subgrupo:"1.LINHA NUTRIÇÃO / B",dde_meta:60,cmv_90d:100,valor_estoque:null},
      {grupo_subgrupo:"SEM LINHA",dde_meta:60,cmv_90d:900,valor_estoque:100},
    ])
    expect(result[1].covered).toBe(2)
    expect(result[1].valid).toBe(0)
    expect(result[1].targetDde).toBeNull()
  })

  it("repete a DRE: soma custos negativos e pondera margem acumulada pela receita", () => {
    const goals = [
      row("dre_receita_bruta","2026-01-01",100),row("dre_receita_bruta","2026-02-01",300),
      row("dre_lucro_bruto","2026-01-01",30),row("dre_lucro_bruto","2026-02-01",60),
      row("dre_cmv","2026-01-01",-70),row("dre_cmv","2026-02-01",-240),
    ]
    expect(accumulatedBudgetValue(goals,"dre_cmv","2026-02")).toBe(-310)
    expect(accumulatedBudgetValue(goals,"dre_margem_bruta","2026-02")).toBeCloseTo(0.225)
    expect(accumulatedBudgetValue(goals,"dre_margem_bruta","2026-01")).toBeCloseTo(0.3)
    expect(accumulatedBudgetValue(goals,"dre_ebitda","2026-02")).toBeNull()
  })
})
