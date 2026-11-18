import { decisionKey, type PurchaseDecision } from "./purchase-decisions"
import { forecastPurchasePayments, groupForecastByWeek, type ForecastWeek } from "./purchase-payment-forecast"

/** Linha física da importação: pedido e SKU podem se repetir legitimamente. */
export type ForecastSourceItem = {
  importacao_id: number | string | null
  linha_excel: number | string | null
  loja: string | null
  pedido: string | null
  fornecedor_nome?: string | null
  produto_codigo: string | null
  data_pedido: string | null
  condicao_pagamento: string | null
  quantidade_pendente: number | string | null
  valor_pendente: number | string | null
}

export type ForecastKey = { loja: string; pedido: string; produto_codigo: string }
export type ForecastDecision = ForecastKey & { decisao: PurchaseDecision }
export type ForecastFollowUp = ForecastKey & { previsao_entrega: string | null }
export type ForecastClassification = ForecastKey & {
  grupo_subgrupo: string | null
  origem: "cadastro" | "manual" | "sem_classificacao"
}

export type ForecastDataSource = {
  loadPage: (page: number, pageSize: number) => Promise<{ rows: ForecastSourceItem[]; total: number; sourceVersion?: string | null }>
  loadDecisions: (keys: ForecastKey[]) => Promise<ForecastDecision[]>
  loadFollowUps: (keys: ForecastKey[]) => Promise<ForecastFollowUp[]>
  loadClassifications: (keys: ForecastKey[]) => Promise<ForecastClassification[]>
}

export type ForecastTermsIssue = {
  loja: string
  pedido: string
  fornecedor_nome: string | null
  produto_codigo: string
  condicao_pagamento: string | null
  valor_pendente: number
}

export type ConsolidatedPurchaseForecast = {
  totalItems: number
  processedItems: number
  inHorizonAmount: number
  overdueAmount: number
  afterHorizonAmount: number
  unscheduledAmount: number
  excludedByDecision: number
  needsReview: number
  unreconciled: number
  defaultsApplied: number
  termsToReview: ForecastTermsIssue[]
  weeks: ForecastWeek[]
  eligibleInHorizonAmount: number
  eligibleOverdueAmount: number
  eligibleAfterHorizonAmount: number
  eligibleUnscheduledAmount: number
  excludedByGroup5Amount: number
  excludedByGroup6Amount: number
  unclassifiedAmount: number
  unclassifiedCount: number
  classificationIssues: ForecastTermsIssue[]
  eligibleWeeks: ForecastWeek[]
}

const MAX_PAGE_SIZE = 100
const MAX_PAGES = 1000 // limite efetivo da RPC protegida
const MAX_CONCURRENT = 1 // a RPC de conciliação é custosa: três lotes simultâneos excederam statement_timeout (57014)
const MAX_TERMS_ISSUES = 30
const MAX_CLASSIFICATION_ISSUES = 30
const asCents = (value: number) => Math.round(value * 100)

