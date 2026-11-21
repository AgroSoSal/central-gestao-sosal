/** Preparação local de dados para o SISCOM. Não é uma fonte financeira homologada. */
export const MANUAL_INPUT_TYPES = {
  custo_diario_previsto: { label: "Custo diário previsto · Atendimento K22", dimension: "geral", unit: "R$/dia" },
  primeira_data_liberada: { label: "Primeira data liberada · OTB B17 / K23", dimension: "data", unit: "data" },
  limite_caixa_acumulado: { label: "Caixa acumulado por vencimento · K24", dimension: "data-valor", unit: "R$" },
  saldo_verba_linha: { label: "Verba livre da linha · Atendimento K25", dimension: "linha", unit: "R$" },
  saldo_inicial_caixa: { label: "Caixa inicial · Premissas 12M", dimension: "geral", unit: "R$" },
  recebimento_previsto: { label: "Recebimentos previstos · Projeção 12M", dimension: "data-valor", unit: "R$" },
  pagamento_previsto: { label: "Pagamentos previstos · Projeção 12M", dimension: "data-valor", unit: "R$" },
  estoque_quantidade: { label: "Estoque do SKU · Plano de Estoque", dimension: "sku", unit: "un" },
  vendas_90_dias: { label: "Venda do SKU em 90 dias · DDE", dimension: "sku", unit: "un" },
  pedido_pendente: { label: "Quantidade pendente do SKU · Compras", dimension: "sku", unit: "un" },
  ultimo_custo: { label: "Custo unitário do SKU · Atendimento", dimension: "sku", unit: "R$/un" },
  peso_produto: { label: "Peso do SKU · Produção Própria", dimension: "sku", unit: "kg" },
  industrializacao_tonelada: { label: "Industrialização por tonelada · Produção", dimension: "sku", unit: "R$/t" },
  frete_tonelada: { label: "Frete por tonelada · Produção Própria", dimension: "sku", unit: "R$/t" },
} as const

export type ManualInputType = keyof typeof MANUAL_INPUT_TYPES
export type ManualInput = {
  id: string; tipo: ManualInputType; competencia: string; filial: string;
  linha: number | null; sku: string | null; data: string | null; valor: number | null;
  observacao: string; atualizadoEm: string
}

const validBranches = ["REDE", "BDS", "CG", "RIO", "CX", "PG", "AN"] as const
const validDate = (raw: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(raw) &&
  !Number.isNaN(Date.parse(`${raw}T00:00:00Z`)) &&
  new Date(`${raw}T00:00:00Z`).toISOString().slice(0, 10) === raw
const valueString = (value: unknown): string => typeof value === "string" ? value.trim() :
  typeof value === "number" && Number.isFinite(value) ? String(value) : ""

export function manualInputKey(input: Pick<ManualInput, "tipo" | "competencia" | "filial" | "linha" | "sku" | "data">): string {
  return [input.tipo, input.competencia, input.filial, input.linha ?? "", input.sku ?? "", input.data ?? ""].join("|")
}

export function parseManualInput(input: Record<string, unknown>): ManualInput {
  const tipo = valueString(input.tipo)
  if (!(tipo in MANUAL_INPUT_TYPES)) throw new RangeError("Tipo de lançamento inválido.")
  const type = tipo as ManualInputType
  const { dimension } = MANUAL_INPUT_TYPES[type]
  const competencia = valueString(input.competencia)
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) throw new RangeError("Competência inválida.")
  const filial = valueString(input.filial)
  if (!validBranches.some(item => item === filial)) throw new RangeError("Filial inválida.")
  const dataRaw = valueString(input.data)
  const needsDate = dimension === "data" || dimension === "data-valor"
  if (needsDate && !validDate(dataRaw)) throw new RangeError("Data de referência inválida.")
  const data = needsDate ? dataRaw : null
  const lineRaw = valueString(input.linha)
  if (dimension === "linha" && !["1", "2", "3", "4"].includes(lineRaw)) throw new RangeError("Informe a linha 1 a 4.")
  const linha = dimension === "linha" ? Number(lineRaw) : null
  const skuRaw = valueString(input.sku)
  if (dimension === "sku" && (!/^[a-zA-Z0-9_.-]{1,40}$/.test(skuRaw))) throw new RangeError("Código do produto inválido.")
  const sku = dimension === "sku" ? skuRaw : null
  const valorRaw = valueString(input.valor)
  let valor: number | null = null
  if (dimension !== "data") {
    const decimals = tipo === "peso_produto" ? 3 : 2
    if (!new RegExp(`^-?\\d+(?:[.,]\\d{1,${decimals}})?$`).test(valorRaw))
      throw new RangeError(`Informe um valor numérico com até ${decimals} decimais.`)
    valor = Number(valorRaw.replace(",", "."))
    if (!Number.isFinite(valor) || Math.abs(valor) > 1_000_000_000_000) throw new RangeError("Valor fora do limite.")
    if (tipo !== "saldo_verba_linha" && tipo !== "saldo_inicial_caixa" && valor < 0) throw new RangeError("O valor não pode ser negativo.")
    if (tipo === "custo_diario_previsto" && valor === 0) throw new RangeError("Custo diário previsto deve ser maior que zero.")
  }
  const observacao = valueString(input.observacao)
  if (observacao.length > 500) throw new RangeError("Observação excede 500 caracteres.")
  const row: ManualInput = { id: "", tipo: type, competencia, filial, linha, sku, data, valor, observacao,
    atualizadoEm: new Date().toISOString() }
  row.id = manualInputKey(row)
  if (input.id !== undefined && input.id !== row.id) throw new RangeError("Chave de lançamento incompatível.")
  if (input.atualizadoEm !== undefined) {
    const saved = valueString(input.atualizadoEm)
    if (!/^\d{4}-\d{2}-\d{2}T/.test(saved) || Number.isNaN(Date.parse(saved))) throw new RangeError("Data de auditoria inválida.")
    row.atualizadoEm = saved
  }
  return row
}

