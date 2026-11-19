import { describe, expect, it } from "vitest"
import { resolveReceivablesRecovery, type RecoverableReceivablesLine } from "./receivables-recovery-237"

const sample: RecoverableReceivablesLine[] = [
  { filial: "BDS", titulos_vencidos: 1200, principal_carteira: "4900000", principal_vencido: "3500000",
    titulos_recuperaveis: 710, principal_recuperavel: "2500000", titulos_sem_principal: 0 },
  { filial: "CG", titulos_vencidos: 100, principal_carteira: "500000", principal_vencido: "200000",
    titulos_recuperaveis: 70, principal_recuperavel: "150000", titulos_sem_principal: 0 },
  ...["RIO","CX","PG","AN"].map(filial => ({ filial, titulos_vencidos: 0,
    principal_carteira: "0", principal_vencido: "0", titulos_recuperaveis: 0, principal_recuperavel: "0",titulos_sem_principal:0 })),
]

describe("recuperação de vencidos do fluxo Zacarini 2.3.7", () => {
  it("usa somente o principal recuperável por regra de cobrança, nunca o líquido com juros históricos", () => {
    const result = resolveReceivablesRecovery(sample)
    expect(result).not.toBeNull()
    expect(result?.eligible).toBe(2650000)
    expect(result?.overduePrincipal).toBe(3700000)
    expect(result?.openPrincipal).toBe(5400000)
    expect(result?.byBranch.BDS?.overdueShare).toBeCloseTo(3500000/4900000)
    // O valor líquido errado pode ter centenas de milhões de juros de títulos dos anos 2000.
    expect(result?.eligible).not.toBe(320642006.46)
  })

  it("não cria previsão se a RPC falhar, retornar lista incompleta ou números inconsistentes", () => {
    expect(resolveReceivablesRecovery(null)).toBeNull()
    expect(resolveReceivablesRecovery([])).toBeNull()
    expect(resolveReceivablesRecovery(sample.slice(0,1))).toBeNull()
    expect(resolveReceivablesRecovery([...sample, sample[0]])).toBeNull()
    expect(resolveReceivablesRecovery(sample.map(x => ({...x, principal_recuperavel: "99999999"})))).toBeNull()
    expect(resolveReceivablesRecovery(sample.map(x => ({...x, principal_vencido: "-1"})))).toBeNull()
    expect(resolveReceivablesRecovery(sample.map((x,i) => ({...x,titulos_sem_principal:i===0?1:0})))).toBeNull()
  })
})
