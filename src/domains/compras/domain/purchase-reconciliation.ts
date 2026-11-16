/**
 * Conciliação sem dependência de Excel, banco ou interface.
 * Reproduz as regras das colunas K:O de "Pedidos de Compra" (registro COMP-001..008).
 *
 * Só deve ser invocada quando o conjunto de entradas e pedidos do período
 * estiver disponível: dados ausentes NÃO equivalem a quantidade recebida zero.
 */

export type PurchaseLine = {
  id: string
  branch: string
  supplierName: string | null
  productCode: string
  orderDate: string // AAAA-MM-DD
  quantity: number
  unitCost: number
}

export type IncomingInvoiceLine = {
  branch: string
  supplierName: string | null
  productCode: string
  entryDate: string // AAAA-MM-DD
  quantity: number
  type: string // "ent" = entrada, conforme sbCompras
}

export type ReceiptStatus = "Em aberto" | "Chegada parcial" | "Já chegou – conferir/baixar"

export type ReconciledPurchase = PurchaseLine & {
  orderValue: number
  receivedQuantity: number
  pendingQuantity: number
  pendingValue: number
  receiptStatus: ReceiptStatus
}

export type ReconciliationOptions = {
  excludedProductCodes?: readonly string[]
}

function normalized(value: string | null | undefined): string {
  return String(value ?? "").trim().toLocaleUpperCase("pt-BR")
}

/** Nomes de exibição/integração do ERP, sem modificar os códigos de origem. */
export function normalizedBranch(branch: string): string {
  const value = normalized(branch)
  if (value === "SO SAL" || value === "BDS") return "BANDEIRANTES"
  if (value === "CG") return "CAMPO GRANDE"
  if (value === "RIO") return "RIO VERDE"
  if (value === "CX") return "COXIM"
  if (value === "PG") return "PEDRO GOMES"
  if (value === "AN") return "ANASTACIO"
  return value
}

function validDate(value: string, description: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError(`${description}: data inválida`)
  }
  const date = new Date(value + "T00:00:00Z")
  if (Number.isNaN(date.valueOf()) || !date.toISOString().startsWith(value)) {
    throw new RangeError(`${description}: data inválida`)
  }
  return value
}

function nonnegative(value: number, description: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${description} deve ser um número finito não negativo`)
  }
  return value
}

function sameProductAndBranch(
  a: { branch: string; productCode: string },
  b: { branch: string; productCode: string },
): boolean {
  return normalizedBranch(a.branch) === normalizedBranch(b.branch) &&
    normalized(a.productCode) === normalized(b.productCode)
}

/** Equivalente à condição `LEFT(nome_fornecedor, 12)&"*"` do Excel. */
function sameSupplier(reference: string | null, other: string | null): boolean {
  const prefix = normalized(reference).slice(0, 12)
  return prefix === "" || normalized(other).startsWith(prefix)
}

export function reconcilePurchases(
  purchases: readonly PurchaseLine[],
  entries: readonly IncomingInvoiceLine[],
  options: ReconciliationOptions = {},
): ReconciledPurchase[] {
  // A fonte de entradas precisa estar completa para o intervalo de conciliação.
  const excluded = new Set((options.excludedProductCodes ?? []).map(normalized))
  for (const item of purchases) {
    nonnegative(item.quantity, `Quantidade do pedido ${item.id}`)
    nonnegative(item.unitCost, `Custo do pedido ${item.id}`)
    validDate(item.orderDate, `Pedido ${item.id}`)
  }
  const incomingByProductAndBranch = new Map<string, IncomingInvoiceLine[]>()
  for (const item of entries) {
    // Entradas históricas podem ser negativas (ajustes); SUMIFS considera o sinal.
    if (!Number.isFinite(item.quantity)) throw new RangeError("Quantidade da entrada inválida")
    validDate(item.entryDate, "Entrada")
    if (normalized(item.type) !== "ENT") continue
    const key = `${normalizedBranch(item.branch)}\u0000${normalized(item.productCode)}`
    const group = incomingByProductAndBranch.get(key) ?? []
    group.push(item)
    incomingByProductAndBranch.set(key, group)
  }

  return purchases.map((order, index) => {
    const sameOrders = purchases
      .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
      .filter(({ candidate }) => sameProductAndBranch(order, candidate) && sameSupplier(order.supplierName, candidate.supplierName))
    const firstDate = sameOrders.reduce((first, { candidate }) => candidate.orderDate < first ? candidate.orderDate : first, order.orderDate)
    const priorQuantity = sameOrders.reduce((total, { candidate, candidateIndex }) => {
      const preceding = candidate.orderDate < order.orderDate ||
        (candidate.orderDate === order.orderDate && candidateIndex < index)
      return preceding ? total + candidate.quantity : total
    }, 0)

    const key = `${normalizedBranch(order.branch)}\u0000${normalized(order.productCode)}`
    const matchingEntries = (incomingByProductAndBranch.get(key) ?? []).filter((entry) =>
      sameSupplier(order.supplierName, entry.supplierName),
    )
    const receivedSinceOrder = matchingEntries.reduce((total, entry) =>
      entry.entryDate >= order.orderDate ? total + entry.quantity : total, 0)
    const receivedSinceFirst = matchingEntries.reduce((total, entry) =>
      entry.entryDate >= firstDate ? total + entry.quantity : total, 0)

    // MIN(qtde pedido, NFs após este pedido, NFs desde o primeiro - pedidos anteriores).
    // Mantém a dupla trava da fórmula L12 e evita duplicar entradas entre pedidos.
    const receivedQuantity = excluded.has(normalized(order.productCode)) ? 0 :
      Math.max(0, Math.min(order.quantity, receivedSinceOrder, receivedSinceFirst - priorQuantity))
    const pendingQuantity = Math.max(0, order.quantity - receivedQuantity)
    const receiptStatus: ReceiptStatus = receivedQuantity === 0 ? "Em aberto" :
      pendingQuantity === 0 ? "Já chegou – conferir/baixar" : "Chegada parcial"

    return {
      ...order,
      orderValue: order.quantity * order.unitCost,
      receivedQuantity,
      pendingQuantity,
      pendingValue: pendingQuantity * order.unitCost,
      receiptStatus,
    }
  })
}
