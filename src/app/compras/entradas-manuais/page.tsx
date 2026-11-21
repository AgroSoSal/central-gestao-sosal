import { Suspense } from "react"
import { connection } from "next/server"
import Link from "next/link"
import { ComprasLogin } from "@/components/compras/compras-auth"
import { ManualSiscomInputs } from "@/components/compras/siscom-manual-inputs"
import { LoadingState } from "@/components/shared/mascot-loader"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export default function EntradasManuaisPage() {
  return <Suspense fallback={<LoadingState label="Conferindo acesso à preparação SISCOM..." />}><EntradasManuaisContent /></Suspense>
}

export async function EntradasManuaisContent() {
  await connection()
  const supabase = await createSupabaseServerClient()
  if (!supabase) return <ComprasLogin configured={false} />
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) return <ComprasLogin configured />

  // Mesmo controle Master ativo das demais telas. Sem leitura de tabelas SISCOM.
  const { error: permissionError } = await supabase.rpc("fn_listar_decisoes_compra", { p_chaves: [] })
  if (permissionError) return <main className="mx-auto max-w-2xl space-y-5 p-8 text-slate-100">
    <h1 className="text-xl font-bold">Acesso restrito ao Master ativo</h1>
    <p className="text-sm text-amber-100">O banco não confirmou sua autorização. Nenhuma entrada manual foi aberta.</p>
    <Link href="/compras" className="text-cyan-300 underline">Voltar a Compras</Link>
  </main>
  return <ManualSiscomInputs userId={user.id} remote />
}
