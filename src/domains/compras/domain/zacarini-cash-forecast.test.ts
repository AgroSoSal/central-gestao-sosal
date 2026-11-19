import { describe, expect, it } from "vitest"
import { buildZacariniCashForecast, type ForecastStockLine } from "./zacarini-cash-forecast"
import type { DashboardReferenceRow } from "./dashboard-zacarini-237"
import type { PartialCashSeries } from "./dashboard-cash-contracts"

const start = "2026-11-19"

function ref(codigo: string, valor: number, competencia: string | null = null): DashboardReferenceRow {
  return { codigo, valor, competencia, grupo: "caixa", dimensao: null, rotulo: codigo,
    unidade: "R$", origem_aba: "Fluxo de Caixa", origem_celula: "B9", versao: "2.3.7", situacao: "referencia" }
}

function fixtures(sales = 3000) {
  const rows: DashboardReferenceRow[] = [
    ref("minimo_caixa", 500000), ref("vendas_a_vista", .15), ref("recuperacao_vencidos_semana", .015),
    ref("folha_mensal", 0), ref("encargos_mensais", 0), ref("decimo_terceiro_2026", 0),
    ref("despesas_pct", 0), ref("impostos_pct", 0),
    ...[.349,.228,.31,.113].map((v,i) => ref(`curva_recebimento_faixa_${i+1}`,v)),
    ...[3,6,12,20].map((v,i) => ref(`atraso_recebimento_semanas_${i+1}`,v)),
    ...[1,2,3,4].map(i => ref(`prazo_pagamento_linha_${i}`, 47)),
    ...[1,2,3,4].map(i => ref(`dde_alvo_linha_${i}`, 60)),
  ]
  for (let m=0; m<12; m++) {
    const day = new Date(Date.UTC(2026, 10 + m, 1)).toISOString().slice(0,10)
    for (const scenario of ["noventa", "plano", "historico"]) {
      rows.push(ref(`proj_faturamento_${scenario}`, sales, day))
      for (let line=1; line<=4; line++) rows.push(ref(`proj_entrega_${scenario}_linha_${line}`, 100, day))
    }
    for (let line=1; line<=4; line++) rows.push(ref(`proj_cmv_base_linha_${line}`, 50, day))
  }
  const partial: PartialCashSeries = { state: "parcial", base: "2026-11-11", openingCash: 1000000,
    warning: "Conciliação pendente.", weeklyReceivables: Array(26).fill(0), weeklyPayables: Array(26).fill(0),
    monthlyReceivables: Array(12).fill(0), monthlyPayables: Array(12).fill(0),
    receivables13: 0,payables13:0,receivables12:0,payables12:0,net12:0,lastPayablesImport:null }
  const stock: ForecastStockLine[] = [1,2,3,4].map(linha => ({ linha, estoque: 3000, cmv90: 150 }))
  return { rows, partial, stock }
}

describe("projeção de caixa Zacarini 2.3.7", () => {
  it("não calcula qualquer saldo quando falta uma premissa, carteira ou posição de estoque", () => {
    const f = fixtures()
    expect(buildZacariniCashForecast({ today:start, references:f.rows.slice(1), contracts:f.partial, stock:f.stock, overdue:0 }).state).toBe("indisponivel")
    expect(buildZacariniCashForecast({ today:start, references:f.rows, contracts:f.partial, stock:f.stock.slice(1), overdue:0 }).state).toBe("indisponivel")
    expect(buildZacariniCashForecast({ today:start, references:f.rows, contracts:{ ...f.partial, state:"indisponivel" }, stock:f.stock, overdue:0 }).state).toBe("indisponivel")
  })

  it("conserva 15% à vista e aplica a curva completa de 3/6/12/20 semanas sem recebimento duplicado", () => {
    const f = fixtures(3100)
    const result = buildZacariniCashForecast({ today:start, references:f.rows, contracts:f.partial, stock:f.stock, overdue:0 })
    expect(result.state).toBe("simulado")
    if (result.state !== "simulado") return
    // Novembro tem 30 dias: 12 dias futuros × 3100/30, 15% recebido imediatamente.
    expect(result.weekly["noventa"].withoutPurchases[0]).toBeCloseTo(1000000 + 7*3100/30*.15, 4)
    expect(result.weekly["noventa"].withoutPurchases[3] - result.weekly["noventa"].withoutPurchases[2]).toBeGreaterThan(7*3100/30*.15)
    expect(result.monthly.noventa.length).toBe(12)
    expect(result.weekly.noventa.withPurchases.length).toBe(26)
  })

  it("pagamentos de compras novas só reduzem o cenário com compras, no prazo configurado", () => {
    const f = fixtures(0)
    // A referência de CMV já gera necessidade de reposição, mesmo com faturamento zero.
    const result = buildZacariniCashForecast({ today:start, references:f.rows, contracts:f.partial,
      stock:[1,2,3,4].map(linha => ({ linha, estoque:0, cmv90:150 })), overdue:0 })
    expect(result.state).toBe("simulado")
    if (result.state !== "simulado") return
    expect(result.weekly.noventa.withPurchases[4]).toBeCloseTo(result.weekly.noventa.withoutPurchases[4], 4)
    expect(result.weekly.noventa.withPurchases[8]).toBeLessThan(result.weekly.noventa.withoutPurchases[8])
    expect(result.minimum13WithoutPurchases).toBeGreaterThanOrEqual(result.minimum13WithPurchases)
  })

  it("projeções de 12 meses calculam piso e saldo final, mas nunca aprovam OTB", () => {
    const f = fixtures(3000)
    const result = buildZacariniCashForecast({ today:start, references:f.rows, contracts:f.partial, stock:f.stock, overdue:5000 })
    expect(result.state).toBe("simulado")
    if (result.state !== "simulado") return
    expect(result.minimum12).toBe(Math.min(...result.monthly.noventa))
    expect(result.final12).toBe(result.monthly.noventa.at(-1))
    expect(result.authorizesPurchases).toBe(false)
    expect(result.warnings.join(" ")).toMatch(/concilia|homolog/i)
  })
})
