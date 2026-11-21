import { describe, expect, it } from "vitest"
import {
  buildAttendanceManualScenario,
  parseManualInput,
  parseManualInputBackup,
  upsertManualInput,
} from "./siscom-manual-inputs"

const base = { competencia: "2026-12", filial: "CG", observacao: "Conferência local" }

describe("insumos manuais para integração SISCOM futura", () => {
  it("valida tipo, competência, data e dimensão obrigatória, sem inferir zero", () => {
    expect(() => parseManualInput({ ...base, tipo: "saldo_verba_linha", linha: "", valor: "500" })).toThrow(/linha/i)
    expect(() => parseManualInput({ ...base, tipo: "limite_caixa_acumulado", data: "2026-02-30", valor: "500" })).toThrow(/data/i)
    expect(() => parseManualInput({ ...base, tipo: "custo_diario_previsto", valor: "" })).toThrow(/valor/i)
    expect(() => parseManualInput({ ...base, tipo: "primeira_data_liberada", data: "2026-12-25" })).not.toThrow()
    expect(parseManualInput({ ...base, tipo: "saldo_verba_linha", linha: "3", valor: "-10" }).valor).toBe(-10)
    expect(parseManualInput({ ...base, tipo: "peso_produto", sku: "90001", valor: "0.125" }).valor).toBe(0.125)
    expect(() => parseManualInput({ ...base, tipo: "saldo_verba_linha", linha: "3", valor: "1e22" })).toThrow()
  })

  it("atualiza a chave lógica sem duplicar vencimento ou saldo da mesma linha", () => {
    const first = parseManualInput({ ...base, tipo: "saldo_verba_linha", linha: "2", valor: "100" })
    const second = parseManualInput({ ...base, tipo: "saldo_verba_linha", linha: "2", valor: "120" })
    const other = parseManualInput({ ...base, tipo: "saldo_verba_linha", linha: "3", valor: "80" })
    expect(upsertManualInput(upsertManualInput([first], second), other)).toEqual([second, other])
  })

  it("reconstrói calendário cumulativo por data exata e isola filial/competência", () => {
    const records = [
      parseManualInput({ ...base, tipo: "custo_diario_previsto", valor: "20" }),
      parseManualInput({ ...base, tipo: "primeira_data_liberada", data: "2027-01-10" }),
      parseManualInput({ ...base, tipo: "limite_caixa_acumulado", data: "2027-03-01", valor: "700" }),
      parseManualInput({ ...base, tipo: "limite_caixa_acumulado", data: "2027-02-01", valor: "300" }),
      parseManualInput({ ...base, tipo: "saldo_verba_linha", linha: "1", valor: "-30" }),
      parseManualInput({ ...base, tipo: "saldo_verba_linha", linha: "2", valor: "180" }),
      parseManualInput({ ...base, tipo: "saldo_verba_linha", linha: "3", valor: "90" }),
      parseManualInput({ ...base, tipo: "saldo_verba_linha", linha: "4", valor: "70" }),
      parseManualInput({ ...base, filial: "CX", tipo: "custo_diario_previsto", valor: "999" }),
    ]
    expect(buildAttendanceManualScenario(records, "2026-12", "CG")).toEqual({
      dailyCost: 20,
      releaseDate: "2027-01-10",
      cashLimits: [{ data: "2027-02-01", limite: 300 }, { data: "2027-03-01", limite: 700 }],
      lineBudgets: { 1: -30, 2: 180, 3: 90, 4: 70 },
    })
    expect(buildAttendanceManualScenario(records, "2027-01", "CG").dailyCost).toBeNull()
  })

  it("importa apenas backup completo validado, não injeta registros parciais", () => {
    const record = parseManualInput({ ...base, tipo: "custo_diario_previsto", valor: "50" })
    expect(parseManualInputBackup(JSON.stringify({ versao: 1, registros: [record] }))).toEqual([record])
    expect(() => parseManualInputBackup(JSON.stringify({ versao: 1, registros: [record, { ...record, valor: "NaN" }] }))).toThrow()
    expect(() => parseManualInputBackup(JSON.stringify({ versao: 2, registros: [] }))).toThrow()
  })
})
