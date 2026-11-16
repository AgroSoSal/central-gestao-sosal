import { describe, expect, it } from "vitest"
import {
  reconcilePurchases,
  type IncomingInvoiceLine,
  type PurchaseLine,
} from "./purchase-reconciliation"

// Dados sintéticos de teste. Não representam registros ou fornecedores reais.
const purchase = (change: Partial<PurchaseLine> = {}): PurchaseLine => ({
  id: "pedido-1",
  branch: "SO SAL",
  supplierName: "FORNECEDOR TESTE LTDA",
  productCode: "PROD-1",
  orderDate: "2026-11-01",
  quantity: 10,
  unitCost: 12.5,
  ...change,
})

const receipt = (change: Partial<IncomingInvoiceLine> = {}): IncomingInvoiceLine => ({
  branch: "Bandeirantes",
  supplierName: "FORNECEDOR TESTE LTDA",
  productCode: "PROD-1",
  entryDate: "2026-11-03",
  quantity: 4,
  type: "ent",
  ...change,
})

describe("COMP-001 a COMP-008 — conciliação dos pedidos", () => {
  it("calcula recebimento parcial, saldo pendente e valor pelo custo do pedido", () => {
    const [result] = reconcilePurchases([purchase()], [receipt()])
    expect(result).toMatchObject({
      orderValue: 125,
      receivedQuantity: 4,
      pendingQuantity: 6,
      pendingValue: 75,
      receiptStatus: "Chegada parcial",
    })
  })

  it("classifica como aberto quando há dados de entradas mas não há NF correspondente", () => {
    const [result] = reconcilePurchases([purchase()], [])
    expect(result).toMatchObject({
      receivedQuantity: 0,
      pendingQuantity: 10,
      receiptStatus: "Em aberto",
    })
  })

  it("limita o recebimento à quantidade encomendada", () => {
    const [result] = reconcilePurchases([purchase()], [receipt({ quantity: 25 })])
    expect(result).toMatchObject({
      receivedQuantity: 10,
      pendingQuantity: 0,
      pendingValue: 0,
      receiptStatus: "Já chegou – conferir/baixar",
    })
  })

  it("considera o sinal de entradas negativas, como a SOMASES do Excel", () => {
    const [result] = reconcilePurchases([purchase()], [receipt({ quantity: 10 }), receipt({ quantity: -3 })])
    expect(result).toMatchObject({ receivedQuantity: 7, pendingQuantity: 3, pendingValue: 37.5 })
  })

  it("não conta entrada de outra filial, produto, fornecedor, data anterior ou devolução", () => {
    const entries = [
      receipt({ branch: "CAMPO GRANDE" }),
      receipt({ productCode: "PROD-2" }),
      receipt({ supplierName: "DISTRIBUIDOR OUTRO" }),
      receipt({ entryDate: "2026-10-31" }),
      receipt({ type: "dev" }),
    ]
    expect(reconcilePurchases([purchase()], entries)[0].receivedQuantity).toBe(0)
  })

  it("não reutiliza a mesma nota para pedidos anteriores e posteriores", () => {
    const orders = [
      purchase({ id: "primeiro", quantity: 10 }),
      purchase({ id: "segundo", orderDate: "2026-11-05", quantity: 8 }),
    ]
    const entries = [receipt({ entryDate: "2026-11-06", quantity: 12 }), receipt({ entryDate: "2026-11-07", quantity: 2 })]
    expect(reconcilePurchases(orders, entries).map((p) => p.receivedQuantity)).toEqual([10, 4])
  })

  it("não atribui à compra posterior uma NF anterior à sua data", () => {
    const orders = [
      purchase({ id: "primeiro", quantity: 10 }),
      purchase({ id: "segundo", orderDate: "2026-11-05", quantity: 8 }),
    ]
    expect(reconcilePurchases(orders, [receipt({ entryDate: "2026-11-02", quantity: 12 })]).map((p) => p.receivedQuantity)).toEqual([10, 0])
  })

  it("prioriza a primeira linha de pedido quando a data é igual", () => {
    const orders = [purchase({ id: "a", quantity: 10 }), purchase({ id: "b", quantity: 8 })]
    expect(reconcilePurchases(orders, [receipt({ quantity: 12 })]).map((p) => p.receivedQuantity)).toEqual([10, 2])
  })

  it("permite excluir da conferência os produtos genéricos configurados", () => {
    const [result] = reconcilePurchases([purchase({ productCode: "GEN" })], [receipt({ productCode: "GEN", quantity: 10 })], {
      excludedProductCodes: ["GEN"],
    })
    expect(result).toMatchObject({ receivedQuantity: 0, pendingQuantity: 10, receiptStatus: "Em aberto" })
  })

  it("exige dados numéricos válidos para não apresentar saldos incorretos", () => {
    expect(() => reconcilePurchases([purchase({ quantity: -2 })], [])).toThrow()
    expect(() => reconcilePurchases([purchase()], [receipt({ quantity: Number.NaN })])).toThrow()
  })
})
