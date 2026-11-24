"use server"

import { revalidatePath } from "next/cache"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { validateOtb12mDraftRows } from "@/domains/compras/domain/otb-projection-draft-12m"

export type Otb12mSaveState = {
  status: "idle" | "success" | "error"
  message: string
  id: number | null
}

export async function saveOtb12mDraft(
  _previous: Otb12mSaveState, formData: FormData,
): Promise<Otb12mSaveState> {
  const fail = (message: string): Otb12mSaveState => ({
    status:"error",message,id:null,
  })
  const base = formData.get("data_base")
  const raw = formData.get("linhas")
  const note = formData.get("observacao")
  if (typeof base !== "string" || typeof raw !== "string" ||
      typeof note !== "string" || raw.length > 20000 || note.length > 500) {
    return fail("O snapshot ultrapassou os limites permitidos ou está incompleto.")
  }
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return fail("Dados da Projeção 12M inválidos.") }
  if (!validateOtb12mDraftRows(parsed,base)) {
    return fail("A projeção deve conter 12 meses completos e consecutivos, sem valores ausentes.")
  }
  const supabase=await createSupabaseServerClient()
  if (!supabase) return fail("Supabase indisponível.")
  const { data: { user },error:authError }=await supabase.auth.getUser()
  if (authError || !user) return fail("Sua sessão expirou. Entre novamente.")
  // Verificação adicional na RPC de gravação: role Master ativo no PostgreSQL.
  const {data,error}=await supabase.rpc("fn_otb_projecao_rascunho_salvar",{
    p_data_base:base,p_linhas:parsed,p_observacao:note.trim(),
  })
  if (error) {
    return fail(error.code==="42501"?
      "Somente Master ativo pode registrar a projeção.":
      "O banco rejeitou o registro. Verifique se a data-base ainda é atual e as 12 competências estão completas.")
  }
  const id=Number(data)
  if (!Number.isSafeInteger(id) || id<1) return fail("A confirmação do Supabase retornou ID inválido.")
  revalidatePath("/compras/otb")
  return {status:"success",message:"Versão registrada para auditoria. NÃO é projeção homologada nem libera compras.",id}
}
