/** Indicador de disponibilidade de dados de pedidos, não uma OTB calculada. */
export type OtbPurchaseSourceStatus =
  | { status: "conectado"; lastImportedAt: string; itemCount: number }
  | { status: "indisponivel"; lastImportedAt: null; itemCount: null }

function nonNegativeInteger(value: unknown): number | null {
  if ((typeof value !== "number" && typeof value !== "string") || value === "") return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

/** Falha fechada: somente afirma conexão quando o resumo da RPC é íntegro. */
export function interpretOtbPurchaseSource(data: unknown, error: unknown): OtbPurchaseSourceStatus {
  const unavailable = {
    status: "indisponivel", lastImportedAt: null, itemCount: null,
  } as const
  if (error || !Array.isArray(data) || !data.length) return unavailable
  const first: unknown = data[0]
  if (!first || typeof first !== "object") return unavailable

  const summary = first as Record<string, unknown>
  const itemCount = nonNegativeInteger(summary.total_itens)
  const lastImportedAt = summary.ultima_importacao
  if (itemCount === null || typeof lastImportedAt !== "string"
    || Number.isNaN(new Date(lastImportedAt).getTime())) return unavailable

  return { status: "conectado", lastImportedAt, itemCount }
}
