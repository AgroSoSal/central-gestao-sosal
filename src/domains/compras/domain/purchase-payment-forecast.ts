import { operationalDecision, type PurchaseDecision } from "./purchase-decisions"

/** Projeção somente de leitura: não cria títulos a pagar nem grava no caixa/OTB. */
export type PurchasePaymentInput = {
  orderDate: string | null
  paymentTerms: string | null
  pendingQuantity: number | string | null
  pendingValue: number | string | null
  decision: PurchaseDecision | null
  followUpArrival?: string | null
  baseDate: string
}

export type PaymentHorizon = "vencido" | "26_semanas" | "posterior"
export type PurchaseInstallment = {
  number: number
  dueDate: string
  amount: number
  horizon: PaymentHorizon
}
export type ForecastStatus = "projetado" | "segurado" | "cancelar" | "entregue" | "sem_valor" | "sem_dados" | "conferir"
export type PurchasePaymentForecast = {
  status: ForecastStatus
  operationalDecision: ReturnType<typeof operationalDecision>
  included: boolean
  pendingAmount: number | null
  estimatedArrival: string | null
  arrivalSource: "calculada" | "follow-up" | null
  conditionSource: "fornecida" | "padrao" | "invalida" | null
  paymentDays: number[]
  installments: PurchaseInstallment[]
  inHorizonAmount: number
  overdueAmount: number
  afterHorizonAmount: number
  unscheduledAmount: number
  issue: string | null
}

export type ForecastWeek = {
  index: number
  startsAt: string
  endsAt: string
  amount: number
  installmentsCount: number
}

const DAYS_DEFAULT = 30
const DELIVERY_LEAD_DAYS = 7
const HORIZON_DAYS = 26 * 7
const DAY_MS = 24 * 60 * 60 * 1000

function dayOf(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date
}

function plusDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function numeric(value: number | string | null): number | null {
  if (value === null || (typeof value === "string" && value.trim() === "")) return null
  const result = Number(value)
  return Number.isFinite(result) && result >= 0 && result <= Number.MAX_SAFE_INTEGER / 100 ? result : null
}

function paymentDays(value: string | null): { days: number[]; source: "fornecida" | "padrao" | "invalida"; issue: string | null } {
  const raw = (value ?? "").trim()
  if (!raw) return { days: [DAYS_DEFAULT], source: "padrao", issue: "Condição não informada: aplicado prazo padrão de 30 dias." }

  // A Zacarini armazena a condição como dias a partir da chegada: 30/60/90, etc.
  const normalized = raw.replace(/\s*(?:d|dias?)\.?\s*$/i, "").replace(/\s+/g, "")
  if (!/^\d{1,4}(?:[/,;-]\d{1,4}){0,9}$/.test(normalized)) {
    return { days: [], source: "invalida", issue: `Condição de pagamento "${raw.slice(0, 50)}" não reconhecida. Confira os vencimentos.` }
  }
  const days = normalized.split(/[/,;-]/).map(Number)
  if (days.length > 10 || days.some((day) => !Number.isInteger(day) || day < 0)) {
    return { days: [], source: "invalida", issue: "Condição inválida: máximo de 10 parcelas." }
  }
  return { days, source: "fornecida", issue: null }
}

