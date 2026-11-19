/** Regras de cobrança da aba "Receber Vencidos", versão 2.3.7. */
export type RecoverableReceivablesLine = {
  filial: string
  titulos_vencidos: number | string
  principal_carteira: number | string
  principal_vencido: number | string
  titulos_recuperaveis: number | string
  principal_recuperavel: number | string
  titulos_sem_principal: number | string
}

export type ReceivablesRecovery = {
  eligible: number
  overduePrincipal: number
  openPrincipal: number
  byBranch: Record<string, { overdueShare: number | null }>
}

export function resolveReceivablesRecovery(rows: readonly RecoverableReceivablesLine[] | null): ReceivablesRecovery | null {
  const branches = ["BDS","CG","RIO","CX","PG","AN"]
  if (!rows || rows.length !== branches.length || new Set(rows.map(r => r.filial)).size !== branches.length ||
    rows.some(r => !branches.includes(r.filial))) return null
  const byBranch: ReceivablesRecovery["byBranch"] = {}
  let eligible=0, overduePrincipal=0, openPrincipal=0
  for (const row of rows) {
    const money = [row.principal_carteira, row.principal_vencido, row.principal_recuperavel].map(v =>
      v === null || v === "" ? NaN : Number(v))
    const counts = [row.titulos_vencidos,row.titulos_recuperaveis,row.titulos_sem_principal].map(Number)
    const [open, overdue, recovered] = money
    const [overdueCount, recoveredCount, missingPrincipal] = counts
    if (money.some(v => !Number.isFinite(v) || v < 0) || counts.some(v => !Number.isSafeInteger(v) || v < 0) ||
      recovered > overdue+0.01 || overdue > open+0.01 || recoveredCount > overdueCount || missingPrincipal>0) return null
    eligible+=recovered
    overduePrincipal+=overdue
    openPrincipal+=open
    byBranch[row.filial]={overdueShare:open>0?overdue/open:null}
  }
  return {eligible,overduePrincipal,openPrincipal,byBranch}
}
