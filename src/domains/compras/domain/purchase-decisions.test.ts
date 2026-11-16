import { describe, expect, it } from "vitest"
import {
  decisionKey, effectiveDecision, forecastIncludesDecision, normalizeDecision, operationalDecision,
} from "./purchase-decisions"

describe("decisões dos pedidos de compra", () => {
  it("considera aprovação quando a planilha deixa a decisão em branco", () => {
    expect(effectiveDecision(null)).toBe("Aprovado")
    expect(effectiveDecision(undefined)).toBe("Aprovado")
    expect(forecastIncludesDecision(undefined)).toBe(true)
  })

  it("distingue aprovação operacional registrada da suposição financeira", () => {
    expect(operationalDecision(null)).toBe("Aguardando aprovação")
    expect(operationalDecision("Aprovado")).toBe("Aprovado")
    expect(operationalDecision("Segurar")).toBe("Segurar")
    expect(forecastIncludesDecision(null)).toBe(true)
  })

  it("segurar e cancelar retiram o item de projeções futuras", () => {
    expect(forecastIncludesDecision("Segurar")).toBe(false)
    expect(forecastIncludesDecision("Cancelar")).toBe(false)
    expect(forecastIncludesDecision("Aprovado")).toBe(true)
  })

  it("não aceita decisões desconhecidas", () => {
    expect(normalizeDecision("Segurar")).toBe("Segurar")
    expect(normalizeDecision("Aguardando")).toBeNull()
  })

  it("identifica por filial, pedido e produto sem colisões", () => {
    expect(decisionKey("SO SAL", "123", "12")).not.toBe(decisionKey("SO SAL", "12", "312"))
    expect(decisionKey("SO SAL", "123", "12")).not.toBe(decisionKey("CAMPO GRANDE", "123", "12"))
  })
})
