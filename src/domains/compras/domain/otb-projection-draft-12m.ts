import type { CashForecastResult } from "./zacarini-cash-forecast"

export type Otb12mDraftMonth = {
  mes: string
  noventa: number
  plano: number
  historico: number
  pior: number
  reposicao: number
}
export type Otb12mDraftHeader = {
  id: number
  data_base: string
  competencia_inicio: string
  registrado_em: string
  hash_snapshot: string
  contas_escopo: number
  contas_conciliadas: number
  caixa_siscom_parcial: number | string | null
  observacao: string
  estado: "RASCUNHO_NAO_HOMOLOGADO"
}

function month(date: string, offset: number): string {
  const [year, m] = date.split("-").map(Number)
  return new Date(Date.UTC(year, m - 1 + offset, 1)).toISOString().slice(0, 10)
}
export function validateOtb12mDraftRows(
  rows: unknown, baseDate: string,
): rows is Otb12mDraftMonth[] {
  if (typeof baseDate !== "string" || !/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(baseDate)) return false
  const ms = new Date(baseDate + "T00:00:00Z")
  if (!Number.isFinite(ms.getTime()) || ms.toISOString().slice(0, 10) !== baseDate) return false
  if (!Array.isArray(rows) || rows.length !== 12) return false
  return rows.every((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false
    const row = entry as Record<string, unknown>
    const expectedKeys = ["mes", "noventa", "plano", "historico", "pior", "reposicao"]
    if (Object.keys(row).length !== expectedKeys.length ||
      !expectedKeys.every(key => Object.prototype.hasOwnProperty.call(row, key)) ||
      row.mes !== month(baseDate, index)) return false
    for (const key of expectedKeys.slice(1)) {
      const value = row[key]
      if (typeof value !== "number" || !Number.isFinite(value) ||
        Math.abs(value) > 1e12 || (key === "reposicao" && value < 0)) return false
    }
    return true
  })
}
/** Guarda SOMENTE as linhas financeiras projetadas pelo motor existente.
 * Não atribui nenhum valor de compra autorizado ou situação de homologação.
 */
export function buildOtb12mDraftRows(forecast: CashForecastResult): Otb12mDraftMonth[] | null {
  if (forecast.state !== "simulado" || forecast.monthLabels.length !== 12) return null
  const rows = forecast.monthLabels.map((mes, i) => ({
    mes,
    noventa: forecast.monthly.noventa[i],
    plano: forecast.monthly.plano[i],
    historico: forecast.monthly.historico[i],
    pior: forecast.monthlyWorst[i],
    reposicao: forecast.monthlyNewPurchases.noventa[i],
  }))
  const baseDate = forecast.monthLabels[0]?.slice(0, 7) + "-01"
  return validateOtb12mDraftRows(rows, baseDate) ? rows : null
}