export function upsertManualInput(rows: readonly ManualInput[], incoming: ManualInput): ManualInput[] {
  return [...rows.filter(row => row.id !== incoming.id), incoming]
}

export function parseManualInputBackup(raw: string): ManualInput[] {
  if (raw.length > 2_000_000) throw new RangeError("Backup excede o limite de 2 MB.")
  let decoded: unknown
  try { decoded = JSON.parse(raw) } catch { throw new RangeError("Arquivo JSON inválido.") }
  if (!decoded || typeof decoded !== "object" || !("versao" in decoded) || decoded.versao !== 1 ||
      !("registros" in decoded) || !Array.isArray(decoded.registros) || decoded.registros.length > 500) {
    throw new RangeError("Formato ou versão de backup inválido.")
  }
  const records: ManualInput[] = []
  for (const row of decoded.registros) {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new RangeError("Lançamento inválido no backup.")
    const verified = parseManualInput(row as Record<string, unknown>)
    if (records.some(existing => existing.id === verified.id)) throw new RangeError("Lançamento duplicado no backup.")
    records.push(verified)
  }
  return records
}

/** K22-K25: extrai somente fontes manuais na competência e filial selecionadas.
 * Não mistura simulação com a carteira homologada do Supabase. */
export function buildAttendanceManualScenario(rows: readonly ManualInput[], competencia: string, filial: string) {
  const applicable = rows.filter(row => row.competencia === competencia && row.filial === filial)
  const findValue = (kind: ManualInputType, line?: number) => applicable.find(row => row.tipo === kind && (line === undefined || row.linha === line))
  const budgets: Record<number, number> = {}
  for (const line of [1, 2, 3, 4]) {
    const value = findValue("saldo_verba_linha", line)?.valor
    if (value !== null && value !== undefined) budgets[line] = value
  }
  return {
    dailyCost: findValue("custo_diario_previsto")?.valor ?? null,
    releaseDate: findValue("primeira_data_liberada")?.data ?? null,
    cashLimits: applicable.filter(row => row.tipo === "limite_caixa_acumulado" && row.data && row.valor !== null)
      .map(row => ({ data: row.data!, limite: row.valor! })).sort((a, b) => a.data.localeCompare(b.data)),
    lineBudgets: budgets,
  }
}
