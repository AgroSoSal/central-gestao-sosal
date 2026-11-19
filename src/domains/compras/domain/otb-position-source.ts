/** Foto operacional: estoque a custo e CMV de saídas dos últimos 90 dias.
 * Não é previsão de vendas, DDE-alvo, orçamento nem liberação financeira. */
export type OtbStockPosition =
  | {
    status: "conectado"
    snapshotAt: string
    stockCost: number
    cmv90d: number | null
    stockSkus: number
    subgroups: {
      line: number
      subgroup: string
      stockCost: number
      cmv90d: number | null
      skuCount: number
      observedDde: number | null
    }[]
  }
  | {
    status: "indisponivel"
    snapshotAt: null
    stockCost: null
    cmv90d: null
    stockSkus: null
    subgroups: []
  }

const unavailable: OtbStockPosition = {
  status: "indisponivel", snapshotAt: null, stockCost: null, cmv90d: null,
  stockSkus: null, subgroups: [],
}

function decimal(raw: unknown): number | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null
  if (typeof raw === "string" && raw.trim() === "") return null
  const result = Number(raw)
  return Number.isFinite(result) && Math.abs(result) <= 1e15 ? result : null
}

/** Parser fail-closed para evitar totais parciais quando uma RPC falha. */
export function interpretOtbStockPosition(data: unknown, error: unknown): OtbStockPosition {
  if (error || !Array.isArray(data) || !data.length) return unavailable

  const seen = new Set<string>()
  const subgroups: Extract<OtbStockPosition, { status: "conectado" }>["subgroups"] = []
  let stockCost = 0
  let cmv90d = 0
  let stockSkus = 0
  let incompleteCmv = false
  let snapshotAt = ""

  for (const raw of data) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return unavailable
    const r = raw as Record<string, unknown>
    const line = r.linha
    const subgroup = r.grupo_subgrupo
    const stock = decimal(r.estoque_custo)
    const cost = r.cmv_90d === null ? null : decimal(r.cmv_90d)
    const count = decimal(r.sku_count)
    const date = r.ultima_atualizacao
    if (typeof line !== "number" || !Number.isInteger(line) || line < -1 || line > 4
      || typeof subgroup !== "string" || subgroup.length > 250
      || stock === null || count === null || !Number.isSafeInteger(count) || count < 0
      || (cost === null && r.cmv_90d !== null)
      || typeof date !== "string" || !Number.isFinite(new Date(date).getTime())) return unavailable

    const key = `${line}\0${subgroup}`
    if (seen.has(key)) return unavailable
    seen.add(key)
    if (snapshotAt && snapshotAt !== date) return unavailable
    snapshotAt = date
    stockCost += stock
    stockSkus += count
    if (cost === null) incompleteCmv = true
    else cmv90d += cost
    subgroups.push({
      // O SISCOM registra saídas do código 0 com grupo_subgrupo vazio.
      // Identificar a origem sem ocultar seus valores nem invalidar toda a foto.
      line, subgroup: subgroup.trim() || "SEM SUBGRUPO", stockCost: stock, cmv90d: cost, skuCount: count,
      observedDde: cost !== null && cost > 0 ? (stock / cost) * 90 : null,
    })
  }

  if (!Number.isFinite(stockCost) || !Number.isFinite(cmv90d) || !Number.isSafeInteger(stockSkus)) return unavailable
  return { status: "conectado", snapshotAt, stockCost, cmv90d: incompleteCmv ? null : cmv90d, stockSkus, subgroups }
}
