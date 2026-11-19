"use server"

import { revalidatePath } from "next/cache"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { validateOwnProductionDraft } from "@/domains/compras/domain/own-production-draft"

export type OwnProductionSaveState = { status: "idle" | "error" | "success"; message: string }

export async function saveOwnProductionDraft(_previous: OwnProductionSaveState, formData: FormData): Promise<OwnProductionSaveState> {
  let payload: ReturnType<typeof validateOwnProductionDraft>
  try {
    payload = validateOwnProductionDraft({
      produto_cod: String(formData.get("produto_cod") ?? ""),
      peso_kg: String(formData.get("peso_kg") ?? ""),
      industrializacao_rs_t: String(formData.get("industrializacao_rs_t") ?? ""),
      frete_rs_t: String(formData.get("frete_rs_t") ?? ""),
      observacao: String(formData.get("observacao") ?? ""),
    })
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Parâmetros inválidos." }
  }
  const supabase = await createSupabaseServerClient()
  if (!supabase) return { status: "error", message: "Conexão com banco indisponível." }
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) return { status: "error", message: "Entre novamente com seu usuário Master." }
  // A RPC repete a autorização Master ativo, o vínculo com SKU SO SAL e a validação.
  const { error } = await supabase.rpc("fn_compras_producao_parametros_salvar_237", {
    p_produto_cod: payload.productCode,
    p_peso_kg: payload.weight,
    p_industrializacao_rs_t: payload.industry,
    p_frete_rs_t: payload.freight,
    p_observacao: payload.notes,
  })
  if (error) return { status: "error", message: "Não foi possível gravar o rascunho. Verifique a sessão e o cadastro do produto." }
  revalidatePath("/compras/producao-propria")
  return { status: "success", message: "Rascunho técnico salvo no banco, com auditoria. Ainda não é custo homologado nem libera compras." }
}
