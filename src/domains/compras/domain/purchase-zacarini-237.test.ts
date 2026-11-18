import { describe, expect, it } from "vitest"
import { buyerCashCutFactor, buyerLineBudget, distributePurchase, negotiatedPurchase, suggestedPurchaseQuantity } from "./purchase-zacarini-237"

describe("Zacarini 2.3.7: Atendimento Fornecedor e Verba Comprador", () => {
  it("necessidade L63: DDE × saída/dia - estoque - pedidos", () => {
    expect(suggestedPurchaseQuantity(3, 45, 100, 10)).toBe(25)
    expect(suggestedPurchaseQuantity(1, 30, 50, 0)).toBe(0)
  })
  it("custo e margem W63/X63 com desconto", () => {
    expect(negotiatedPurchase(10, 30, 10, 60)).toEqual({netCost: 27, total: 270, margin: 0.55})
  })
  it("fator C8 protege DDE < 30 e corta apenas a necessidade não protegida", () => {
    expect(buyerCashCutFactor(75,100,50)).toBe(0.5)
    expect(buyerCashCutFactor(100,100,40)).toBe(1)
    expect(buyerCashCutFactor(20,100,40)).toBe(0)
  })
  it("verba por linha preserva mínimo protegido", () => {
    expect(buyerLineBudget(100,40,55)).toBe(55)
    expect(buyerLineBudget(100,40,-5)).toBe(40)
  })
  it("rateio cumulativo evita sobra de arredondamento entre filiais", () => {
    const parts=distributePurchase(11,[3,2,1,0,0,0])
    expect(parts).toEqual([6,3,2,0,0,0])
    expect(parts.reduce((a,b)=>a+b,0)).toBe(11)
  })
  it("não presume necessidade inexistente", () => {
    expect(distributePurchase(5,[0,0,0])).toEqual([0,0,0])
    expect(()=>distributePurchase(-1,[1])).toThrow()
  })
})
