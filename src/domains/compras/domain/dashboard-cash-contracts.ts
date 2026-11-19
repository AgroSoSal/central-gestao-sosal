import { assessBankPosition, type BankPositionRow, type ContractedMonth } from "./otb-bank-readiness"

/** Série de títulos existentes. Não inclui receitas de vendas futuras nem OTB. */
export type ContractedWeek = {
  inicio: string
  fim: string
  receber_identificado: number | string
  pagar_identificado: number | string
  titulos_receber: number | string
  titulos_pagar: number | string
  ultima_importacao_pagar: string | null
}

export type PartialCashSeries = {
  state: "indisponivel" | "parcial"
  base: string | null
  warning: string | null
  weeklyReceivables: number[]
  weeklyPayables: number[]
  monthlyReceivables: number[]
  monthlyPayables: number[]
  receivables13: number | null
  payables13: number | null
  receivables12: number | null
  payables12: number | null
  net12: number | null
  openingCash: number | null
  lastPayablesImport: string | null
}

const timestamp = (s: string) => Date.parse(s + "T12:00:00Z")

function verifiedMoney(value: number | string): number | null {
  if (value === null || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * A planilha separa saldos de abertura, títulos e operação projetada. Esta
 * leitura SOMENTE encadeia os dois primeiros; jamais chama o parcial de cenário
 * com OTB, sem compras, pior caso, ou libera verba para pedidos.
 */
export function buildPartialCashSeries(
  banks: readonly BankPositionRow[], weeks: readonly ContractedWeek[],
  months: readonly ContractedMonth[], today: string,
): PartialCashSeries {
  const unavailable: PartialCashSeries = {
    state: "indisponivel", base: null, warning: "Sem carteira completa e base bancária consistente.",
    weeklyReceivables: [], weeklyPayables: [], monthlyReceivables: [], monthlyPayables: [],
    receivables13: null, payables13: null, receivables12: null,
    payables12: null, net12: null, openingCash: null, lastPayablesImport: null,
  }
  const bank = assessBankPosition([...banks], today)
  if (bank.state !== "conferido_sem_homologacao" || bank.openingCash === null ||
    !bank.commonDate || weeks.length !== 26 || months.length !== 12) return unavailable

  const startDay = timestamp(today)
  if (!Number.isFinite(startDay)) return unavailable
  if (weeks.some((w, i) => timestamp(w.inicio) !== startDay + i * 7 * 86400000 ||
    timestamp(w.fim) !== startDay + (i * 7 + 6) * 86400000)) return unavailable
  if (new Set(months.map(m => m.mes)).size !== 12) return unavailable
  if (months.some((m, i) => {
    const d = new Date(`${today.slice(0,7)}-01T12:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() + i)
    return m.mes !== d.toISOString().slice(0, 10)
  })) return unavailable

  const weeklyReceivables: number[] = []
  const weeklyPayables: number[] = []
  for (const w of weeks) {
    const receive = verifiedMoney(w.receber_identificado)
    const pay = verifiedMoney(w.pagar_identificado)
    if (receive === null || pay === null) return unavailable
    weeklyReceivables.push(receive)
    weeklyPayables.push(pay)
  }
  const monthlyReceivables: number[] = []
  const monthlyPayables: number[] = []
  for (const m of months) {
    const receive = verifiedMoney(m.receber_identificado)
    const pay = verifiedMoney(m.pagar_identificado)
    if (receive === null || pay === null) return unavailable
    monthlyReceivables.push(receive)
    monthlyPayables.push(pay)
  }
  const add = (values: number[]) => values.reduce((sum, value) => sum + value, 0)
  const receivables12 = add(monthlyReceivables)
  const payables12 = add(monthlyPayables)
  const age = Math.round((startDay - timestamp(bank.commonDate)) / 86400000)
  const messages = ["Prévia parcial: carteira atual + base bancária; sem vendas, folha, despesas e compras futuras."]
  if (age > 2) messages.push(`Saldo-base de ${bank.commonDate} (${age} dias antes da consulta).`)
  if (bank.reconciledAccounts < bank.accountCount) messages.push("Sem conciliação bancária homologada.")
  return {
    state: "parcial", base: bank.commonDate, warning: messages.join(" "),
    weeklyReceivables, weeklyPayables, monthlyReceivables, monthlyPayables,
    receivables13: add(weeklyReceivables.slice(0,13)), payables13: add(weeklyPayables.slice(0,13)),
    receivables12, payables12, net12: receivables12 - payables12,
    openingCash: bank.openingCash,
    lastPayablesImport: weeks[0]?.ultima_importacao_pagar ?? null,
  }
}
