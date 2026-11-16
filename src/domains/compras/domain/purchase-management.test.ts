import { describe, expect, it } from "vitest"
import { requiresPurchaseManagement } from "./purchase-management"

describe("fila de gerenciamento de compras", () => {
  it("inclui pedidos em aberto e chegadas parciais", () => {
    expect(requiresPurchaseManagement({ quantidade_pendente: 8, situacao_recebimento: "Em aberto" }, null)).toBe(true)
    expect(requiresPurchaseManagement({ quantidade_pendente: "1.5", situacao_recebimento: "Chegada parcial" }, "Aprovado")).toBe(true)
  })

  it("exclui pedidos inteiramente recebidos e aprovados, inclusive sem decisão gravada", () => {
    expect(requiresPurchaseManagement({ quantidade_pendente: 0, situacao_recebimento: "Já chegou – conferir/baixar" }, null)).toBe(false)
    expect(requiresPurchaseManagement({ quantidade_pendente: "0", situacao_recebimento: "Já chegou – conferir/baixar" }, "Aprovado")).toBe(false)
  })

  it("mantém Segurar e Cancelar na fila, mesmo quando totalmente recebidos", () => {
    expect(requiresPurchaseManagement({ quantidade_pendente: 0, situacao_recebimento: "Já chegou – conferir/baixar" }, "Segurar")).toBe(true)
    expect(requiresPurchaseManagement({ quantidade_pendente: 0, situacao_recebimento: "Já chegou – conferir/baixar" }, "Cancelar")).toBe(true)
  })

  it("não inventa saldo pendente se não houver conciliação", () => {
    expect(requiresPurchaseManagement({ quantidade_pendente: null, situacao_recebimento: "Dados incompletos" }, null)).toBe(false)
    expect(requiresPurchaseManagement({ quantidade_pendente: null, situacao_recebimento: null }, null)).toBe(false)
    expect(requiresPurchaseManagement({ quantidade_pendente: null, situacao_recebimento: null }, "Segurar")).toBe(true)
  })
})
