"use server"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { parseManualInput, type ManualInput } from "@/domains/compras/domain/siscom-manual-inputs"

type OperationResult = { status: "success"; message: string } | { status: "error"; message: string }
type ListResult = { status: "success"; records: ManualInput[] } | { status: "error"; message: string }

async function masterClient() {
  const supabase = await createSupabaseServerClient()
  if (!supabase) throw new Error("Conexão Supabase indisponível.")
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) throw new Error("Sessão expirada. Entre novamente como Master.")
  const { error: authorizationError } = await supabase.rpc("fn_listar_decisoes_compra", { p_chaves: [] })
  if (authorizationError) throw new Error("Somente Master ativo pode consultar e alterar entradas.")
  return { supabase, userId: user.id }
}

function normalize(data: unknown): ManualInput {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new RangeError("Registro de banco inválido.")
  const row = data as Record<string, unknown>
  return parseManualInput({
    tipo: row.tipo,
    competencia: typeof row.competencia === "string" ? row.competencia.slice(0, 7) : "",
    filial: row.filial,
    linha: row.linha,
    sku: row.produto_codigo,
    data: row.data_referencia,
    valor: row.valor,
    observacao: row.observacao,
    atualizadoEm: row.atualizado_em,
  })
}

export async function fetchRemoteManualInputs(): Promise<ListResult> {
  try {
    const { supabase } = await masterClient()
    const { data, error } = await supabase.from("compras_siscom_insumos_pendentes")
      .select("tipo,competencia,filial,linha,produto_codigo,data_referencia,valor,observacao,atualizado_em")
      .order("atualizado_em", { ascending: false }).limit(501)
    if (error || !Array.isArray(data) || data.length > 500) throw new Error("Não foi possível consultar a tabela completa no Supabase.")
    const records = data.map(normalize)
    if (new Set(records.map(record => record.id)).size !== records.length) throw new Error("A tabela contém entradas duplicadas.")
    return { status: "success", records }
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Consulta de entradas indisponível." }
  }
}

export async function saveRemoteManualInputs(input: unknown): Promise<OperationResult> {
  try {
    if (!Array.isArray(input) || input.length === 0 || input.length > 500) throw new RangeError("Informe entre 1 e 500 entradas válidas.")
    const records = input.map(value => {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new RangeError("Entrada inválida.")
      return parseManualInput(value as Record<string, unknown>)
    })
    if (new Set(records.map(row => row.id)).size !== records.length) throw new RangeError("Há entradas repetidas no lote.")
    const { supabase, userId } = await masterClient()
    const updatedAt = new Date().toISOString()
    const payload = records.map(row => ({
      competencia: `${row.competencia}-01`, filial: row.filial, tipo: row.tipo,
      linha: row.linha, produto_codigo: row.sku, data_referencia: row.data,
      valor: row.valor, observacao: row.observacao,
      usuario_id: userId, atualizado_em: updatedAt, situacao: "pendente_integracao",
    }))
    const { error } = await supabase.from("compras_siscom_insumos_pendentes").upsert(payload, {
      onConflict: "competencia,filial,tipo,linha,produto_codigo,data_referencia",
    })
    if (error) throw new Error("A gravação não foi confirmada no Supabase. Nenhuma entrada local foi considerada salva.")
    return { status: "success", message: `${records.length} entrada(s) salvas no Supabase. Aguardando integração SISCOM.` }
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Não foi possível gravar a entrada." }
  }
}

export async function deleteRemoteManualInput(input: unknown): Promise<OperationResult> {
  try {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new RangeError("Entrada inválida.")
    const row = parseManualInput(input as Record<string, unknown>)
    const { supabase } = await masterClient()
    let query = supabase.from("compras_siscom_insumos_pendentes")
      .delete().eq("competencia", `${row.competencia}-01`).eq("filial", row.filial).eq("tipo", row.tipo)
    query = row.linha === null ? query.is("linha", null) : query.eq("linha", row.linha)
    query = row.sku === null ? query.is("produto_codigo", null) : query.eq("produto_codigo", row.sku)
    query = row.data === null ? query.is("data_referencia", null) : query.eq("data_referencia", row.data)
    const { error } = await query
    if (error) throw new Error("A exclusão não foi confirmada no Supabase.")
    return { status: "success", message: "Entrada excluída do Supabase. Nenhuma informação SISCOM foi modificada." }
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Não foi possível excluir a entrada." }
  }
}
