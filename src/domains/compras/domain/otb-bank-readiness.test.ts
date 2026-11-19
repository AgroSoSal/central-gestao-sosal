import { describe, expect, it } from "vitest"
import { assessBankPosition, summarizeContractedSchedule, type BankPositionRow } from "./otb-bank-readiness"

const sample: BankPositionRow[] = [
  { conta_ref: "a", filial: "Bandeirantes", banco: "Não identificado", data_corte_comum: "2026-11-11", data_ultimo_saldo: "2026-11-18", ultimo_saldo: 210, data_saldo_base: "2026-11-11", saldo_base: 100, data_arquivo: "2026-11-18", diferenca_arquivo: 0, conciliado: false },
  { conta_ref: "b", filial: "Coxim", banco: "Não identificado", data_corte_comum: "2026-11-11", data_ultimo_saldo: "2026-11-11", ultimo_saldo: -25, data_saldo_base: "2026-11-10", saldo_base: -20, data_arquivo: "2026-11-11", diferenca_arquivo: "0.00", conciliado: false },
]

describe("conferência de extratos para a OTB", () => {
  it("soma somente saldos transportados à mesma data-base, sem usar datas diferentes", () => {
    expect(assessBankPosition(sample,"2026-11-19")).toMatchObject({
      state: "conferido_sem_homologacao", commonDate: "2026-11-11", openingCash: 80,
      accountCount: 2, matchedArchives: 2, reconciledAccounts: 0, staleAccounts: 1,
    })
  })
  it("não aprova automaticamente contas sem homologação", () => {
    expect(assessBankPosition(sample,"2026-11-19").warnings.some(w => w.includes("homologação"))).toBe(true)
  })
  it("não inventa caixa quando um arquivo difere do saldo ou falta uma conta", () => {
    expect(assessBankPosition([{ ...sample[0], diferenca_arquivo: 30 }, sample[1]],"2026-11-19").openingCash).toBeNull()
    expect(assessBankPosition([sample[0], { ...sample[0] }],"2026-11-19").state).toBe("divergente")
    expect(assessBankPosition([],"2026-11-19").state).toBe("indisponivel")
  })
  it("mantém calendário de contratos informativo, sem autorizar teto", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ mes: `2027-${String(i + 1).padStart(2,"0")}-01`, receber_identificado: "100", pagar_identificado: 80, titulos_receber: 2, titulos_pagar: 1, saldo_contratado_identificado: 20, ultima_importacao_pagar: "2026-11-19T12:00:00Z" }))
    expect(summarizeContractedSchedule(rows)).toEqual({ valid: true, receivables: 1200, payables: 960, net: 240 })
    expect(summarizeContractedSchedule(rows.slice(0,11)).valid).toBe(false)
  })
})
