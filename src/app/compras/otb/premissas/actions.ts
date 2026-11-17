"use server"

import { revalidatePath } from "next/cache"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { validateOtbPremises } from "@/domains/compras/domain/otb-premises"

export type PremisesSaveState = { status: "idle" | "success" | "error"; message: string }

export async function saveOtbPremises(_previous: PremisesSaveState, data: FormData): Promise<PremisesSaveState> {
  let input
  try {
    input = validateOtbPremises({
      mes: String(data.get("mes") ?? ""),
      saldo: String(data.get("saldo") ?? ""),
      reserva: String(data.get("reserva") ?? ""),
      observacao: String(data.get("observacao") ?? ""),
    })
  } catch (cause) {
    return { status: "error", message: cause instanceof Error ? cause.message : "Premissas inválidas." }
  }

  const supabase = await createSupabaseServerClient()
  if (!supabase) return { status: "error", message: "Conexão Supabase indisponível." }
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) return { status: "error", message: "Sua sessão expirou. Entre novamente." }

  // Dupla verificação Master: a RPC de escrita repete o controle no PostgreSQL.
  const { error: permissionError } = await supabase.rpc("fn_listar_decisoes_compra", { p_chaves: [] })
  if (permissionError) return { status: "error", message: "Somente Master ativo pode registrar premissas." }

  const { error } = await supabase.rpc("fn_otb_premissas_salvar", {
    p_inicio: input.forecastStart,
    p_saldo: input.openingCash,
    p_colchao: input.cashBuffer,
    p_observacao: input.notes,
  })
  if (error) return { status: "error", message: "Não foi possível salvar no Supabase. Nenhum valor foi considerado como OTB liberada." }

  revalidatePath("/compras/otb/premissas")
  revalidatePath("/compras/otb")
  return {
    status: "success",
    message: "Nova versão registrada no Supabase. A OTB permanece bloqueada até a projeção financeira completa ser homologada.",
  }
}
