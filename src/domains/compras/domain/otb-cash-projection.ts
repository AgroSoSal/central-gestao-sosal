/**
 * Trava de caixa do PIOR CASO da Gestão Zacarini 2.2.24.
 *
 * Entradas de origem:
 *   Projeção 12M!C613:N613  = fluxo livre do pior caso
 *   OTB!B11                 = colchão de caixa disponível
 *   Projeção 12M!B615:B626  = necessidades de 3 meses, por 4 grupos/prazo
 *   Projeção 12M!C630:N632  = vencimentos acumulados por mês da OTB
 * Resultado:
 *   Projeção 12M!B638:B640  = fatores de liberação priorizados
 *   Projeção 12M!B652:D652  = tetos de caixa mensais
 *
 * NÃO produz fluxo de caixa a partir de vendas médias. O chamador deve fornecer
 * os 12 meses do cenário real, já calculados com todas as premissas oficiais.
 */

export type OtbWorstCashInput = {
  source: string
  /** Primeiro mês da projeção, no formato YYYY-MM-01. */
  forecastStart: string
  cashBuffer: number
  worstFreeCash: readonly number[]
  monthlyNeeds: readonly number[]
  /** [mês 1, mês 2, mês 3] × [12 meses do horizonte] */
  cumulativeDues: readonly (readonly number[])[]
}

export type OtbWorstCashResult = {
  source: string
  forecastStart: string
  /** Projeção 12M!C612:N612 */
  cumulativeLimits: readonly number[]
  /** Projeção 12M!B638:B640 */
  factors: readonly [number, number, number]
  /** Projeção 12M!B652:D652 */
  cashCaps: readonly [number, number, number]
}

function finite(value: unknown, label: string, min = Number.NEGATIVE_INFINITY): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min) {
    throw new RangeError(`Projeção 12M: ${label} inválido ou ausente.`)
  }
}

function numbers(value: unknown, label: string, count: number, min = Number.NEGATIVE_INFINITY): asserts value is readonly number[] {
  if (!Array.isArray(value) || value.length !== count) {
    throw new RangeError(`Projeção 12M: ${label} precisa conter ${count} meses.`)
  }
  value.forEach((item, index) => finite(item, `${label} no mês ${index + 1}`, min))
}

function factor(available: readonly number[], priorDues: readonly (readonly number[])[],
  due: readonly number[], priorFactors: readonly number[]): number {
  let smallest = Number.POSITIVE_INFINITY
  for (let i = 0; i < 12; i++) {
    if (due[i] === 0) continue // Excel IF(vencimentos>0, razão, "")
    let remaining = available[i]
    for (let j = 0; j < priorDues.length; j++) {
      remaining -= priorDues[j][i] * priorFactors[j]
    }
    smallest = Math.min(smallest, remaining / due[i])
  }
  // Excel MIN(1,MAX(0,MIN(intervalo de razões)))
  return Number.isFinite(smallest) ? Math.min(1, Math.max(0, smallest)) : 0
}

export function calculateWorstCaseOtbCaps(input: OtbWorstCashInput): OtbWorstCashResult {
  if (!input || typeof input.source !== "string" || !input.source.trim()) {
    throw new RangeError("Projeção 12M: fonte de dados ausente.")
  }
  if (typeof input.forecastStart !== "string" || !/^\d{4}-\d{2}-01$/.test(input.forecastStart)
    || Number.isNaN(new Date(`${input.forecastStart}T00:00:00Z`).getTime())
    || new Date(`${input.forecastStart}T00:00:00Z`).toISOString().slice(0, 10) !== input.forecastStart) {
    throw new RangeError("Projeção 12M: mês inicial inválido.")
  }
  finite(input.cashBuffer, "colchão de caixa")
  numbers(input.worstFreeCash, "pior caixa", 12)
  numbers(input.monthlyNeeds, "necessidade", 3, 0)
  if (!Array.isArray(input.cumulativeDues) || input.cumulativeDues.length !== 3) {
    throw new RangeError("Projeção 12M: vencimentos de três meses ausentes.")
  }
  for (let month = 0; month < 3; month++) {
    const dues = input.cumulativeDues[month]
    numbers(dues, `vencimentos acumulados do mês ${month + 1}`, 12, 0)
    for (let i = 1; i < 12; i++) {
      if (dues[i] < dues[i - 1]) throw new RangeError("Projeção 12M: vencimentos acumulados não podem diminuir.")
    }
    if (input.monthlyNeeds[month] > 0 && dues.every((amount) => amount === 0)) {
      throw new RangeError(`Projeção 12M: vencimentos do mês ${month + 1} não foram projetados.`)
    }
  }

  // Linha 612: limite acumulado = mínimo caixa disponível em todos os meses
  // seguintes, inclusive o atual, mais o colchão permitido em OTB!B11.
  let futureMinimum = Number.POSITIVE_INFINITY
  const limits = new Array<number>(12)
  for (let index = 11; index >= 0; index--) {
    futureMinimum = Math.min(futureMinimum, input.worstFreeCash[index])
    limits[index] = Math.max(0, futureMinimum + input.cashBuffer)
  }

  const factors: number[] = []
  for (let month = 0; month < 3; month++) {
    factors.push(factor(limits, input.cumulativeDues.slice(0, month), input.cumulativeDues[month], factors))
  }
  const cashCaps = factors.map((ratio, index) => ratio * input.monthlyNeeds[index])
  return {
    source: input.source,
    forecastStart: input.forecastStart,
    cumulativeLimits: limits,
    factors: factors as [number, number, number],
    cashCaps: cashCaps as [number, number, number],
  }
}
