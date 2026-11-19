import { dashboardReference, type DashboardReferenceRow } from "./dashboard-zacarini-237"

/** Metas do mês comercial: Jan até a competência selecionada, como 'Metas de Vendas'!B14.
 * Exige cada competência e cada dimensão, não estima os meses faltantes.
 */
export function accumulatedSalesTarget(
  rows: readonly DashboardReferenceRow[], codes: readonly string[], month: string,
): number | null {
  if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(month) || codes.length === 0 || new Set(codes).size !== codes.length) return null
  const [year, monthNumber] = month.split("-").map(Number)
  let total = 0
  for (let m=1; m<=monthNumber; m++) {
    const competence = `${year}-${String(m).padStart(2,"0")}-01`
    for (const code of codes) {
      const value = dashboardReference(rows,code,competence).valor
      if (value === null || value < 0) return null
      total += value
    }
  }
  return Number.isFinite(total) ? total : null
}

/** DRE 2026/27 projetada: acumulados de receitas/custos somam mês a mês;
 * margens acumuladas sempre recalculadas por lucro acumulado / receita acumulada.
 */
export function accumulatedBudgetValue(
  rows: readonly DashboardReferenceRow[], code: string, month: string,
): number | null {
  if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(month) || !/^dre_[a-z_]+$/.test(code)) return null
  if (code === "dre_margem_bruta" || code === "dre_margem_ebitda") {
    const numerator = accumulatedBudgetValue(rows,
      code === "dre_margem_bruta" ? "dre_lucro_bruto" : "dre_ebitda",month)
    const revenue = accumulatedBudgetValue(rows,"dre_receita_bruta",month)
    return numerator === null || revenue === null || revenue === 0 ? null : numerator/revenue
  }
  const [year, monthNumber] = month.split("-").map(Number)
  let result = 0
  for (let m=1;m<=monthNumber;m++) {
    const competence = `${year}-${String(m).padStart(2,"0")}-01`
    const budget = dashboardReference(rows,code,competence).valor
    if (budget === null) return null
    result += budget
  }
  return Number.isFinite(result) ? result : null
}

export type DdePlanRow = {
  grupo_subgrupo: string
  dde_meta: number | string | null
  cmv_90d: number | string | null
  valor_estoque: number | string | null
}
export type DdePlanCoverage = {
  covered: number
  valid: number
  targetDde: number | null
  observedDde: number | null
}

const numeric = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** DDE ponderado por CMV diário apenas nos subgrupos com plano individualizado.
 * Não o confundir com o DDE de toda a linha de negócio.
 */
export function summarizeDdePlanCoverage(rows: readonly DdePlanRow[]): Record<number,DdePlanCoverage> {
  const intermediate = new Map<number,{covered:number,valid:number,stock:number,targetStock:number,cmv:number}>()
  for (const row of rows) {
    const match = /^([1-4])\./.exec(row.grupo_subgrupo)
    if (!match) continue
    const line = Number(match[1])
    const acc = intermediate.get(line) ?? {covered:0,valid:0,stock:0,targetStock:0,cmv:0}
    acc.covered++
    const cost = numeric(row.cmv_90d)
    const currentStock = numeric(row.valor_estoque)
    const days = numeric(row.dde_meta)
    if (cost !== null && cost > 0 && currentStock !== null && currentStock >= 0 && days !== null && days >= 0) {
      acc.valid++
      acc.cmv += cost
      acc.stock += currentStock
      acc.targetStock += cost * days / 90
    }
    intermediate.set(line,acc)
  }
  const result: Record<number,DdePlanCoverage> = {}
  for (let line=1; line<=4;line++) {
    const item = intermediate.get(line)
    result[line] = item && item.cmv>0
      ? {covered:item.covered,valid:item.valid,targetDde:item.targetStock*90/item.cmv,
        observedDde:item.stock*90/item.cmv}
      : {covered:item?.covered ?? 0,valid:item?.valid ?? 0,targetDde:null,observedDde:null}
  }
  return result
}
