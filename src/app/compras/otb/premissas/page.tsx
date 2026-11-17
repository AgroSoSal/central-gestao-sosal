import { Suspense } from "react"
import { connection } from "next/server"
import Link from "next/link"
import { OtbPremissasForm, type ExistingPremise } from "@/components/compras/otb-premissas-form"
import { ComprasLogin } from "@/components/compras/compras-auth"
import { LoadingState } from "@/components/shared/mascot-loader"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export default function OtbPremissasPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  return <Suspense fallback={<LoadingState label="Validando acesso ao planejamento..." />}><PremissasContent searchParams={searchParams} /></Suspense>
}

async function PremissasContent({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  await connection()
  const supabase = await createSupabaseServerClient()
  if (!supabase) return <ComprasLogin configured={false} />
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return <ComprasLogin configured />

  const { error: permissionError } = await supabase.rpc("fn_listar_decisoes_compra", { p_chaves: [] })
  if (permissionError) return <div className="mx-auto max-w-3xl space-y-4 p-8 text-slate-100"><h1 className="text-2xl font-bold">Acesso exclusivo ao Master ativo</h1><p>O Supabase não autorizou este acesso.</p><Link href="/compras/otb" className="text-cyan-300 underline">Voltar ao OTB</Link></div>

  const parts = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "2-digit", timeZone: "America/Campo_Grande" }).formatToParts(new Date())
  const currentMonth = `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`
  const requested = (await searchParams).mes
  const month = requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : currentMonth
  const { data, error } = await supabase.rpc("fn_otb_premissas_listar", { p_inicio: `${month}-01` })
  const versions = !error && Array.isArray(data) ? data as ExistingPremise[] : []

  return <OtbPremissasForm key={month} month={month} versions={versions} enabled={!error} />
}
