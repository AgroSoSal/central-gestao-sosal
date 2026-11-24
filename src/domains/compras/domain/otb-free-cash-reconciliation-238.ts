import type { CashForecastResult } from "./zacarini-cash-forecast"

/**
 * Projeção 12M da Zacarini 2.3.8:
 *   C607:C609 = saldo por cenário + compras do modelo já pagas - B7 (caixa mínimo)
 *   C613:N613 = pior caixa livre
 *   C612:N612 = limite de compras novas, acrescido apenas de OTB!B11 (extra diretor).
 *
 * O simulador do Supabase já DESCONTA a reposição planejada no fluxo diário.
 * Para calcular novamente a OTB dos três meses seguintes, devolvemos SOMENTE
 * os pagamentos dessa reposição já provisionados e subtraímos o mínimo B7.
 * Isso impede dupla contagem e preserva a disponibilidade real do caixa.
 *
 * Não converte referência financeira em saldo bancário conciliado.
 */
export type OtbFreeCash238 = {
  forecastMonths: readonly string[]
  freeCashForOtb: number[]
  returnedPaymentsByMonth: number[]
  safetyFloor: number
  returnedPaymentsTotal: number
  authorizesPurchases: false
}

const DAY = 86400000
function monthAt(start: string, offset: number): string {
  const [y, m] = start.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1 + offset, 1)).toISOString().slice(0, 10)
}
function finite(n: unknown, label: string, allowNegative = false): asserts n is number {
  if (typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 1e12 ||
      (!allowNegative && n < 0)) throw new RangeError("Caixa OTB: " + label + " inválido.")
}
export function calculateFreeCashForOtb238(
  forecast: CashForecastResult,
  paymentDays: readonly number[],
): OtbFreeCash238 {
  if (forecast.state !== "simulado") throw new RangeError("Caixa OTB: projeção 12M indisponível.")
  const months = forecast.monthLabels
  const purchases = forecast.monthlyNewPurchasesByLine?.noventa
  if (!Array.isArray(months) || months.length !== 12 ||
      months.some((m, i) => !/^20\d{2}-(0[1-9]|1[0-2])-01$/.test(m) ||
        m !== monthAt(months[0], i)) ||
      !Array.isArray(forecast.monthlyWorst) || forecast.monthlyWorst.length !== 12 ||
      !Array.isArray(purchases) || purchases.length !== 12 ||
      purchases.some(row => !Array.isArray(row) || row.length !== 4) ||
      paymentDays.length !== 4 || paymentDays.some(n => !Number.isSafeInteger(n) || n < 0 || n > 365)) {
    throw new RangeError("Caixa OTB: série, reposição ou prazos de pagamento incompletos.")
  }
  finite(forecast.safetyFloor, "saldo mínimo")
  for (const [month, value] of forecast.monthlyWorst.entries()) finite(value, "caixa do mês " + month, true)
  for (const [month, row] of purchases.entries()) {
    for (const [line, value] of row.entries()) finite(value, "compra no mês " + month + " linha " + line)
  }

  // Replicar o instante exato em que o simulador descontou a reposição:
  // compras dos meses futuros começam no dia 1 e vencem em dia 1 + prazo.
  // Não devolvemos compras do mês corrente, nem de meses 4..12.
  const refunds = new Array<number>(12).fill(0)
  const baseYear = Number(months[0].slice(0, 4))
  const baseMonth = Number(months[0].slice(5, 7))
  for (let purchaseMonth = 1; purchaseMonth <= 3; purchaseMonth++) {
    const [year, month] = months[purchaseMonth].split("-").map(Number)
    const purchaseStart = Date.UTC(year, month - 1, 1)
    for (let line = 0; line < 4; line++) {
      const amount = purchases[purchaseMonth][line]
      if (amount === 0) continue
      const due = new Date(purchaseStart + paymentDays[line] * DAY)
      const dueMonthIndex = (due.getUTCFullYear() - baseYear) * 12 +
        due.getUTCMonth() - (baseMonth - 1)
      if (dueMonthIndex < 0 || dueMonthIndex >= 12) continue
      refunds[dueMonthIndex] += amount
    }
  }
  let cumulative = 0
  const returnedPaymentsByMonth = refunds.map(amount => {
    cumulative += amount
    return cumulative
  })
  const freeCashForOtb = forecast.monthlyWorst.map((cash, index) =>
    cash + returnedPaymentsByMonth[index] - forecast.safetyFloor)
  if (freeCashForOtb.some(x => !Number.isFinite(x))) {
    throw new RangeError("Caixa OTB: excesso numérico nos saldos livres.")
  }
  return {
    forecastMonths: [...months],
    freeCashForOtb,
    returnedPaymentsByMonth,
    returnedPaymentsTotal: cumulative,
    safetyFloor: forecast.safetyFloor,
    authorizesPurchases: false,
  }
}
