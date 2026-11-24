/**
 * OTB de três meses conforme Gestão Zacarini 2.3.7 (aba OTB).
 *
 * Os valores de entrada são calculados pelas fontes de estoque, vendas sazonais
 * e Projeção 12M. Este serviço NÃO inventa essas fontes, nem grava compras.
 * Fórmulas de referência: OTB!S:AO, AV:AX, B21:D31 e O26:W30.
 */

export type OtbTriple<T> = readonly [T, T, T]
export type OtbKind = "S" | "P" | "M" | "N"

export type OtbSubgroupInput = {
  line: string
  name: string
  kind: OtbKind
  /** Estoque a custo na data-base (OTB!I). Pode ser negativo se a origem for negativa. */
  openingStock: number
  /** Pedidos anteriores ainda a receber e elegíveis (OTB!J). */
  priorOrders: number
  /** CMV previsto por mês (OTB!Q/Z/AI). */
  forecastCost: OtbTriple<number>
  /** DDE-alvo × custo médio diário futuro (OTB!K, BR×AS, BS×AT). */
  targetStock: OtbTriple<number>
  /** Participação de curva A no subgrupo (OTB!H). */
  curveAShare: number
  /** Pedidos gravados no mês, excluindo Segurar/Cancelar (OTB!V/AE/AN). */
  alreadyRecorded: OtbTriple<number>
  /** Venda casada aprovada manualmente (OTB!U/AD/AM). */
  tiedSalesApproved: OtbTriple<number>
  /** Excesso específico conferido na origem; se omitido, aplica AV/AW/AX. */
  excess?: OtbTriple<number>
}

export type OtbInput = {
  source: string
  baseDate: string
  months: OtbTriple<string>
  /** Teto de pior caso da Projeção 12M, NÃO limite semanal (OTB!B21:D21). */
  cashCaps: OtbTriple<number>
  /** Necessidades mensais da matéria-prima agregada (OTB!S/AB/AK173). */
  mpNeeds: OtbTriple<number>
  /** Pedidos de MP já gravados, OTB!V/AE/AN173. */
  mpRecorded?: OtbTriple<number>
  /** Venda casada manual de MP, OTB!U/AD/AM173. */
  mpTiedSales?: OtbTriple<number>
  buyerShare: number
  subgroups: readonly OtbSubgroupInput[]
}

export type OtbSubgroupMonth = {
  line: string
  name: string
  kind: OtbKind
  curveAShare: number
  openingStock: number
  forecastCost: number
  targetStock: number
  need: number
  released: number
  recorded: number
  excess: number
  tiedSales: number
  /** Saldo do subgrupo OTB!W/AF/AO: sem desconto por excesso, feito na linha. */
  freeBalance: number
  closingStock: number
  status: "LIBERADO" | "SÓ CURVA A" | "TRAVADO" | "ACIMA DO ALVO" | "ESTOUROU" | "PRODUÇÃO PRÓPRIA" | "MATÉRIA-PRIMA" | "FORA DA OTB"
}

export type OtbLineMonth = {
  line: string
  released: number
  buyerBudget: number
  directorReserve: number
  recorded: number
  excess: number
  tiedSales: number
  /** Saldo gerencial da linha: deduz excesso apurado nos seus subgrupos. */
  freeBalance: number
}

export type OtbMonth = {
  month: string
  cashCap: number
  mpNeed: number
  mpReleased: number
  mpRecorded: number
  mpTiedSales: number
  mpFreeBalance: number
  needMerchandise: number
  curveANeedMerchandise: number
  totalNeed: number
  releasedMerchandise: number
  releasedTotal: number
  buyerBudget: number
  directorReserve: number
  recorded: number
  excess: number
  /** Saldo de mercadorias; MP não é conciliada com pedidos neste contrato. */
  freeBalance: number
  cashStatus: "SEM NECESSIDADE" | "LIBERADO" | "SÓ CURVA A + PARTE" | "TRAVADO"
  subgroups: OtbSubgroupMonth[]
  lines: OtbLineMonth[]
}

export type OtbResult = { source: string; baseDate: string; months: OtbTriple<OtbMonth> }

function requireNumber(value: unknown, label: string, min?: number, max?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || (min !== undefined && value < min) || (max !== undefined && value > max)) {
    throw new RangeError(`OTB: ${label} inválido ou ausente.`)
  }
  return value
}

