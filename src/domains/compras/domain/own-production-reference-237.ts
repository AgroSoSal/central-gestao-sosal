/** Premissas transcritas da versão 2.3.7; não são custos técnicos homologados. */
export type OwnProductionReference237 = {
  produto_cod: string
  descricao: string
  peso_kg: number
  custo_extra_unidade: number
  origem_peso: string
  origem_custo: string
}

export type OwnProductionConfigRow237 = {
  codigo: string
  grupo: string
  dimensao: string | null
  competencia: string | null
  valor: number | string | null
  texto: string | null
  origem_aba: string
  origem_celula: string
  versao: string
  situacao: string
}

export function parseOwnProductionReferences237(rows: OwnProductionConfigRow237[]): OwnProductionReference237[] {
  const bySku = new Map<string, { peso?: OwnProductionConfigRow237; custo?: OwnProductionConfigRow237; invalid?: boolean }>()
  for (const row of rows) {
    const sku = row.dimensao
    if (row.grupo !== "producao_referencia" || row.versao !== "2.3.7" ||
      row.origem_aba !== "Produção Própria" || row.competencia !== null ||
      !["referencia", "homologado"].includes(row.situacao) || !sku || !/^\d+$/.test(sku)) continue
    const kind = row.codigo === `producao_peso_kg_${sku}` ? "peso" :
      row.codigo === `producao_custo_extra_un_${sku}` ? "custo" : null
    if (!kind) continue
    const entry = bySku.get(sku) ?? {}
    if (entry[kind]) entry.invalid = true
    entry[kind] = row
    bySku.set(sku, entry)
  }
  return [...bySku.entries()].flatMap(([sku, entry]) => {
    const peso = entry.peso
    const custo = entry.custo
    if (entry.invalid || !peso || !custo || !/^C\d+$/.test(peso.origem_celula) ||
      custo.origem_celula !== peso.origem_celula.replace(/^C/, "D")) return []
    const weight = Number(peso.valor)
    const extra = Number(custo.valor)
    if (peso.valor === null || custo.valor === null || !Number.isFinite(weight) ||
      !Number.isFinite(extra) || weight <= 0 || extra < 0) return []
    return [{ produto_cod: sku, descricao: peso.texto ?? custo.texto ?? "",
      peso_kg: weight, custo_extra_unidade: extra,
      origem_peso: peso.origem_celula, origem_custo: custo.origem_celula }]
  }).sort((a, b) => a.produto_cod.localeCompare(b.produto_cod, "pt-BR", { numeric: true }))
}
