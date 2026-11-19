/** Contrato da configuração inicial do Dashboard Zacarini.
 *  O XLSX é consultado uma vez para o seed do banco; NUNCA é fonte de runtime.
 */
export type DashboardReferenceRow = {
  codigo: string
  grupo: string
  dimensao: string | null
  competencia: string | null
  rotulo: string
  texto?: string | null
  valor: number | string | null
  unidade: string
  origem_aba: string
  origem_celula: string
  versao: string
  situacao: "referencia" | "homologado"
}

export type ReferenceValue = {
  valor: number | null
  estado: "referencia" | "homologado" | "indisponivel"
  origem: string | null
}

type DashboardBlockId = "velocimetros" | "caixa" | "indicadores" | "linhas" | "lojas" | "dre" | "graficos"

export const DASHBOARD_BLOCKS: readonly { id: DashboardBlockId; titulo: string; indicadores: readonly string[] }[] = [
  { id: "velocimetros", titulo: "Velocímetros de desempenho", indicadores: ["vendas_mes", "vendas_ano", "margem_bruta", "ebitda", "lucro_liquido"] },
  { id: "caixa", titulo: "Caixa e Projeção 12M", indicadores: ["minimo_com_otb_13s", "minimo_sem_compras_13s", "menor_12m", "saldo_final_12m", "dde_projetado", "alerta_pior_caso"] },
  { id: "indicadores", titulo: "Indicadores operacionais e financeiros", indicadores: ["dde_rede", "estoque_parado", "carteira_vencida", "prazo_recebimento", "servico_divida", "verba_comprador"] },
  { id: "linhas", titulo: "Por linha — vendas × metas, DDE × plano", indicadores: ["meta_mes", "vendido_mes", "percentual_mes", "percentual_ano", "estoque_pedidos", "dde_hoje", "dde_plano", "dde_final", "situacao"] },
  { id: "lojas", titulo: "Por loja — vendas, margem, estoque, receber e parado", indicadores: ["meta_mes", "vendido_mes", "percentual_mes", "percentual_ano", "margem_bruta", "estoque", "dde", "inadimplencia", "estoque_parado", "situacao"] },
  { id: "dre", titulo: "DRE — orçado × realizado", indicadores: ["receita_bruta", "receita_liquida", "cmv", "lucro_bruto", "margem_bruta", "despesas", "ebitda", "margem_ebitda", "lucro_liquido"] },
  { id: "graficos", titulo: "Tendências de caixa, vendas, margens e resultados", indicadores: ["saldo_13_semanas", "cenarios_12m", "vendas_meta", "margens", "ebitda", "lucro_liquido"] },
] as const

/** Inventario extraido de xl/drawings/drawing1.xml (aba Dashboard, 2.3.7).
 *  Inclui as visualizacoes ainda sem serie financeira homologada.
 */
export const DASHBOARD_CHARTS = [
  { id: "saldo_26_semanas", type: "linha", titulo: "Saldo de caixa semanal × mínimo (26 semanas)" },
  { id: "vendas_por_loja", type: "barras", titulo: "Venda × meta do mês por loja" },
  { id: "dde_por_linha", type: "barras", titulo: "DDE por linha: hoje × plano × meta final" },
  { id: "estoque_parado_por_loja", type: "barras", titulo: "Estoque parado por loja" },
  { id: "vendas_mes", type: "velocimetro", titulo: "Vendas do mês" },
  { id: "vendas_ano", type: "velocimetro", titulo: "Vendas no ano" },
  { id: "margem_bruta", type: "velocimetro", titulo: "Margem bruta" },
  { id: "margem_ebitda", type: "velocimetro", titulo: "Margem EBITDA" },
  { id: "lucro_liquido", type: "velocimetro", titulo: "Lucro líquido" },
  { id: "saldo_12m", type: "linha", titulo: "Projeção 12M: saldo no fim do mês" },
  { id: "verba_comprador", type: "barras", titulo: "Verba do comprador: já gravado × saldo" },
].map(chart => ({ ...chart, origem_versao: "2.3.7" })) as readonly {
  id: string; type: "linha" | "barras" | "velocimetro"; titulo: string; origem_versao: string
}[]

