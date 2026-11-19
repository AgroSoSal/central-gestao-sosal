import type { OtbHistoricalGroup, OtbLine } from "./otb-seasonal-weights"

/** Quatro trimestres móveis da aba fx_VendaSubgrupo (somente saída entregue). */
export type OtbSeasonalHistory =
  | { state: "indisponivel"; reason: string; groups: [] }
  | { state: "conectado"; month: string; windowMonths: readonly [string, string, string, string];
      groups: OtbHistoricalGroup[] }

const unavailable = (reason: string): OtbSeasonalHistory => ({ state: "indisponivel", reason, groups: [] })

function monthStart(value: string): boolean {
  return /^20\d\d-(0[1-9]|1[0-2])-01$/.test(value)
}
function offsetMonth(value: string, offset: number): string {
  const [year, month] = value.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 7)
}
function nonnegative(raw: unknown): number | null {
  if ((typeof raw !== "string" && typeof raw !== "number") || raw === "") return null
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 && value <= 1e15 ? value : null
}
function isOtbLine(value: unknown): value is OtbLine {
  return value === 1 || value === 2 || value === 3 || value === 4
}

/** Falhas de autenticação, de janela ou de paginação jamais viram vendas zeradas. */
export function interpretOtbSeasonalHistory(data: unknown, error: unknown, month: string): OtbSeasonalHistory {
  if (!monthStart(month)) return unavailable("Competência de referência inválida.")
  if (error || !Array.isArray(data) || !data.length) {
    return unavailable("Quatro janelas sazonais não disponíveis na consulta Master do Supabase.")
  }
  const groups: OtbHistoricalGroup[] = []
  const seen = new Set<string>()
  for (const raw of data) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return unavailable("Linha sazonal inválida.")
    const row = raw as Record<string, unknown>
    const line = row.linha
    const name = row.grupo_subgrupo
    if (!isOtbLine(line) || typeof name !== "string" || !name.trim() || name.length > 250 ||
      row.meses_linha !== 6) return unavailable("Histórico de uma linha incompleto ou sem identificação.")
    const key = `${line}\0${name}`
    if (seen.has(key)) return unavailable("Histórico sazonal repetido; consolidação não confiável.")
    seen.add(key)
    const sales = [1, 2, 3, 4].map(i => nonnegative(row[`venda_janela_${i}`]))
    if (sales.some(v => v === null)) return unavailable("Vendas sazonais ausentes ou inválidas.")
    groups.push({ line, name, sales: sales as [number, number, number, number] })
  }
  return {
    state: "conectado", month,
    windowMonths: ([0, 1, 2, 3].map(i =>
      `${offsetMonth(month, -12 + i)} a ${offsetMonth(month, -10 + i)}`)) as [string, string, string, string],
    groups,
  }
}
