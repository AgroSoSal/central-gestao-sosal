import type { OtbAbcProjection } from "./otb-abc-projection-237"
import type { PreviewStockSubgroup } from "./otb-subgroup-preview"

/**
 * A posição de estoque e o snapshot ABC são fontes independentes do Supabase.
 * Não converter ausência de correspondência em venda/CMV zero: só uma linha
 * REAL e explícita da ABC pode validar esses valores como zero.
 *
 * Quando houver subgrupos sem cobertura ABC, o motor de prévia usará o modo
 * proxy de CMV histórico, já identificado como não homologado.
 */
export function mergeOtbAbcStock238(
  stock: readonly PreviewStockSubgroup[],
  abc: OtbAbcProjection,
): { positions: PreviewStockSubgroup[]; missingAbc: string[] } {
  if (abc.state !== "conectado") return { positions: [...stock], missingAbc: [] }
  const key = (line: number, name: string) => `${line}\0${name}`
  const byGroup = new Map(abc.groups.map(group => [key(group.line, group.name), group] as const))
  const missingAbc: string[] = []
  const positions = stock.map(row => {
    const group = byGroup.get(key(row.line, row.subgroup))
    if (!group) {
      missingAbc.push(`Linha ${row.line} · ${row.subgroup}`)
      return { ...row }
    }
    return {
      ...row,
      projectedSales90d: group.projectedSales90,
      projectedCmv90d: group.projectedCmv90,
      curveASales90d: group.curveASales90,
    }
  })
  const stocked = new Set(stock.map(row => key(row.line, row.subgroup)))
  for (const group of abc.groups) {
    if (stocked.has(key(group.line, group.name))) continue
    positions.push({
      line: group.line, subgroup: group.name, stockCost: 0, cmv90d: 0,
      projectedSales90d: group.projectedSales90,
      projectedCmv90d: group.projectedCmv90,
      curveASales90d: group.curveASales90,
    })
  }
  return {positions,missingAbc}
}
