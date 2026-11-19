/** Paginação exclusivamente visual: os totais da fonte nunca dependem da página exibida. */
export function pageOtbPositions<T>(rows: readonly T[], requestedPage: number, pageSize = 50) {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new RangeError("Tamanho de página inválido")
  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(totalPages, Math.max(1, Number.isInteger(requestedPage) ? requestedPage : 1))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return { total, totalPages, page, from, to, items: rows.slice((page - 1) * pageSize, page * pageSize) }
}
