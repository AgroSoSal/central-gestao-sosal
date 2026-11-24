import type { CashForecastLedgerMonth238, CashForecastResult, CashScenario } from "./zacarini-cash-forecast"

export type CashLedgerScenario238 = CashScenario | "pior"

export type CashLedgerView238 = {
  scenario: CashLedgerScenario238
  months: readonly CashForecastLedgerMonth238[]
  totalRecebimentos: number
  totalSaidas: number
  saldoInicial: number
  saldoFinal: number
  minimo: number
}

export const CASH_LEDGER_SCENARIOS_238: readonly {
  id: CashLedgerScenario238
  label: string
}[] = [
  { id:"noventa",label:"90%" },
  { id:"plano",label:"Plano" },
  { id:"historico",label:"Histórico" },
  { id:"pior",label:"Pior caso" },
]

export function cashLedgerIncome238(row: CashForecastLedgerMonth238): number {
  return row.titulosReceber + row.recebimentosVendas + row.recuperacaoVencidos
}

export function cashLedgerOutflow238(row: CashForecastLedgerMonth238): number {
  return row.titulosPagar + row.despesas + row.impostos + row.pessoal +
    row.comprasNovasVencidas + row.extraSaudeNaoRecebido
}

/**
 * Verifica a identidade mensal saldo inicial + entradas - saídas = final.
 * É uma conferência de integridade interna da fórmula de projeção,
 * NÃO uma conciliação de banco nem aprovação do OTB.
 */
export function cashLedgerView238(
  forecast: CashForecastResult | null | undefined,
  scenario: CashLedgerScenario238,
): CashLedgerView238 | null {
  if (!forecast || forecast.state !== "simulado" || forecast.authorizesPurchases !== false) return null
  if (!CASH_LEDGER_SCENARIOS_238.some(s => s.id === scenario)) return null
  const months = scenario === "pior" ? forecast.worstLedger : forecast.monthlyLedger[scenario]
  const balances = scenario === "pior" ? forecast.monthlyWorst : forecast.monthly[scenario]
  if (!Array.isArray(months) || months.length !== 12 ||
    !Array.isArray(balances) || balances.length !== 12 ||
    forecast.monthLabels.length !== 12) return null

  let totalRecebimentos = 0
  let totalSaidas = 0
  for (let i = 0; i < 12; i++) {
    const row = months[i]
    if (!row || row.mes !== forecast.monthLabels[i] || !/^20\d{2}-(0[1-9]|1[0-2])-01$/.test(row.mes)) return null
    const values = [
      row.saldoInicial,row.titulosReceber,row.recebimentosVendas,row.recuperacaoVencidos,
      row.titulosPagar,row.despesas,row.impostos,row.pessoal,
      row.comprasNovasVencidas,row.extraSaudeNaoRecebido,row.saldoFinal,
    ]
    if (values.some(v => !Number.isFinite(v) || Math.abs(v) > 1e13)) return null
    if (values.slice(1,-1).some(v => v < -0.00001)) return null
    if (scenario !== "pior" && Math.abs(row.extraSaudeNaoRecebido) > 0.000001) return null
    if (Math.abs(row.saldoInicial + cashLedgerIncome238(row) - cashLedgerOutflow238(row) - row.saldoFinal) > 0.02) return null
    if (Math.abs(row.saldoFinal - balances[i]) > 0.02) return null
    if (i>0 && Math.abs(row.saldoInicial - months[i-1].saldoFinal) > 0.02) return null
    totalRecebimentos += cashLedgerIncome238(row)
    totalSaidas += cashLedgerOutflow238(row)
  }
  return {
    scenario,months,
    totalRecebimentos,totalSaidas,
    saldoInicial:months[0].saldoInicial,
    saldoFinal:months[11].saldoFinal,
    minimo:Math.min(...balances),
  }
}
