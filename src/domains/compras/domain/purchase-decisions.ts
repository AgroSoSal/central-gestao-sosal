/** Decisão operacional independente da situação de recebimento da NF. */
export const PURCHASE_DECISIONS = ["Aprovado", "Segurar", "Cancelar", "Já pago"] as const

export type PurchaseDecision = (typeof PURCHASE_DECISIONS)[number]

export type DecisionHistoryEntry = {
  anterior: PurchaseDecision | null
  nova: PurchaseDecision
  observacao: string | null
  quando: string
  por: string
}

export type PurchaseDecisionRecord = {
  loja: string
  pedido: string
  produto_codigo: string
  decisao: PurchaseDecision
  observacao: string | null
  atualizado_em: string
  alteracoes: DecisionHistoryEntry[]
}

export function normalizeDecision(value: unknown): PurchaseDecision | null {
  return PURCHASE_DECISIONS.find((item) => item === value) ?? null
}

/** A coluna AP vazia na planilha equivale a Aprovado. */
export function effectiveDecision(value: PurchaseDecision | null | undefined): PurchaseDecision {
  return value ?? "Aprovado"
}

/** A previsão da planilha não substitui uma aprovação feita por uma pessoa. */
export function operationalDecision(value: PurchaseDecision | null | undefined): PurchaseDecision | "Aguardando aprovação" {
  return value ?? "Aguardando aprovação"
}

/** Aplicável quando o fluxo de caixa e OTB forem integrados no ERP. */
export function forecastIncludesDecision(value: PurchaseDecision | null | undefined): boolean {
  return effectiveDecision(value) === "Aprovado"
}

export function decisionKey(loja: string, pedido: string, produto: string): string {
  return JSON.stringify([loja, pedido, produto])
}
