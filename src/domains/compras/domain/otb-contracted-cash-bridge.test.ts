import { describe, expect, it } from "vitest"
import { calculateContractedCashBridge, type OperationalBankBasis } from "./otb-contracted-cash-bridge"
import type { ContractedMonth } from "./otb-bank-readiness"

const basis: OperationalBankBasis = {
  data_base: "2026-11-23",
  contas_cadastradas: 14,
  contas_com_saldo: 14,
  contas_sem_extrato: 0,
  contas_conciliadas: 0,
  saldo_parcial_conhecido_siscom: "100.00",
}
function agenda(): ContractedMonth[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = new Date(Date.UTC(2026, 10 + i, 1)).toISOString().slice(0, 10)
    return {
      mes: month,
      receber_identificado: "90.40",
      pagar_identificado: "100.50",
      saldo_contratado_identificado: "-10.10",
      titulos_receber: 2,
      titulos_pagar: 1,
      ultima_importacao_pagar: "2026-11-23T19:00:00Z",
    }
  })
}

describe("ponte identificada de caixa: informativa, sem liberar compras", () => {
  it("constrói 12 meses consecutivos, atravessa a virada do ano e soma em centavos", () => {
    const result = calculateContractedCashBridge(basis, agenda())
    expect(result.state).toBe("parcial")
    expect(result.authorizesPurchases).toBe(false)
    if (result.state !== "parcial") throw new Error(result.motivo)
    expect(result.months).toHaveLength(12)
    expect(result.months[1].mes).toBe("2026-12-01")
    expect(result.months[2].mes).toBe("2027-01-01")
    expect(result.months[0].base_abertura).toBe(100)
    expect(result.months[0].base_apos_titulos).toBe(89.9)
    expect(result.ultimoSaldoSomenteTitulos).toBe(-21.2)
    expect(result.minimoSomenteTitulos).toBe(-21.2)
    expect(result.conciliacoes).toBe(0)
  })
  it("aceita saldos operacionais negativos e zero, sem aprovação", () => {
    const rows = agenda()
    const result = calculateContractedCashBridge({...basis,saldo_parcial_conhecido_siscom: -42},rows)
    expect(result.state).toBe("parcial")
    expect(result.authorizesPurchases).toBe(false)
    expect(calculateContractedCashBridge({...basis,saldo_parcial_conhecido_siscom: 0},rows).state).toBe("parcial")
  })
  it("bloqueia cadastro incompleto e não inventa saldo", () => {
    expect(calculateContractedCashBridge(null, agenda()).state).toBe("indisponivel")
    expect(calculateContractedCashBridge({...basis,contas_com_saldo:13},agenda()).state).toBe("indisponivel")
    expect(calculateContractedCashBridge({...basis,saldo_parcial_conhecido_siscom:null},agenda()).state).toBe("indisponivel")
    expect(calculateContractedCashBridge({...basis,saldo_parcial_conhecido_siscom:""},agenda()).state).toBe("indisponivel")
  })
  it("não completa lacunas com zero nem soma agenda com mês repetido", () => {
    const rows=agenda()
    expect(calculateContractedCashBridge(basis,rows.slice(0,11)).state).toBe("indisponivel")
    const duplicated = agenda(); duplicated[1].mes=duplicated[0].mes
    expect(calculateContractedCashBridge(basis,duplicated).state).toBe("indisponivel")
    const shifted = agenda(); shifted[0].mes="2026-12-01"
    expect(calculateContractedCashBridge(basis,shifted).state).toBe("indisponivel")
  })
  it("bloqueia valores inconsistentes, carga sem origem e horários distintos", () => {
    const badNet=agenda(); badNet[2].saldo_contratado_identificado=0
    expect(calculateContractedCashBridge(basis,badNet).state).toBe("indisponivel")
    const missing=agenda(); missing[0].ultima_importacao_pagar=null
    expect(calculateContractedCashBridge(basis,missing).state).toBe("indisponivel")
    const mixed=agenda(); mixed[1].ultima_importacao_pagar="2026-11-19T00:00:00Z"
    expect(calculateContractedCashBridge(basis,mixed).state).toBe("indisponivel")
    const negative=agenda(); negative[5].receber_identificado=-10
    expect(calculateContractedCashBridge(basis,negative).state).toBe("indisponivel")
  })
})
