import type { ContractedMonth } from "./otb-bank-readiness"

/**
 * Ponte aritmética do caixa conhecido com os títulos identificados.
 * NÃO é Projeção 12M oficial, previsão de liquidez ou limite para compras.
 * Sem despesas não importadas, vendas futuras, títulos pendentes ou conciliação.
 */
export type OperationalBankBasis = {
  data_base: string
  contas_cadastradas: number
  contas_com_saldo: number
  contas_sem_extrato: number
  contas_conciliadas: number
  saldo_parcial_conhecido_siscom: number | string | null
}
export type ContractedCashMonth = {
  mes: string
  base_abertura: number
  receber_identificado: number
  pagar_identificado: number
  variacao_identificada: number
  base_apos_titulos: number
  titulos_receber: number
  titulos_pagar: number
}
export type ContractedCashBridge =
  | { state: "indisponivel"; motivo: string; authorizesPurchases: false }
  | {
      state: "parcial"
      authorizesPurchases: false
      dataBase: string
      saldoParcialInicial: number
      minimoSomenteTitulos: number
      ultimoSaldoSomenteTitulos: number
      cargaFornecedores: string
      conciliacoes: number
      contas: number
      months: ContractedCashMonth[]
    }

function cents(raw: number | string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "" || (typeof raw === "string" && raw.trim() === "")) return null
  const number = Number(raw)
  if (!Number.isFinite(number) || Math.abs(number) > 1e12) return null
  return Math.round(number * 100)
}

function validCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function monthIndex(value: string): number | null {
  if (!/^20\\d{2}-(0[1-9]|1[0-2])-01$/.test(value)) return null
  const [year, month] = value.split("-").map(Number)
  return year * 12 + month - 1
}

function unavailable(motivo: string): ContractedCashBridge {
  return { state: "indisponivel", motivo, authorizesPurchases: false }
}

export function calculateContractedCashBridge(
  bank: OperationalBankBasis | null | undefined,
  schedule: readonly ContractedMonth[],
): ContractedCashBridge {
  if (!bank || !/^20\\d{2}-(0[1-9]|1[0-2])-[0-3]\\d$/.test(bank.data_base) ||
    !validCount(bank.contas_cadastradas) || bank.contas_cadastradas === 0 ||
    !validCount(bank.contas_com_saldo) || !validCount(bank.contas_sem_extrato) ||
    !validCount(bank.contas_conciliadas) ||
    bank.contas_com_saldo !== bank.contas_cadastradas || bank.contas_sem_extrato > 0 ||
    bank.contas_conciliadas > bank.contas_cadastradas) {
    return unavailable("Inventário de contas incompleto; nenhuma base de abertura pode ser calculada.")
  }
  const opening = cents(bank.saldo_parcial_conhecido_siscom)
  if (opening === null) return unavailable("Saldo operacional parcial ausente ou inválido.")
  if (schedule.length !== 12) return unavailable("A carteira contratada não cobre as 12 competências.")
  const first = monthIndex(schedule[0]?.mes ?? "")
  if (first === null || first !== monthIndex(bank.data_base.slice(0, 7) + "-01")) {
    return unavailable("A carteira não começa na competência da data-base.")
  }
  const load = schedule[0]?.ultima_importacao_pagar
  if (!load || !Number.isFinite(Date.parse(load))) {
    return unavailable("A origem e a data da carga dos fornecedores não foram identificadas.")
  }
  let running = opening
  let min = opening
  const months: ContractedCashMonth[] = []
  for (const [i, item] of schedule.entries()) {
    if (monthIndex(item.mes) !== first + i) {
      return unavailable("As competências da carteira não são consecutivas e únicas.")
    }
    const received = cents(item.receber_identificado)
    const payable = cents(item.pagar_identificado)
    const givenNet = cents(item.saldo_contratado_identificado)
    const receivableCount = Number(item.titulos_receber)
    const payableCount = Number(item.titulos_pagar)
    if (received === null || payable === null || givenNet === null ||
      received < 0 || payable < 0 || Math.abs(givenNet - (received - payable)) > 1 ||
      !Number.isSafeInteger(receivableCount) || receivableCount < 0 ||
      !Number.isSafeInteger(payableCount) || payableCount < 0) {
      return unavailable("Valores, totais ou quantidades da carteira não conferem.")
    }
    if (item.ultima_importacao_pagar !== load) {
      return unavailable("As competências de fornecedores não compartilham a mesma carga.")
    }
    const before = running
    running += received - payable
    if (!Number.isSafeInteger(running)) return unavailable("Acúmulo dos títulos excede o intervalo numérico seguro.")
    min = Math.min(min, running)
    months.push({
      mes: item.mes,
      base_abertura: before / 100,
      receber_identificado: received / 100,
      pagar_identificado: payable / 100,
      variacao_identificada: (received - payable) / 100,
      base_apos_titulos: running / 100,
      titulos_receber: receivableCount,
      titulos_pagar: payableCount,
    })
  }
  return {
    state: "parcial", authorizesPurchases: false,
    dataBase: bank.data_base,
    saldoParcialInicial: opening / 100,
    minimoSomenteTitulos: min / 100,
    ultimoSaldoSomenteTitulos: running / 100,
    cargaFornecedores: load,
    conciliacoes: bank.contas_conciliadas,
    contas: bank.contas_cadastradas,
    months,
  }
}
