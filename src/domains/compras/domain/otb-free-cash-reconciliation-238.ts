import type { CashForecastResult, CashScenario } from "./zacarini-cash-forecast"

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
  returnedPaymentsByScenario: Record<CashScenario, number[]>
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
  const scenarios = ["noventa","plano","historico"] as const
  const scenarioBalance=forecast.monthly
  const scenarioPurchases=forecast.monthlyNewPurchasesByLine
  if (!Array.isArray(months) || months.length !== 12 ||
      months.some((m, i) => !/^20\\d{2}-(0[1-9]|1[0-2])-01$/.test(m) ||
        m !== monthAt(months[0], i)) ||
      !Array.isArray(forecast.monthlyWorst) || forecast.monthlyWorst.length !== 12 ||
      !scenarioBalance || !scenarioPurchases ||
      scenarios.some(s => !Array.isArray(scenarioBalance[s]) || scenarioBalance[s].length !== 12 ||
        !Array.isArray(scenarioPurchases[s]) || scenarioPurchases[s].length !== 12 ||
        scenarioPurchases[s].some(row => !Array.isArray(row) || row.length !== 4)) ||
      paymentDays.length !== 4 || paymentDays.some(n => !Number.isSafeInteger(n) || n < 0 || n > 365)) {
    throw new RangeError("Caixa OTB: série, cenários, reposição ou prazos de pagamento incompletos.")
  }
  finite(forecast.safetyFloor, "saldo mínimo")
  for (const [month, value] of forecast.monthlyWorst.entries()) finite(value, "pior caixa no mês " + month, true)
  for (const scenario of scenarios) {
    for (const [month, amount] of scenarioBalance[scenario].entries()) {
      finite(amount, scenario + " caixa no mês " + month, true)
    }
    for (const [month, row] of scenarioPurchases[scenario].entries()) {
      for (const [line, amount] of row.entries()) {
        finite(amount, scenario + " compra no mês " + month + " linha " + line)
      }
    }
  }

  const baseYear = Number(months[0].slice(0, 4))
  const baseMonth = Number(months[0].slice(5, 7))
  const returnedPaymentsByScenario={} as Record<CashScenario,number[]>
  for (const scenario of scenarios) {
    const refundAtDue = new Array<number>(12).fill(0)
    // OTB calcula os meses 1–3; não devolve compras do mês-base nem 4–12.
    for (let purchaseMonth = 1; purchaseMonth <= 3; purchaseMonth++) {
      const [year, month] = months[purchaseMonth].split("-").map(Number)
      const purchaseStart = Date.UTC(year, month - 1, 1)
      for (let line = 0; line < 4; line++) {
        const amount = scenarioPurchases[scenario][purchaseMonth][line]
        if (amount === 0) continue
        const due = new Date(purchaseStart + paymentDays[line] * DAY)
        const dueMonthIndex = (due.getUTCFullYear() - baseYear) * 12 +
          due.getUTCMonth() - (baseMonth - 1)
        if (dueMonthIndex < 0 || dueMonthIndex >= 12) continue
        refundAtDue[dueMonthIndex] += amount
      }
    }
    let accumulated = 0
    returnedPaymentsByScenario[scenario]=refundAtDue.map(amount=>{
      accumulated+=amount
      return accumulated
    })
  }
  // Zacarini Projeção 12M!C613:N613 = MIN(C607:C609,C807).
  // Corrigir cada cenário com as SUAS próprias compras já provisionadas,
  // depois aplicar o piso B7 em todos os candidatos (uma só vez).
  const freeCashForOtb=months.map((_,i)=>Math.min(
    ...scenarios.map(s=>scenarioBalance[s][i]+returnedPaymentsByScenario[s][i]-forecast.safetyFloor),
    forecast.monthlyWorst[i]+returnedPaymentsByScenario.noventa[i]-forecast.safetyFloor,
  ))
  if (freeCashForOtb.some(x=>!Number.isFinite(x))) {
    throw new RangeError("Caixa OTB: excesso numérico nos saldos livres.")
  }
  return {
    forecastMonths: [...months],
    freeCashForOtb,
    returnedPaymentsByMonth: returnedPaymentsByScenario.noventa,
    returnedPaymentsByScenario,
    returnedPaymentsTotal: returnedPaymentsByScenario.noventa[11],
    safetyFloor: forecast.safetyFloor,
    authorizesPurchases: false,
  }
}
