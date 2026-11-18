/**
 * Fórmulas Zacarini 2.3.7 para o Atendimento Fornecedor e a Verba do Comprador.
 * Fontes: Atendimento Fornecedor!L63, W63, X63, AP63:AU63
 * e Verba Comprador!C6:E8, E12:M15.
 * Nenhuma dessas funções autoriza, por si só, a emissão de pedido.
 */
export function suggestedPurchaseQuantity(salesPerDay: number, targetDde: number, available: number, openOrders: number): number {
  if (![salesPerDay, targetDde, available, openOrders].every(Number.isFinite)
      || salesPerDay < 0 || targetDde < 0 || available < 0 || openOrders < 0)
    throw new RangeError("Fonte inválida para sugestão.")
  return Math.max(0, Math.ceil(salesPerDay * targetDde - available - openOrders))
}

export function negotiatedPurchase(qty: number, unitCost: number, discountPercent: number, sellPrice?: number | null) {
  if (![qty,unitCost,discountPercent].every(Number.isFinite)
      || qty < 0 || unitCost < 0 || discountPercent < 0 || discountPercent > 100)
    throw new RangeError("Quantidade, custo ou desconto inválidos.")
  if (sellPrice != null && (!Number.isFinite(sellPrice) || sellPrice < 0))
    throw new RangeError("Preço de venda inválido.")
  const netCost = unitCost * (1 - discountPercent / 100)
  return { netCost, total: qty * netCost, margin: sellPrice && sellPrice > 0 ? 1 - netCost / sellPrice : null }
}

/** Verba Comprador!C8:E8: protege subgrupos com DDE < 30 dias. */
export function buyerCashCutFactor(cap: number, need85: number, protected85: number): number {
  if (![cap,need85,protected85].every(Number.isFinite)
      || cap < 0 || need85 < 0 || protected85 < 0 || protected85 > need85)
    throw new RangeError("Teto ou necessidade inválidos.")
  if (need85 <= cap) return 1
  if (need85 <= protected85) return 0
  return Math.max(0, Math.min(1, (cap - protected85) / (need85 - protected85)))
}

/** Verba Comprador!E12/I12/M12: protege mínimos e respeita saldo livre por linha. */
export function buyerLineBudget(afterCut: number, protectedAmount: number, freeLineBalance: number): number {
  if (![afterCut,protectedAmount,freeLineBalance].every(Number.isFinite)
      || afterCut < 0 || protectedAmount < 0 || protectedAmount > afterCut)
    throw new RangeError("Verba da linha inválida.")
  return Math.max(protectedAmount, Math.min(afterCut, Math.max(0, freeLineBalance)))
}

/** Atendimento Fornecedor!AP:AU: rateio proporcional cumulativo com soma exata. */
export function distributePurchase(qty: number, branchNeeds: readonly number[]): number[] {
  if (!Number.isInteger(qty) || qty < 0 || branchNeeds.length === 0
      || branchNeeds.some(v => !Number.isFinite(v) || v < 0))
    throw new RangeError("Rateio inválido.")
  const totalNeed = branchNeeds.reduce((sum, v) => sum + v, 0)
  if (totalNeed === 0) return branchNeeds.map(() => 0)
  let acc = 0, prev = 0
  return branchNeeds.map((need, index) => {
    acc += need
    const next = index === branchNeeds.length - 1 ? qty : Math.round(qty * acc / totalNeed)
    const slice = next - prev
    prev = next
    return slice
  })
}
