/** Resumo auditável de uma RPC agregada; não representa caixa ou orçamento OTB. */
export type OtbHistoricalSourceStatus =
  | {
    status: "conectado"
    firstMonth: string
    lastMonth: string
    monthCount: number
    totalRecords: number
    unmappedRecords: number
    excludedRecords: number
    completeLast12Months: boolean
  }
  | {
    status: "indisponivel"
    firstMonth: null
    lastMonth: null
    monthCount: null
    totalRecords: null
    unmappedRecords: null
    excludedRecords: null
    completeLast12Months: false
  }

const unavailable: OtbHistoricalSourceStatus = {
  status: "indisponivel",
  firstMonth: null,
  lastMonth: null,
  monthCount: null,
  totalRecords: null,
  unmappedRecords: null,
  excludedRecords: null,
  completeLast12Months: false,
}

function validMonth(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function numeric(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null
  if (value === "" || (typeof value === "string" && !value.trim())) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function monthShift(isoMonth: string, offset: number): string {
  const [year, month] = isoMonth.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 10)
}

/** A filial Só Sal usa o calendário civil de Campo Grande, inclusive na virada do ano. */
export function lastClosedMonthInCampoGrande(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "2-digit", timeZone: "America/Campo_Grande",
  }).formatToParts(now)
  const year = Number(parts.find((part) => part.type === "year")?.value)
  const month = Number(parts.find((part) => part.type === "month")?.value)
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 10)
}

/**
 * Retorno somente é considerado completo para análise histórica se existem
 * 12 meses FECHADOS, cada qual com registros de 'vendido' e 'saida', sem linha 0.
 * A cobertura histórica, sozinha, NÃO autoriza calcular a Projeção 12M.
 */
export function interpretOtbHistoricalSource(
  data: unknown, error: unknown, expectedLastClosedMonth: string,
): OtbHistoricalSourceStatus {
  if (error || !Array.isArray(data) || !data.length || !validMonth(expectedLastClosedMonth)) return unavailable

  const months = new Set<string>()
  const pairs = new Map<string, Set<string>>()
  const usedKeys = new Set<string>()
  const firstMonthOfLookback = monthShift(expectedLastClosedMonth, -11)
  let unmappedRecords = 0
  let unmappedInLookback = 0
  let excludedRecords = 0
  let totalRecords = 0

  for (const raw of data) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return unavailable
    const row = raw as Record<string, unknown>
    const { mes, visao, linha } = row
    const count = numeric(row.registros)
    const sale = numeric(row.venda_bruta)
    const cost = numeric(row.cmv)
    const profit = numeric(row.lucro)
    if (!validMonth(mes) || (visao !== "vendido" && visao !== "saida")
      || typeof linha !== "number" || !Number.isInteger(linha) || linha < -1 || linha > 4
      || count === null || !Number.isSafeInteger(count) || count < 1
      || sale === null || cost === null || profit === null) return unavailable
    const key = `${mes}|${visao}|${linha}`
    if (usedKeys.has(key)) return unavailable
    usedKeys.add(key)

    totalRecords += count
    if (linha === -1) {
      // Código classificado expressamente como N/fora OTB: mantém rastreabilidade,
      // mas não participa da cobertura comercial nem da pendência de linha zero.
      excludedRecords += count
      continue
    }
    months.add(mes)
    if (!pairs.has(mes)) pairs.set(mes, new Set())
    pairs.get(mes)!.add(visao)
    if (linha === 0) {
      unmappedRecords += count
      if (mes >= firstMonthOfLookback && mes <= expectedLastClosedMonth) unmappedInLookback += count
    }
  }

  const sortedMonths = [...months].sort()
  if (!sortedMonths.length) return unavailable
  let completeLast12Months = unmappedInLookback === 0
  for (let index = 0; index < 12; index++) {
    const month = monthShift(expectedLastClosedMonth, -index)
    if (!pairs.get(month)?.has("saida") || !pairs.get(month)?.has("vendido")) {
      completeLast12Months = false
      break
    }
  }

  return {
    status: "conectado",
    firstMonth: sortedMonths[0],
    lastMonth: sortedMonths[sortedMonths.length - 1],
    monthCount: months.size,
    totalRecords,
    unmappedRecords,
    excludedRecords,
    completeLast12Months,
  }
}