const absent: ReferenceValue = { valor: null, estado: "indisponivel", origem: null }

export function dashboardReference(rows: readonly DashboardReferenceRow[], codigo: string, competencia: string | null): ReferenceValue {
  const candidates = rows.filter(row => row.codigo === codigo && row.competencia === competencia && row.versao === "2.3.7")
  if (candidates.length !== 1) return absent
  const row = candidates[0]
  const valor = row.valor === null || row.valor === "" ? NaN : Number(row.valor)
  if (!Number.isFinite(valor) || !row.origem_aba.trim() || !/^[A-Z]{1,3}[1-9]\d*$/.test(row.origem_celula) ||
      (row.situacao !== "referencia" && row.situacao !== "homologado")) return absent
  return { valor, estado: row.situacao, origem: `${row.origem_aba}!${row.origem_celula} · Zacarini ${row.versao}` }
}

/** Percentual de uma meta que ainda pode ser apenas referência do planejamento.
 * Não altera sua situação de aprovação nem confunde zero com ausência.
 */
export function metricWithTarget(realizado: number | null, target: ReferenceValue) {
  const actual = realizado !== null && Number.isFinite(realizado) ? realizado : null
  return {
    realizado: actual,
    meta: target.valor,
    percentual: actual === null || target.valor === null || target.valor <= 0 ? null : actual / target.valor,
    estado: target.estado,
  }
}

export type DashboardSalesRow = {
  filial: string
  loja: string
  linha: number
  visao: string
  vendido_mes: number | string | null
  custo_mes: number | string | null
  lucro_mes: number | string | null
  vendido_ano: number | string | null
}

type SalesBucket = {
  vendidoMes: number
  vendidoAno: number
  saidaBruta: number
  lucroSaida: number
  margemBruta: number | null
  nome: string
}

function validNumber(value: number | string | null): number | null {
  if (value === null || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function emptySales(nome: string): SalesBucket {
  return { nome, vendidoMes: 0, vendidoAno: 0, saidaBruta: 0, lucroSaida: 0, margemBruta: null }
}

export function summarizeDashboardSales(rows: readonly DashboardSalesRow[]) {
  const linhas: Record<number, SalesBucket> = {}
  const lojas: Record<string, SalesBucket> = {}
  const total = emptySales("Rede")
  const validMargin: Record<string, boolean> = {}

  for (const row of rows) {
    // Linha 0 é não classificada e não entra na meta das quatro linhas do Alex.
    if (!row.filial || !Number.isInteger(row.linha) || row.linha < 1 || row.linha > 4) continue
    const linha = linhas[row.linha] ??= emptySales(String(row.linha))
    const loja = lojas[row.filial] ??= emptySales(row.loja || row.filial)
    const mes = validNumber(row.vendido_mes)
    const ano = validNumber(row.vendido_ano)
    if (row.visao === "vendido") {
      for (const bucket of [linha, loja, total]) {
        if (mes !== null) bucket.vendidoMes += mes
        if (ano !== null) bucket.vendidoAno += ano
      }
    } else if (row.visao === "saida") {
      const lucro = validNumber(row.lucro_mes)
      if (mes === null || lucro === null) continue
      for (const bucket of [linha, loja, total]) {
        bucket.saidaBruta += mes
        bucket.lucroSaida += lucro
        validMargin[bucket === linha ? `linha_${row.linha}` : bucket === loja ? `loja_${row.filial}` : "total"] = true
      }
    }
  }
  for (const [key, bucket] of Object.entries(linhas)) {
    if (validMargin[`linha_${key}`] && bucket.saidaBruta > 0) bucket.margemBruta = bucket.lucroSaida / bucket.saidaBruta
  }
  for (const [key, bucket] of Object.entries(lojas)) {
    if (validMargin[`loja_${key}`] && bucket.saidaBruta > 0) bucket.margemBruta = bucket.lucroSaida / bucket.saidaBruta
  }
  if (validMargin.total && total.saidaBruta > 0) total.margemBruta = total.lucroSaida / total.saidaBruta

  return { ...total, linhas, lojas }
}
