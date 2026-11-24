import { effectiveDecision, type PurchaseDecision } from "./purchase-decisions"

export type ManagementItem = {
  quantidade_pendente: number | string | null
  situacao_recebimento: string | null
}

/** Saldo só existe quando a conciliação devolve uma quantidade numérica positiva. */
export function hasOutstandingDelivery(item: ManagementItem): boolean {
  if (item.quantidade_pendente === null) return false
  const pending = Number(item.quantidade_pendente)
  return Number.isFinite(pending) && pending > 0
}

export function requiresPurchaseManagement(item: ManagementItem, decision: PurchaseDecision | null | undefined): boolean {
  return hasOutstandingDelivery(item) && decision !== "Segurar" && decision !== "Cancelar"
}

export function isApprovedForFollowUp(item: ManagementItem, decision: PurchaseDecision | null | undefined): boolean {
  const effective = effectiveDecision(decision)
  return hasOutstandingDelivery(item) && (effective === "Aprovado" || effective === "Já pago")
}

/** Preserva o contexto da pesquisa ao trocar entre consulta e gestão. */
export function purchaseFilteredHref(path: "/compras" | "/compras/gerenciar" | "/compras/follow-up" | "/compras/previsao", filters: {
  busca: string; loja: string; inicio: string; fim: string
}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value)
  }
  return params.size ? `${path}?${params.toString()}` : path
}
