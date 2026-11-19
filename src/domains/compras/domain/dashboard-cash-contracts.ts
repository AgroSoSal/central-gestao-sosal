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
  weeks: number[]
  months: number[]
  minimum13: number | null
  end13: number | null
  minimum12: number | null
  end12: number | null
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
    weeks: [], months: [], minimum13: null, end13: null,
    minimum12: null, end12: null, openingCash: null, lastPayablesImport: null,
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

  const opening = bank.openingCash
  let sum = opening
  const ws: number[] = []
  for (const w of weeks) {
    const receive = verifiedMoney(w.receber_identificado)
    const pay = verifiedMoney(w.pagar_identificado)
    if (receive === null || pay === null) return unavailable
    sum += receive - pay
    ws.push(sum)
  }
  sum = opening
  const ms: number[] = []
  for (const m of months) {
    const receive = verifiedMoney(m.receber_identificado)
    const pay = verifiedMoney(m.pagar_identificado)
    if (receive === null || pay === null) return unavailable
    sum += receive - pay
    ms.push(sum)
  }
  const age = Math.round((startDay - timestamp(bank.commonDate)) / 86400000)
  const messages = ["Prévia parcial: carteira atual + base bancária; sem vendas, folha, despesas e compras futuras."]
  if (age > 2) messages.push(`Saldo-base de ${bank.commonDate} (${age} dias antes da consulta).`)
  if (bank.reconciledAccounts < bank.accountCount) messages.push("Sem conciliação bancária homologada.")
  return {
    state: "parcial", base: bank.commonDate, warning: messages.join(" "),
    weeks: ws, months: ms, minimum13: Math.min(...ws.slice(0,13)), end13: ws[12],
    minimum12: Math.min(...ms), end12: ms[11], openingCash: opening,
    lastPayablesImport: weeks[0]?.ultima_importacao_pagar ?? null,
  }
}
