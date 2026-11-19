/** Regras Liq_Base!K:O da Gestão Zacarini 2.3.7. Não homologa premissas nem libera compras. */
export type StockLiquidationInput = {
  stockQuantity: number | null
  stockCost: number | null
  last90dQuantity: number | null
  nextYear90dQuantity: number | null
  growthFactor: number | null
  referenceDays: number
  limitDays: number
  excluded?: boolean
}

export type StockClassification = "sem_giro" | "excesso" | "regular" | "excluido" | "sem_estoque" | "indisponivel"

/** ABCEstoque_DDE!E5:G10: os marcadores dependem da filial, nunca de vendas positivas do SKU. */
export const liquidationHistoryByBranch = {
  BDS: { comparable: true, basis: "ano_passado" },
  CG: { comparable: true, basis: "ano_passado" },
  PG: { comparable: true, basis: "ano_passado" },
  RIO: { comparable: true, basis: "ano_passado" },
  CX: { comparable: false, basis: "ano_passado" },
  AN: { comparable: false, basis: "ultimos_90d" },
} as const

export type LiquidationBranch = keyof typeof liquidationHistoryByBranch

/** Liq_Base!H:I,K — sazonal nas cinco lojas antigas; giro recente para Anastácio. */
export function calculateBranchForecast90d(
  branch: LiquidationBranch,
  last90d: number,
  nextYear90d: number,
  productOrGroupGrowth: number,
): number | null {
  if (![last90d, nextYear90d, productOrGroupGrowth].every(Number.isFinite) ||
      last90d < 0 || nextYear90d < 0) return null
  if (liquidationHistoryByBranch[branch].basis === "ultimos_90d") return last90d
  return Math.max(last90d, nextYear90d * Math.max(0, Math.min(4, productOrGroupGrowth)))
}

export function calculateStockLiquidation(input: StockLiquidationInput): {
  forecast90d: number | null
  daysOfStock: number | null
  classification: StockClassification
  frozenValue: number | null
} {
  const { stockQuantity: q, stockCost: v, last90dQuantity: sold, nextYear90dQuantity: next,
    growthFactor: growth, referenceDays: days, limitDays: limit } = input
  if ([q, v, sold, next, growth, days, limit].some(value => value === null || !Number.isFinite(value)) ||
    q! < 0 || v! < 0 || sold! < 0 || next! < 0 || days <= 0 || limit <= 0) {
    return { forecast90d: null, daysOfStock: null, classification: "indisponivel", frozenValue: null }
  }
  // Limites ABCEstoque_DDE B13:B14 = 0 a 4.
  const forecast90d = Math.max(Math.max(0, Math.min(4, growth!)) * next!, sold!)
  if (input.excluded) return { forecast90d, daysOfStock: null, classification: "excluido", frozenValue: 0 }
  if (q! <= 0 || v! <= 0) return { forecast90d, daysOfStock: null, classification: "sem_estoque", frozenValue: 0 }
  if (forecast90d <= 0) return { forecast90d, daysOfStock: null, classification: "sem_giro", frozenValue: v! }
  const daysOfStock = q! / (forecast90d / days)
  if (daysOfStock <= limit) return { forecast90d, daysOfStock, classification: "regular", frozenValue: 0 }
  // Liq_Base!O: MAX(0, valor - custo/quantidade * (projeção/dias) * limite)
  const frozenValue = Math.max(0, v! - (v! / q!) * (forecast90d / days) * limit)
  return { forecast90d, daysOfStock, classification: "excesso", frozenValue }
}

/** Produção Própria!D5: kg por unidade × custo de industrialização (R$/tonelada) ÷ 1000. */
export function calculateOwnProductionCost(weightKg: number | null, costPerTon: number | null): number | null {
  if (weightKg === null || costPerTon === null || !Number.isFinite(weightKg) || !Number.isFinite(costPerTon) || weightKg < 0 || costPerTon < 0) return null
  return weightKg * costPerTon / 1000
}
