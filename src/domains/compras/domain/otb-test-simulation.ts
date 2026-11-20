/**
 * Bancada local de testes da OTB Zacarini 2.3.7.
 *
 * Não representa uma projeção homologada, não grava no Supabase e não pode
 * alimentar aprovação de pedidos. Os números de exemplo só existem aqui.
 */
import { calculateOtb, type OtbResult, type OtbSubgroupInput, type OtbTriple } from "./otb-calculation"
import type { OtbSubgroupPreview } from "./otb-subgroup-preview"

type TestInput = {
  baseDate: string
  preview?: OtbSubgroupPreview | null
  cashCaps: OtbTriple<number>
  mpNeeds: OtbTriple<number>
}

export type OtbTestSimulation = {
  origin: "previa_supabase" | "exemplo"
  /** Grupos incompletos ficam de fora explicitamente, jamais viram zeros silenciosos. */
  excludedGroups: number
  /** Curva A de exemplo somente quando a origem não traz a participação. */
  assumedCurveAGroups: number
  result: OtbResult
  authorizesPurchases: false
}

const nothing: OtbTriple<number> = [0, 0, 0]

const exampleSubgroups: readonly OtbSubgroupInput[] = [
  { line: "Linha 1", name: "Exemplo · Mineral", kind: "S", openingStock: 25_000, priorOrders: 0,
    forecastCost: [70_000, 80_000, 85_000], targetStock: [20_000, 22_000, 25_000],
    curveAShare: 0.7, alreadyRecorded: nothing, tiedSalesApproved: nothing },
  { line: "Linha 2", name: "Exemplo · Nutrição", kind: "S", openingStock: 15_000, priorOrders: 0,
    forecastCost: [50_000, 60_000, 62_000], targetStock: [16_000, 17_000, 18_000],
    curveAShare: 0.6, alreadyRecorded: nothing, tiedSalesApproved: nothing },
  { line: "Linha 3", name: "Exemplo · Produtos veterinários", kind: "S", openingStock: 10_000, priorOrders: 0,
    forecastCost: [35_000, 39_000, 43_000], targetStock: [11_000, 12_000, 13_000],
    curveAShare: 0.5, alreadyRecorded: nothing, tiedSalesApproved: nothing },
  { line: "Linha 4", name: "Exemplo · Acessórios", kind: "S", openingStock: 5_000, priorOrders: 0,
    forecastCost: [24_000, 26_000, 29_000], targetStock: [7_000, 8_000, 8_000],
    curveAShare: 0.4, alreadyRecorded: nothing, tiedSalesApproved: nothing },
  { line: "Linha 2", name: "Exemplo · Produção própria", kind: "P", openingStock: 3_000, priorOrders: 0,
    forecastCost: [2_000, 2_000, 2_000], targetStock: nothing,
    curveAShare: 0, alreadyRecorded: nothing, tiedSalesApproved: nothing },
]

function nextMonths(baseDate: string): OtbTriple<string> {
  const [year, month] = baseDate.split("-").map(Number)
  const at = (offset: number) => new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 10)
  return [at(1), at(2), at(3)]
}

export function buildOtbTestSimulation({ baseDate, preview, cashCaps, mpNeeds }: TestInput): OtbTestSimulation {
  const months = nextMonths(baseDate)
  const sameMonths = preview?.state === "calculado" && preview.months.every((month, i) => month === months[i])
  const usable = sameMonths ? preview.rows.filter(row =>
    row.months?.length === 3 && Number.isFinite(row.stockCost) &&
    row.months.every((month, i) => month.month === months[i] &&
      Number.isFinite(month.forecastCost) && month.forecastCost >= 0 &&
      Number.isFinite(month.targetStock) && month.targetStock >= 0),
  ) : []
  const origin = usable.length ? "previa_supabase" : "exemplo"
  const assumedCurveAGroups = usable.filter(row =>
    row.curveAShare === null || !Number.isFinite(row.curveAShare) || row.curveAShare < 0 || row.curveAShare > 1,
  ).length
  const subgroups: readonly OtbSubgroupInput[] = usable.length ? usable.map(row => ({
    line: `Linha ${row.line}`, name: row.name, kind: row.kind,
    openingStock: row.stockCost, priorOrders: 0,
    forecastCost: row.months!.map(month => month.forecastCost) as unknown as OtbTriple<number>,
    targetStock: row.months!.map(month => month.targetStock) as unknown as OtbTriple<number>,
    curveAShare: row.curveAShare !== null && Number.isFinite(row.curveAShare) && row.curveAShare >= 0 && row.curveAShare <= 1
      ? row.curveAShare : 0.5,
    alreadyRecorded: nothing, tiedSalesApproved: nothing,
  })) : exampleSubgroups

  const result = calculateOtb({
    source: origin === "exemplo" ? "Exemplo local — teste OTB 2.3.7" : "Prévia Supabase — teste OTB 2.3.7",
    baseDate, months, cashCaps, mpNeeds, buyerShare: 0.9, subgroups,
  })
  return { origin, result, excludedGroups: sameMonths ? preview.rows.length - usable.length : 0,
    assumedCurveAGroups, authorizesPurchases: false }
}