/** Não retorna números globais se alguma parcela da origem estiver incompleta ou mudar durante a consulta. */
export async function consolidatePurchaseForecast(
  source: ForecastDataSource,
  baseDate: string,
  options: { onProgress?: (processed: number, total: number) => void; isCancelled?: () => boolean } = {},
): Promise<ConsolidatedPurchaseForecast> {
  const checkCancelled = () => {
    if (options.isCancelled?.()) throw new Error("Consolidação interrompida.")
  }

  checkCancelled()
  const first = await source.loadPage(1, MAX_PAGE_SIZE)
  if (!Number.isSafeInteger(first.total) || first.total < 0) throw new Error("A contagem total da origem é inválida.")
  const total = first.total
  const sourceVersion = first.sourceVersion ?? null
  const pages = Math.ceil(total / MAX_PAGE_SIZE)
  if (pages > MAX_PAGES) throw new Error("A carteira excede a capacidade de paginação da consulta atual.")

  const seen = new Set<string>()
  const weeklyTemplate = groupForecastByWeek([], baseDate)
  if (weeklyTemplate.length !== 26) throw new Error("Data-base inválida para o calendário de pagamentos.")
  const weeklyCents = weeklyTemplate.map(() => 0)
  const weekInstallments = weeklyTemplate.map(() => 0)
  const eligibleWeeklyCents = weeklyTemplate.map(() => 0)
  const eligibleWeekInstallments = weeklyTemplate.map(() => 0)
  let inHorizon = 0
  let overdue = 0
  let afterHorizon = 0
  let unscheduled = 0
  let excluded = 0
  let needsReview = 0
  let unreconciled = 0
  let defaultsApplied = 0
  let eligibleInHorizon = 0
  let eligibleOverdue = 0
  let eligibleAfterHorizon = 0
  let eligibleUnscheduled = 0
  let excludedByGroup5 = 0
  let excludedByGroup6 = 0
  let unclassified = 0
  let unclassifiedCount = 0
  const issues: { position: number; item: ForecastTermsIssue }[] = []
  const classificationIssues: { position: number; item: ForecastTermsIssue }[] = []
  let processed = 0
  let currentPage = 2
  const baseMillis = Date.parse(baseDate + "T00:00:00Z")

  const processPage = async (page: number, payload?: { rows: ForecastSourceItem[]; total: number; sourceVersion?: string | null }) => {
    checkCancelled()
    const batch = payload ?? await source.loadPage(page, MAX_PAGE_SIZE)
    checkCancelled()
    if (batch.total !== total) throw new Error("A quantidade de pedidos foi alterada durante a consolidação. Recalcule para obter um retrato consistente.")
    if ((batch.sourceVersion ?? null) !== sourceVersion) throw new Error("Uma nova importação foi detectada durante a consolidação. Atualize a página e recalcule.")
    const expected = Math.min(MAX_PAGE_SIZE, total - (page - 1) * MAX_PAGE_SIZE)
    if (batch.rows.length !== expected) throw new Error(`Lote ${page} incompleto: retornou ${batch.rows.length} de ${expected} itens.`)

    const keys: ForecastKey[] = batch.rows.map((row) => {
      if (!row.loja || !row.pedido || !row.produto_codigo) throw new Error(`Lote ${page} contém pedido sem identidade para conciliação.`)
      return { loja: row.loja, pedido: row.pedido, produto_codigo: row.produto_codigo }
    })
    const [decisionRows, followUpRows, classificationRows] = keys.length
      ? await Promise.all([source.loadDecisions(keys), source.loadFollowUps(keys), source.loadClassifications(keys)])
      : [[], [], []]
    checkCancelled()
    const decisions = new Map(decisionRows.map((row) => [decisionKey(row.loja, row.pedido, row.produto_codigo), row.decisao]))
    const arrivals = new Map(followUpRows.map((row) => [decisionKey(row.loja, row.pedido, row.produto_codigo), row.previsao_entrega]))
    const classifications = new Map<string, ForecastClassification>()
    for (const classification of classificationRows) {
      const key = decisionKey(classification.loja, classification.pedido, classification.produto_codigo)
      if (classifications.has(key)) throw new Error(`Classificação duplicada no lote ${page}.`)
      classifications.set(key, classification)
    }
    for (const key of keys) {
      if (!classifications.has(decisionKey(key.loja, key.pedido, key.produto_codigo))) {
        throw new Error(`Classificação incompleta no lote ${page}; os valores financeiros não serão publicados.`)
      }
    }

    for (const [index, row] of batch.rows.entries()) {
      const importId = row.importacao_id
      const line = row.linha_excel
      if (importId === null || line === null || String(importId).trim() === "" || String(line).trim() === "") {
        throw new Error("Uma linha da origem não tem identidade física para garantir ausência de duplicidade.")
      }
      const id = JSON.stringify([String(importId), String(line)])
      if (seen.has(id)) throw new Error("Linha de compra duplicada durante a leitura da carteira. Recalcule a projeção.")
      seen.add(id)
      const key = decisionKey(row.loja!, row.pedido!, row.produto_codigo!)
      const result = forecastPurchasePayments({
        orderDate: row.data_pedido,
        paymentTerms: row.condicao_pagamento,
        pendingQuantity: row.quantidade_pendente,
        pendingValue: row.valor_pendente,
        decision: decisions.get(key) ?? null,
        followUpArrival: arrivals.get(key) ?? null,
        baseDate,
      })
      const group = classifications.get(key)?.grupo_subgrupo?.trim() ?? ""
      const active = result.status === "projetado" || result.status === "conferir"
      const isGroup5 = /^5\./.test(group)
      const isGroup6 = /^6\./.test(group)
      const eligible = active && !!group && !isGroup5 && !isGroup6
      if (active && isGroup5) excludedByGroup5 += asCents(result.pendingAmount ?? 0)
      if (active && isGroup6) excludedByGroup6 += asCents(result.pendingAmount ?? 0)
      if (active && !group) {
        unclassified += asCents(result.pendingAmount ?? 0)
        unclassifiedCount += 1
        classificationIssues.push({ position: (page - 1) * MAX_PAGE_SIZE + index, item: {
          loja: row.loja!, pedido: row.pedido!, fornecedor_nome: row.fornecedor_nome ?? null,
          produto_codigo: row.produto_codigo!, condicao_pagamento: row.condicao_pagamento,
          valor_pendente: result.pendingAmount!,
        } })
      }
      if (eligible) {
        eligibleInHorizon += asCents(result.inHorizonAmount)
        eligibleOverdue += asCents(result.overdueAmount)
        eligibleAfterHorizon += asCents(result.afterHorizonAmount)
        eligibleUnscheduled += asCents(result.unscheduledAmount)
      }
      inHorizon += asCents(result.inHorizonAmount)
      overdue += asCents(result.overdueAmount)
      afterHorizon += asCents(result.afterHorizonAmount)
      unscheduled += asCents(result.unscheduledAmount)
      if (result.status === "segurado" || result.status === "cancelar") excluded += asCents(result.pendingAmount ?? 0)
      if (result.status === "conferir") needsReview += 1
      if (result.status === "conferir") {
        issues.push({ position: (page - 1) * MAX_PAGE_SIZE + index, item: {
          loja: row.loja!, pedido: row.pedido!, fornecedor_nome: row.fornecedor_nome ?? null,
          produto_codigo: row.produto_codigo!, condicao_pagamento: row.condicao_pagamento,
          valor_pendente: result.pendingAmount!,
        } })
      }
      if (result.status === "projetado" && result.conditionSource === "padrao") defaultsApplied += 1
      if (result.status === "sem_dados") unreconciled += 1
      for (const installment of result.installments) {
        const index = Math.floor((Date.parse(installment.dueDate + "T00:00:00Z") - baseMillis) / (7 * 86400000))
        if (index >= 0 && index < 26) {
          weeklyCents[index] += asCents(installment.amount)
          weekInstallments[index] += 1
          if (eligible) {
            eligibleWeeklyCents[index] += asCents(installment.amount)
            eligibleWeekInstallments[index] += 1
          }
        }
      }
    }
    processed += batch.rows.length
    options.onProgress?.(processed, total)
  }

  await processPage(1, first)
  const worker = async () => {
    while (currentPage <= pages) {
      const page = currentPage++
      await processPage(page)
    }
  }
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT, Math.max(0, pages - 1)) }, worker))
  checkCancelled()
  if (seen.size !== total || processed !== total) throw new Error("A carteira não foi lida integralmente. Nenhum total parcial será apresentado.")

  return {
    totalItems: total,
    processedItems: processed,
    inHorizonAmount: inHorizon / 100,
    overdueAmount: overdue / 100,
    afterHorizonAmount: afterHorizon / 100,
    unscheduledAmount: unscheduled / 100,
    excludedByDecision: excluded / 100,
    needsReview,
    unreconciled,
    defaultsApplied,
    termsToReview: issues.sort((a, b) => a.position - b.position).slice(0, MAX_TERMS_ISSUES).map((issue) => issue.item),
    weeks: weeklyTemplate.map((week, i) => ({ ...week, amount: weeklyCents[i] / 100, installmentsCount: weekInstallments[i] })),
    eligibleInHorizonAmount: eligibleInHorizon / 100,
    eligibleOverdueAmount: eligibleOverdue / 100,
    eligibleAfterHorizonAmount: eligibleAfterHorizon / 100,
    eligibleUnscheduledAmount: eligibleUnscheduled / 100,
    excludedByGroup5Amount: excludedByGroup5 / 100,
    excludedByGroup6Amount: excludedByGroup6 / 100,
    unclassifiedAmount: unclassified / 100,
    unclassifiedCount,
    classificationIssues: classificationIssues.sort((a, b) => a.position - b.position).slice(0, MAX_CLASSIFICATION_ISSUES).map((issue) => issue.item),
    eligibleWeeks: weeklyTemplate.map((week, i) => ({ ...week, amount: eligibleWeeklyCents[i] / 100, installmentsCount: eligibleWeekInstallments[i] })),
  }
}
