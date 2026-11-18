import { describe, expect, it } from "vitest"
import { isApprovedForFollowUp, requiresPurchaseManagement, hasOutstandingDelivery } from "./purchase-management"

describe("fila de gerenciamento de compras", () => {
  it("inclui pedidos em aberto e chegadas parciais", () => {
    expect(requiresPurchaseManagement({ quantidade_pendente: 8, situacao_recebimento: "Em aberto" }, null)).toBe(true)
    expect(requiresPurchaseManagement({ quantidade_pendente: "1.5", situacao_recebimento: "Chegada parcial" }, "Aprovado")).toBe(true)
  })

  it("exclui pedidos inteiramente recebidos e aprovados, inclusive sem decisão gravada", () => {
    expect(requiresPurchaseManagement({ quantidade_pendente: 0, situacao_recebimento: "Já chegou – conferir/baixar" }, null)).toBe(false)
    expect(requiresPurchaseManagement({ quantidade_pendente: "0", situacao_recebimento: "Já chegou – conferir/baixar" }, "Aprovado")).toBe(false)
  })

  it("não mistura segurados ou cancelados na fila ativa de aprovação", () => {
    expect(requiresPurchaseManagement({ quantidade_pendente: 4, situacao_recebimento: "Em aberto" }, "Segurar")).toBe(false)
    expect(requiresPurchaseManagement({ quantidade_pendente: 4, situacao_recebimento: "Em aberto" }, "Cancelar")).toBe(false)
    expect(requiresPurchaseManagement({ quantidade_pendente: 0, situacao_recebimento: "Já chegou – conferir/baixar" }, "Segurar")).toBe(false)
  })

  it("não inventa saldo pendente se não houver conciliação", () => {
    expect(requiresPurchaseManagement({ quantidade_pendente: null, situacao_recebimento: "Dados incompletos" }, null)).toBe(false)
    expect(requiresPurchaseManagement({ quantidade_pendente: null, situacao_recebimento: null }, null)).toBe(false)
    expect(requiresPurchaseManagement({ quantidade_pendente: null, situacao_recebimento: null }, "Segurar")).toBe(false)
  })

  it("somente permite follow-up com aprovação explícita e saldo de entrega real", () => {
    const partial = { quantidade_pendente: "40", situacao_recebimento: "Chegada parcial" }
    expect(hasOutstandingDelivery(partial)).toBe(true)
    expect(isApprovedForFollowUp(partial, null)).toBe(false)
    expect(isApprovedForFollowUp(partial, "Aprovado")).toBe(true)
    expect(isApprovedForFollowUp(partial, "Já pago")).toBe(true)
    expect(isApprovedForFollowUp(partial, "Segurar")).toBe(false)
    expect(isApprovedForFollowUp({ ...partial, quantidade_pendente: 0 }, "Aprovado")).toBe(false)
    expect(isApprovedForFollowUp({ ...partial, quantidade_pendente: "NaN" }, "Aprovado")).toBe(false)
  })
})
