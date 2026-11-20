/** Leitura de caixa preparatória. Verificação aritmética não é conciliação autorizada. */
export type BankPositionRow = {
  conta_ref: string
  filial: string
  banco: string
  data_corte_comum: string | null
  data_ultimo_saldo: string | null
  ultimo_saldo: number | string | null
  data_saldo_base: string | null
  saldo_base: number | string | null
  data_arquivo: string | null
  diferenca_arquivo: number | string | null
  conciliado: boolean
}

export type BankPositionSummary = {
  state: "indisponivel" | "conferido_sem_homologacao" | "divergente"
  commonDate: string | null
  accountCount: number
  openingCash: number | null
  matchedArchives: number
  reconciledAccounts: number
  staleAccounts: number
  warnings: string[]
}

const dateDays = (value: string): number => Date.parse(value + "T12:00:00Z") / 86400000

export function assessBankPosition(rows: BankPositionRow[], currentDate: string): BankPositionSummary {
  const blank: BankPositionSummary = { state: "indisponivel", commonDate: null, accountCount: rows.length, openingCash: null, matchedArchives: 0, reconciledAccounts: 0, staleAccounts: 0, warnings: [] }
  if (!rows.length || !/^\d{4}-\d{2}-\d{2}$/.test(currentDate)) return { ...blank, warnings: ["Nenhuma posição bancária confiável disponível."] }
  const cutoff = rows[0]?.data_corte_comum ?? null
  const accounts = new Set<string>()
  let total = 0
  let matched = 0
  let reconciled = 0
  let stale = 0
  const warnings: string[] = []
  for (const row of rows) {
    if (accounts.has(row.conta_ref)) warnings.push(`Conta duplicada: ${row.conta_ref}.`)
    accounts.add(row.conta_ref)
    const value = Number(row.saldo_base)
    if (!row.data_saldo_base || !cutoff || row.data_corte_comum !== cutoff ||
        !row.data_ultimo_saldo || row.saldo_base === null || !Number.isFinite(value) ||
        !Number.isFinite(dateDays(row.data_saldo_base)) || !Number.isFinite(dateDays(row.data_ultimo_saldo)) ||
        dateDays(row.data_saldo_base) > dateDays(cutoff) ||
        dateDays(row.data_ultimo_saldo) > dateDays(currentDate)) {
      warnings.push(`Base inconsistente para ${row.filial}.`)
    } else total += value
    const diff = row.diferenca_arquivo === null ? null : Number(row.diferenca_arquivo)
    const arquivoCobreBase = !!row.data_arquivo && !!cutoff && Number.isFinite(dateDays(row.data_arquivo))
      && dateDays(row.data_arquivo) >= dateDays(cutoff)
      && dateDays(row.data_arquivo) <= dateDays(currentDate)
    if (!arquivoCobreBase) warnings.push(`Arquivo bancário sem cobertura da data-base para ${row.filial}.`)
    else if (diff !== null && Number.isFinite(diff) && Math.abs(diff) <= 0.01) matched += 1
    else warnings.push(`Saldo do arquivo sem conferência para ${row.filial}.`)
    if (row.conciliado) reconciled += 1
    if (row.data_ultimo_saldo && dateDays(currentDate) - dateDays(row.data_ultimo_saldo) > 2) stale += 1
  }
  if (warnings.length) return { ...blank, commonDate: cutoff, matchedArchives: matched, reconciledAccounts: reconciled, staleAccounts: stale, warnings, state: "divergente" }
  if (reconciled !== rows.length) warnings.push(`${rows.length - reconciled} contas sem homologação formal de conciliação.`)
  if (stale) warnings.push(`${stale} contas estão há mais de 2 dias sem novo saldo.`)
  return { state: "conferido_sem_homologacao", commonDate: cutoff, accountCount: rows.length, openingCash: total, matchedArchives: matched, reconciledAccounts: reconciled, staleAccounts: stale, warnings }
}

export type ContractedMonth = {
  mes: string
  receber_identificado: number | string
  pagar_identificado: number | string
  titulos_receber: number | string
  titulos_pagar: number | string
  saldo_contratado_identificado: number | string
  ultima_importacao_pagar: string | null
}

/** O saldo dos contratos é informação, não uma previsão completa nem teto. */
export function summarizeContractedSchedule(rows: ContractedMonth[]): { valid: boolean; receivables: number; payables: number; net: number } {
  if (rows.length !== 12 || new Set(rows.map(r => r.mes)).size !== 12) return { valid: false, receivables: 0, payables: 0, net: 0 }
  let receivables = 0
  let payables = 0
  for (const row of rows) {
    const received = Number(row.receber_identificado)
    const paid = Number(row.pagar_identificado)
    if (!Number.isFinite(received) || !Number.isFinite(paid) || received < 0 || paid < 0) return { valid: false, receivables: 0, payables: 0, net: 0 }
    receivables += received
    payables += paid
  }
  return { valid: true, receivables, payables, net: receivables - payables }
}
