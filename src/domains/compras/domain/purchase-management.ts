import type { PurchaseDecision } from "./purchase-decisions"

export type ManagementItem = {
  quantidade_pendente: number | string | null
  situacao_recebimento: string | null
}

export function requiresPurchaseManagement(item: ManagementItem, decision: PurchaseDecision | null | undefined): boolean {
  if (decision === "Segurar" || decision === "Cancelar") return true
  if (item.quantidade_pendente === null) return false

  const pending = Number(item.quantidade_pendente)
  if (!Number.isFinite(pending)) return false
  return pending > 0 || item.situacao_recebimento === "Em aberto" || item.situacao_recebimento === "Chegada parcial"
}

/** Preserva o contexto da pesquisa ao trocar entre consulta e gestão. */
export function purchaseFilteredHref(path: "/compras" | "/compras/gerenciar", filters: {
  busca: string; loja: string; inicio: string; fim: string
}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value)
  }
  return params.size ? `${path}?${params.toString()}` : path
}
