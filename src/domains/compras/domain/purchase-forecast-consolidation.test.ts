import { describe, expect, it } from "vitest"
import { consolidatePurchaseForecast, type ForecastSourceItem } from "./purchase-forecast-consolidation"

const makeItem = (index: number, overrides: Partial<ForecastSourceItem> = {}): ForecastSourceItem => ({
  importacao_id: 1000,
  linha_excel: index,
  loja: "SO SAL",
  pedido: String(index),
  produto_codigo: `SKU${index}`,
  data_pedido: "2026-11-10",
  condicao_pagamento: "30",
  quantidade_pendente: 2,
  valor_pendente: 20,
  ...overrides,
})

describe("consolidação integral de compras", () => {
  it("agrega todas as páginas além da primeira centena, separando parciais, decisões e semanas", async () => {
    const all = Array.from({ length: 205 }, (_, i) => makeItem(i + 1))
    all[0] = makeItem(1, { valor_pendente: 10.01, quantidade_pendente: 1 })
    all[1] = makeItem(2, { valor_pendente: 300, quantidade_pendente: 3, condicao_pagamento: "30/60" })
    all[2] = makeItem(3, { valor_pendente: 22, quantidade_pendente: 1, condicao_pagamento: "BONIFICAÇÃO" })
    const progress: number[] = []
    const result = await consolidatePurchaseForecast({
      loadPage: async (page, size) => ({ rows: all.slice((page - 1) * size, page * size), total: all.length }),
      loadDecisions: async (keys) => keys.flatMap((key) => key.pedido === "4" ? [{ ...key, decisao: "Segurar" as const }] : []),
      loadFollowUps: async (keys) => keys.flatMap((key) => key.pedido === "2" ? [{ ...key, previsao_entrega: "2026-11-30" }] : []),
    }, "2026-11-16", { onProgress: (done) => progress.push(done) })

    expect(result.totalItems).toBe(205)
    expect(result.processedItems).toBe(205)
    expect(progress.at(-1)).toBe(205)
    expect(result.excludedByDecision).toBe(20)
    expect(result.unscheduledAmount).toBe(22)
    expect(result.needsReview).toBe(1)
    expect(result.inHorizonAmount).toBeCloseTo(10.01 + 300 + 201 * 20)
    expect(result.weeks.reduce((sum, week) => sum + week.amount, 0)).toBeCloseTo(result.inHorizonAmount)
    expect(result.weeks.find((week) => week.startsAt === "2027-01-25")?.amount).toBe(150)
  })

  it("não soma linhas duplicadas nem aprova uma carteira parcialmente consultada", async () => {
    const rows = [makeItem(1), makeItem(1)]
    await expect(consolidatePurchaseForecast({
      loadPage: async () => ({ rows, total: 2 }),
      loadDecisions: async () => [],
      loadFollowUps: async () => [],
    }, "2026-11-16")).rejects.toThrow(/duplicada/i)
  })

  it("detecta paginação alterada durante a conciliação", async () => {
    const all = Array.from({ length: 101 }, (_, i) => makeItem(i + 1))
    await expect(consolidatePurchaseForecast({
      loadPage: async (page) => ({ rows: page === 1 ? all.slice(0, 100) : all.slice(100), total: page === 1 ? 101 : 102 }),
      loadDecisions: async () => [],
      loadFollowUps: async () => [],
    }, "2026-11-16")).rejects.toThrow(/alterad/i)
  })

  it("detecta uma nova importação mesmo se o total de linhas permanecer igual", async () => {
    const all = Array.from({ length: 101 }, (_, i) => makeItem(i + 1))
    await expect(consolidatePurchaseForecast({
      loadPage: async (page) => ({ rows: page === 1 ? all.slice(0, 100) : all.slice(100), total: 101, sourceVersion: page === 1 ? "2026-11-16T01:00:00Z" : "2026-11-16T02:00:00Z" }),
      loadDecisions: async () => [], loadFollowUps: async () => [],
    }, "2026-11-16")).rejects.toThrow(/importação|alterad/i)
  })

  it("impede o resultado global quando decisões ou Follow-up falham", async () => {
    for (const faulty of ["decisions", "followup"] as const) {
      await expect(consolidatePurchaseForecast({
        loadPage: async () => ({ rows: [makeItem(1)], total: 1 }),
        loadDecisions: async () => { if (faulty === "decisions") throw new Error("Decisões indisponíveis"); return [] },
        loadFollowUps: async () => { if (faulty === "followup") throw new Error("Follow-up indisponível"); return [] },
      }, "2026-11-16")).rejects.toThrow(/indisponível|indisponíveis/i)
    }
  })

  it("usa novas previsões do Follow-up para mudar as semanas após recálculo", async () => {
    let date = "2026-11-20"
    const source = {
      loadPage: async () => ({ rows: [makeItem(1)], total: 1 }),
      loadDecisions: async () => [],
      loadFollowUps: async () => [{ loja: "SO SAL", pedido: "1", produto_codigo: "SKU1", previsao_entrega: date }],
    }
    const before = await consolidatePurchaseForecast(source, "2026-11-16")
    date = "2026-12-20"
    const after = await consolidatePurchaseForecast(source, "2026-11-16")
    expect(before.weeks.find((w) => w.amount)?.startsAt).not.toBe(after.weeks.find((w) => w.amount)?.startsAt)
    expect(after.inHorizonAmount).toBe(20)
  })

  it("não inventa zeros globais se a primeira página falhar ou tiver dados incompletos", async () => {
    await expect(consolidatePurchaseForecast({
      loadPage: async () => { throw new Error("Conciliação indisponível") },
      loadDecisions: async () => [], loadFollowUps: async () => [],
    }, "2026-11-16")).rejects.toThrow(/Conciliação/)
    await expect(consolidatePurchaseForecast({
      loadPage: async () => ({ rows: [makeItem(1)], total: Number.NaN }),
      loadDecisions: async () => [], loadFollowUps: async () => [],
    }, "2026-11-16")).rejects.toThrow(/contagem/i)
  })
})
