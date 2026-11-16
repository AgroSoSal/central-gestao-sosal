import { describe, expect, it } from "vitest"
import { forecastPurchasePayments, groupForecastByWeek } from "./purchase-payment-forecast"

const basic = {
  orderDate: "2026-11-10",
  paymentTerms: "30/60/90",
  pendingQuantity: 10,
  pendingValue: 300,
  decision: "Aprovado" as const,
  followUpArrival: null,
  baseDate: "2026-11-16",
}

describe("previsão financeira das compras (Zacarini)", () => {
  it("calcula chegada por MAX(data do pedido, data-base) + 7 dias e vence a partir da chegada", () => {
    const result = forecastPurchasePayments(basic)
    expect(result.estimatedArrival).toBe("2026-11-23")
    expect(result.arrivalSource).toBe("calculada")
    expect(result.installments.map((item) => item.dueDate)).toEqual(["2026-12-23", "2027-01-22", "2027-02-21"])
    expect(result.installments.map((item) => item.amount)).toEqual([100, 100, 100])
  })

  it("usa a previsão do Follow-up mesmo se estiver atrasada", () => {
    const result = forecastPurchasePayments({ ...basic, orderDate: "2026-12-01", followUpArrival: "2026-11-01", paymentTerms: "15" })
    expect(result.estimatedArrival).toBe("2026-11-01")
    expect(result.arrivalSource).toBe("follow-up")
    expect(result.installments[0].dueDate).toBe("2026-11-16")
  })

  it("inclui condição vazia na regra padrão de 30 dias, mas avisa sobre o padrão", () => {
    const result = forecastPurchasePayments({ ...basic, paymentTerms: null })
    expect(result.conditionSource).toBe("padrao")
    expect(result.installments).toHaveLength(1)
    expect(result.installments[0].dueDate).toBe("2026-12-23")
    expect(result.issue).toMatch(/30 dias/i)
  })

  it("valida abreviação de dias usada no SISCOM sem confundir uma condição 6x com dias", () => {
    const valid = forecastPurchasePayments({ ...basic, paymentTerms: "30d" })
    expect(valid.installments).toHaveLength(1)
    expect(valid.installments[0].dueDate).toBe("2026-12-23")
    const ambiguous = forecastPurchasePayments({ ...basic, paymentTerms: "6x" })
    expect(ambiguous.installments).toHaveLength(0)
    expect(ambiguous.unscheduledAmount).toBe(300)
  })

  it("interpreta explicitamente os dias de cada parcela mesmo com sufixos individuais", () => {
    for (const paymentTerms of ["30d/60d", "30 dias / 60 dias", "30D; 60D"]) {
      const result = forecastPurchasePayments({ ...basic, paymentTerms })
      expect(result.status).toBe("projetado")
      expect(result.paymentDays).toEqual([30, 60])
      expect(result.installments.map((item) => item.dueDate)).toEqual(["2026-12-23", "2027-01-22"])
    }
  })

  it("usa os 30 dias documentados para pagamento inequívoco no cartão, mas mantém parcelamento em x para conferência", () => {
    for (const paymentTerms of ["CARTÃO", "cartao de credito", "Pagamento no cartão"]) {
      const result = forecastPurchasePayments({ ...basic, paymentTerms })
      expect(result.conditionSource).toBe("padrao")
      expect(result.paymentDays).toEqual([30])
      expect(result.installments[0].dueDate).toBe("2026-12-23")
      expect(result.issue).toMatch(/cartão/i)
    }
    const ambiguous = forecastPurchasePayments({ ...basic, paymentTerms: "CARTÃO 6X" })
    expect(ambiguous.status).toBe("conferir")
    expect(ambiguous.unscheduledAmount).toBe(300)
    expect(ambiguous.installments).toEqual([])
    const debit = forecastPurchasePayments({ ...basic, paymentTerms: "CARTÃO DE DÉBITO" })
    expect(debit.status).toBe("conferir")
    expect(debit.unscheduledAmount).toBe(300)
  })

  it("não cria título fictício para condição textual desconhecida ou mais de 10 parcelas", () => {
    for (const paymentTerms of ["BONIFICAÇÃO", "30/XYZ", "1/2/3/4/5/6/7/8/9/10/11"]) {
      const result = forecastPurchasePayments({ ...basic, paymentTerms })
      expect(result.status).toBe("conferir")
      expect(result.installments).toEqual([])
      expect(result.unscheduledAmount).toBe(300)
    }
  })

  it("mantém a aprovação operacional pendente separada do padrão financeiro AP vazio", () => {
    const result = forecastPurchasePayments({ ...basic, decision: null })
    expect(result.included).toBe(true)
    expect(result.operationalDecision).toBe("Aguardando aprovação")
    expect(result.status).toBe("projetado")
    expect(result.installments).toHaveLength(3)
  })

  it("Segurar e Cancelar retiram o item das parcelas sem alterar o saldo pendente original", () => {
    for (const decision of ["Segurar", "Cancelar"] as const) {
      const result = forecastPurchasePayments({ ...basic, decision })
      expect(result.included).toBe(false)
      expect(result.status).toBe(decision === "Segurar" ? "segurado" : "cancelar")
      expect(result.installments).toHaveLength(0)
      expect(result.pendingAmount).toBe(300)
    }
  })

  it("não projeta parcela de pedido totalmente entregue ou não conciliado", () => {
    expect(forecastPurchasePayments({ ...basic, pendingQuantity: 0, pendingValue: 0 }).status).toBe("entregue")
    const invalid = forecastPurchasePayments({ ...basic, pendingValue: null })
    expect(invalid.status).toBe("sem_dados")
    expect(invalid.included).toBe(false)
    expect(invalid.installments).toEqual([])
  })

  it("não chama pedido ainda pendente de entregue quando o valor financeiro é zero", () => {
    const pendingFreeOfCharge = forecastPurchasePayments({ ...basic, pendingQuantity: 5, pendingValue: 0 })
    expect(pendingFreeOfCharge.status).toBe("sem_valor")
    expect(pendingFreeOfCharge.installments).toEqual([])
    const inconsistent = forecastPurchasePayments({ ...basic, pendingQuantity: 0, pendingValue: 100 })
    expect(inconsistent.status).toBe("sem_dados")
    expect(inconsistent.issue).toMatch(/inconsistente/i)
  })

  it("não interpreta valor com espaços como zero conciliado", () => {
    expect(forecastPurchasePayments({ ...basic, pendingValue: "  " }).status).toBe("sem_dados")
  })

  it("projeta apenas valor restante após a entrega parcial e distribui centavos sem diferença", () => {
    const result = forecastPurchasePayments({ ...basic, pendingQuantity: 4, pendingValue: "85.01" })
    expect(result.installments.map((item) => item.amount)).toEqual([28.34, 28.34, 28.33])
    expect(result.installments.reduce((sum, item) => sum + Math.round(item.amount * 100), 0)).toBe(8501)
  })

  it("separa vencimentos atrasados, dentro e depois do horizonte de 26 semanas", () => {
    const result = forecastPurchasePayments({ ...basic, followUpArrival: "2026-10-01", paymentTerms: "0/60/240", pendingValue: 90 })
    expect(result.installments.map((item) => item.horizon)).toEqual(["vencido", "26_semanas", "posterior"])
    expect(result.overdueAmount).toBe(30)
    expect(result.inHorizonAmount).toBe(30)
    expect(result.afterHorizonAmount).toBe(30)
  })

  it("não soma na semana parcelas retidas nem fora do período", () => {
    const included = forecastPurchasePayments({ ...basic, followUpArrival: "2026-11-16", paymentTerms: "0/7", pendingValue: 100 })
    const held = forecastPurchasePayments({ ...basic, decision: "Segurar" })
    const weeks = groupForecastByWeek([included, held], "2026-11-16")
    expect(weeks).toHaveLength(26)
    expect(weeks[0].amount).toBe(50)
    expect(weeks[1].amount).toBe(50)
    expect(weeks.slice(2).every((week) => week.amount === 0)).toBe(true)
  })

  it("identifica pedido com data futura e aceita condição numérica de uma parcela", () => {
    const result = forecastPurchasePayments({ ...basic, orderDate: "2027-01-01", paymentTerms: "180" })
    expect(result.estimatedArrival).toBe("2027-01-08")
    expect(result.installments[0].dueDate).toBe("2027-07-07")
    expect(result.installments[0].horizon).toBe("posterior")
  })
})
