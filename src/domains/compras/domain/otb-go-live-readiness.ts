/** Protocolo da RPC Master que exibe a trilha de homologação da Projeção 12M.
 * Dados de banco são evidência, não autorização automática de compras.
 */
export type OtbGoLiveStatus = {
  data_base: string
  caixa: {
    contas: number
    saldos: number
    conciliadas: number
    faltando_extrato: number
    caixa_oficial_conciliado: boolean
    saldo_operacional_parcial: number | string | null
  }
  arquivos: {
    importados: number
    auditados: number
    divergentes: number
    cargas_anteriores_sem_ateste: number
    reenvios_sem_movimento_informado: number
  }
  premissas: {
    referencias: number
    homologadas: number
    versoes_financeiras: number
  }
  projecao: {
    linhas_homologadas: number
    horizonte_completo: boolean
  }
  pendencias: { tipo: string; conta: string | null; descricao: string }[]
  teto_otb_autorizado: boolean
  ressalva: string
}
export type OtbGoLiveAssessment = {
  available: boolean
  safeToRelease: boolean
  blockers: string[]
}
function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

/** Falha fechada: mesmo um payload alegando 'autorizado' não substitui verificações. */
export function assessOtbGoLive(data: OtbGoLiveStatus | null): OtbGoLiveAssessment {
  if (!data || !data.caixa || !data.arquivos || !data.premissas || !data.projecao ||
    !Array.isArray(data.pendencias) ||
    !count(data.caixa.contas) || !count(data.caixa.saldos) || !count(data.caixa.conciliadas) ||
    !count(data.caixa.faltando_extrato) || typeof data.caixa.caixa_oficial_conciliado !== "boolean" ||
    !count(data.arquivos.importados) || !count(data.arquivos.auditados) ||
    !count(data.arquivos.divergentes) || !count(data.arquivos.cargas_anteriores_sem_ateste) ||
    !count(data.arquivos.reenvios_sem_movimento_informado) ||
    !count(data.premissas.referencias) || !count(data.premissas.homologadas) ||
    !count(data.premissas.versoes_financeiras) || !count(data.projecao.linhas_homologadas) ||
    typeof data.projecao.horizonte_completo !== "boolean" ||
    typeof data.teto_otb_autorizado !== "boolean" ||
    data.pendencias.some(item => !item || typeof item.tipo !== "string" ||
      (item.conta !== null && typeof item.conta !== "string") ||
      typeof item.descricao !== "string")) {
    return { available: false, safeToRelease: false, blockers: ["A verificação protegida do Supabase está indisponível ou inconsistente."] }
  }
  const blockers: string[] = []
  if (!data.caixa.caixa_oficial_conciliado || data.caixa.contas === 0 ||
    data.caixa.saldos !== data.caixa.contas || data.caixa.conciliadas !== data.caixa.contas ||
    data.caixa.faltando_extrato > 0) {
    blockers.push("Conciliar os saldos de todas as contas com os extratos oficiais dos bancos.")
  }
  if (data.arquivos.divergentes > 0) blockers.push("Resolver diferenças nas importações dos extratos.")
  if (data.arquivos.importados === 0 || data.arquivos.auditados < data.arquivos.importados) {
    blockers.push("Auditar todas as importações bancárias antes da homologação.")
  }
  if (data.pendencias.length > 0) {
    blockers.push("Resolver as pendências operacionais explícitas do caixa no Supabase.")
  }
  if (data.premissas.referencias > 0 || data.premissas.homologadas === 0 || data.premissas.versoes_financeiras === 0) {
    blockers.push("Homologar as premissas financeiras atuais (as referências Zacarini não são aprovação operacional).")
  }
  if (data.projecao.linhas_homologadas < 12 || !data.projecao.horizonte_completo) {
    blockers.push("Completar e aprovar a Projeção 12M de pior caso com 12 competências.")
  }
  if (data.arquivos.cargas_anteriores_sem_ateste > 0) {
    blockers.push("Confirmar a cobertura do extrato consolidado pendente.")
  }
  // Mesmo todos os campos de contagem completos não bastam para autorizar compras:
  // origem, MP, DDE e alçadas precisam da aprovação explícita via fluxo OTB.
  if (!data.teto_otb_autorizado) {
    blockers.push("Homologar matéria-prima, DDE, pedidos e teto OTB com alçada Master.")
  }
  return { available: true, safeToRelease: blockers.length === 0, blockers }
}