function requireTriple(value: unknown, label: string, min?: number): asserts value is OtbTriple<number> {
  if (!Array.isArray(value) || value.length !== 3) throw new RangeError(`OTB: ${label} deve ter três meses.`)
  value.forEach((item, index) => requireNumber(item, `${label} no mês ${index + 1}`, min))
}

function checkMonths(months: unknown): asserts months is OtbTriple<string> {
  if (!Array.isArray(months) || months.length !== 3) throw new RangeError("OTB: meses devem conter três datas.")
  for (let index = 0; index < 3; index++) {
    const value = months[index]
    if (typeof value !== "string" || !/^\d{4}-\d{2}-01$/.test(value)) throw new RangeError("OTB: meses inválidos.")
    const date = new Date(`${value}T00:00:00Z`)
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new RangeError("OTB: meses inválidos.")
    if (index > 0) {
      const prev = new Date(`${months[index - 1]}T00:00:00Z`)
      prev.setUTCMonth(prev.getUTCMonth() + 1)
      if (prev.toISOString().slice(0, 10) !== value) throw new RangeError("OTB: meses devem ser consecutivos.")
    }
  }
}

function boundedRatio(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.max(0, Math.min(1, numerator / denominator)) : 0
}

/** Reproduz o motor de alocação da aba OTB, sem recálculos de input ausente. */
export function calculateOtb(input: OtbInput): OtbResult {
  if (!input || !input.source?.trim()) throw new RangeError("OTB: fonte de dados não identificada.")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.baseDate)
    || Number.isNaN(new Date(`${input.baseDate}T00:00:00Z`).getTime())
    || new Date(`${input.baseDate}T00:00:00Z`).toISOString().slice(0, 10) !== input.baseDate) {
    throw new RangeError("OTB: data-base inválida.")
  }
  checkMonths(input.months)
  requireTriple(input.cashCaps, "teto de caixa", 0)
  requireTriple(input.mpNeeds, "necessidade de matéria-prima", 0)
  if(input.mpRecorded!==undefined) requireTriple(input.mpRecorded, "MP já gravada", 0)
  if(input.mpTiedSales!==undefined) requireTriple(input.mpTiedSales, "MP venda casada aprovada", 0)
  requireNumber(input.buyerShare, "parcela do comprador", 0, 1)
  if (Math.abs(input.buyerShare - 0.9) > 1e-9) throw new RangeError("OTB: regra de OTB!R24 (90% comprador / 10% diretoria) violada.")
  if (!Array.isArray(input.subgroups)) throw new RangeError("OTB: subgrupos não disponíveis.")

  const seen = new Set<string>()
  for (const item of input.subgroups) {
    if (!item.line?.trim() || !item.name?.trim() || !["S", "P", "M", "N"].includes(item.kind)) {
      throw new RangeError("OTB: classificação, linha ou subgrupo ausente.")
    }
    const key = `${item.line}\0${item.name}`
    if (seen.has(key)) throw new RangeError(`OTB: subgrupo duplicado: ${item.name}`)
    seen.add(key)
    requireNumber(item.openingStock, `${item.name}: estoque`)
    requireNumber(item.priorOrders, `${item.name}: pedidos anteriores`)
    requireNumber(item.curveAShare, `${item.name}: participação curva A`, 0, 1)
    requireTriple(item.forecastCost, `${item.name}: CMV previsto`, 0)
    requireTriple(item.targetStock, `${item.name}: estoque-alvo`, 0)
    requireTriple(item.alreadyRecorded, `${item.name}: pedidos gravados`, 0)
    requireTriple(item.tiedSalesApproved, `${item.name}: venda casada aprovada`, 0)
    if (item.excess !== undefined) requireTriple(item.excess, `${item.name}: excesso`, 0)
  }

  let opening = input.subgroups.map((s) => s.openingStock + s.priorOrders)
  const output: OtbMonth[] = []

  for (let monthIndex = 0; monthIndex < 3; monthIndex++) {
    const itemNeeds = input.subgroups.map((s, i) => s.kind === "S"
      ? Math.max(0, s.forecastCost[monthIndex] + s.targetStock[monthIndex] - opening[i])
      : 0)
    const mpNeed = input.mpNeeds[monthIndex]
    const cashCap = input.cashCaps[monthIndex]
    const mpReleased = Math.min(mpNeed, cashCap)
    const mpRecorded = input.mpRecorded?.[monthIndex]??0
    const mpTiedSales = input.mpTiedSales?.[monthIndex]??0
    const mpFreeBalance = mpReleased + mpTiedSales - mpRecorded
    const remainingForMerchandise = Math.max(0, cashCap - mpReleased)

    const needMerchandise = itemNeeds.reduce((sum, value) => sum + value, 0)
    const curveANeedMerchandise = itemNeeds.reduce((sum, value, i) => sum + value * input.subgroups[i].curveAShare, 0)
    const nonANeed = Math.max(0, needMerchandise - curveANeedMerchandise)
    const fractionA = boundedRatio(remainingForMerchandise, curveANeedMerchandise)
    const fractionOther = boundedRatio(remainingForMerchandise - curveANeedMerchandise, nonANeed)

    const rows: OtbSubgroupMonth[] = input.subgroups.map((s, i) => {
      const need = itemNeeds[i]
      const released = s.kind === "S"
        ? need * s.curveAShare * fractionA + need * (1 - s.curveAShare) * fractionOther
        : 0
      const excess = s.excess?.[monthIndex] ?? (s.kind === "S"
        ? Math.max(0, opening[i] - s.forecastCost[monthIndex] - s.targetStock[monthIndex])
        : 0)
      const recorded = s.alreadyRecorded[monthIndex]
      const tiedSales = s.tiedSalesApproved[monthIndex]
      const freeBalance = released + tiedSales - recorded
      const closingStock = Math.max(0, opening[i] + released - s.forecastCost[monthIndex])
      const status: OtbSubgroupMonth["status"] = recorded > released + tiedSales + 1 ? "ESTOUROU"
        : s.kind === "P" ? "PRODUÇÃO PRÓPRIA"
        : s.kind === "M" ? "MATÉRIA-PRIMA"
        : s.kind === "N" ? "FORA DA OTB"
        : need < 1 ? "ACIMA DO ALVO"
        : released >= need - 1 ? "LIBERADO"
        : released >= need * s.curveAShare - 1 ? "SÓ CURVA A"
        : "TRAVADO"
      return {
        line: s.line, name: s.name, kind: s.kind, curveAShare: s.curveAShare,
        openingStock: opening[i], forecastCost: s.forecastCost[monthIndex],
        targetStock: s.targetStock[monthIndex], need, released, recorded,
        excess, tiedSales, freeBalance, closingStock, status,
      }
    })

    const releasedMerchandise = rows.reduce((sum, row) => sum + row.released, 0)
    const releasedTotal = mpReleased + releasedMerchandise
    const lineMap = new Map<string, OtbLineMonth>()
    for (const row of rows) {
      if (row.kind !== "S") continue
      const line = lineMap.get(row.line) ?? {
        line: row.line, released: 0, buyerBudget: 0, directorReserve: 0,
        recorded: 0, excess: 0, tiedSales: 0, freeBalance: 0,
      }
      line.released += row.released
      line.recorded += row.recorded
      line.excess += row.excess
      line.tiedSales += row.tiedSales
      line.freeBalance += row.freeBalance - row.excess
      lineMap.set(row.line, line)
    }
    const lines = [...lineMap.values()].map((line) => ({
      ...line,
      buyerBudget: line.released * input.buyerShare,
      directorReserve: line.released * (1 - input.buyerShare),
    }))
    const totalNeed = needMerchandise + mpNeed
    const cashStatus: OtbMonth["cashStatus"] = Math.round(totalNeed * 100) === 0 ? "SEM NECESSIDADE"
      : Math.round(cashCap * 100) >= Math.round(totalNeed * 100) ? "LIBERADO"
      : Math.round(cashCap * 100) >= Math.round((mpNeed + curveANeedMerchandise) * 100) ? "SÓ CURVA A + PARTE"
      : "TRAVADO"

    output.push({
      month: input.months[monthIndex], cashCap, mpNeed, mpReleased,
      mpRecorded, mpTiedSales, mpFreeBalance,
      needMerchandise, curveANeedMerchandise, totalNeed,
      releasedMerchandise, releasedTotal,
      buyerBudget: releasedTotal * input.buyerShare,
      directorReserve: releasedTotal * (1 - input.buyerShare),
      recorded: rows.reduce((sum, row) => sum + row.recorded, 0),
      excess: rows.reduce((sum, row) => sum + row.excess, 0),
      freeBalance: lines.reduce((sum, line) => sum + line.freeBalance, 0),
      cashStatus, subgroups: rows, lines,
    })
    opening = rows.map((row) => row.closingStock)
  }

  return { source: input.source, baseDate: input.baseDate, months: output as unknown as OtbTriple<OtbMonth> }
}