/** Calcula somente o saldo ainda não entregue. AP vazia é projetada por regra financeira, não aprovada operacionalmente. */
export function forecastPurchasePayments(input: PurchasePaymentInput): PurchasePaymentForecast {
  const operational = operationalDecision(input.decision)
  const pending = numeric(input.pendingValue)
  const pendingQuantity = numeric(input.pendingQuantity)
  const empty: PurchasePaymentForecast = {
    status: "sem_dados", operationalDecision: operational, included: false,
    pendingAmount: pending, estimatedArrival: null, arrivalSource: null, conditionSource: null,
    paymentDays: [], installments: [], inHorizonAmount: 0, overdueAmount: 0,
    afterHorizonAmount: 0, unscheduledAmount: 0, issue: null,
  }

  if (pending === null || pendingQuantity === null || !dayOf(input.baseDate) || !dayOf(input.orderDate)) {
    return { ...empty, issue: "Sem conciliação, data do pedido ou data-base válida para calcular." }
  }
  if (pendingQuantity === 0 && pending === 0) return { ...empty, status: "entregue", pendingAmount: pending }
  if (pendingQuantity === 0) return { ...empty, status: "sem_dados", issue: "Saldo inconsistente: quantidade entregue sem baixa do valor pendente." }
  if (pending === 0) return { ...empty, status: "sem_valor", pendingAmount: pending }
  if (input.decision === "Segurar" || input.decision === "Cancelar") {
    return { ...empty, status: input.decision === "Segurar" ? "segurado" : "cancelar", pendingAmount: pending }
  }

  const terms = paymentDays(input.paymentTerms)
  if (terms.source === "invalida") {
    return {
      ...empty, status: "conferir", pendingAmount: pending,
      conditionSource: terms.source, issue: terms.issue, unscheduledAmount: pending,
    }
  }

  const base = dayOf(input.baseDate)!
  const order = dayOf(input.orderDate)!
  const informed = dayOf(input.followUpArrival)
  const arrival = informed ?? plusDays(new Date(Math.max(base.getTime(), order.getTime())), DELIVERY_LEAD_DAYS)
  const source = informed ? "follow-up" : "calculada"
  const horizonEnd = plusDays(base, HORIZON_DAYS)
  const cents = Math.round(pending * 100)
  const numberOfPayments = terms.days.length
  const baseCents = Math.floor(cents / numberOfPayments)
  const remainder = cents - baseCents * numberOfPayments

  const installments = terms.days.map((day, index): PurchaseInstallment => {
    const dueDate = plusDays(arrival, day)
    const horizon: PaymentHorizon = dueDate < base ? "vencido" : dueDate >= horizonEnd ? "posterior" : "26_semanas"
    return {
      number: index + 1,
      dueDate: isoDate(dueDate),
      amount: (baseCents + (index < remainder ? 1 : 0)) / 100,
      horizon,
    }
  })
  const sumCents = (horizon: PaymentHorizon) => installments
    .filter((item) => item.horizon === horizon)
    .reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100

  return {
    status: "projetado", operationalDecision: operational, included: true,
    pendingAmount: pending, estimatedArrival: isoDate(arrival), arrivalSource: source,
    conditionSource: terms.source, paymentDays: terms.days, installments,
    inHorizonAmount: sumCents("26_semanas"), overdueAmount: sumCents("vencido"),
    afterHorizonAmount: sumCents("posterior"), unscheduledAmount: 0, issue: terms.issue,
  }
}

/** Agrupa apenas parcelas efetivamente projetadas na janela móvel de 26 semanas. */
export function groupForecastByWeek(forecasts: PurchasePaymentForecast[], baseDate: string, weeks = 26): ForecastWeek[] {
  const base = dayOf(baseDate)
  if (!base || !Number.isInteger(weeks) || weeks < 1 || weeks > 52) return []
  const buckets = Array.from({ length: weeks }, (_, index): ForecastWeek => ({
    index: index + 1,
    startsAt: isoDate(plusDays(base, index * 7)),
    endsAt: isoDate(plusDays(base, index * 7 + 6)),
    amount: 0,
    installmentsCount: 0,
  }))
  const totalCents = Array.from({ length: weeks }, () => 0)
  for (const forecast of forecasts) {
    if (!forecast.included) continue
    for (const installment of forecast.installments) {
      const due = dayOf(installment.dueDate)
      if (!due) continue
      const index = Math.floor((due.getTime() - base.getTime()) / (7 * DAY_MS))
      if (index < 0 || index >= weeks) continue
      totalCents[index] += Math.round(installment.amount * 100)
      buckets[index].installmentsCount += 1
    }
  }
  for (let i = 0; i < buckets.length; i += 1) buckets[i].amount = totalCents[i] / 100
  return buckets
}
