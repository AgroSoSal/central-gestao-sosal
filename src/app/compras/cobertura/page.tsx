import Link from "next/link"
import { connection } from "next/server"
import { ShieldCheck, ArrowLeft, AlertTriangle } from "lucide-react"
import { ComprasLogin, ComprasSair } from "@/components/compras/compras-auth"
import { PurchaseModuleMap } from "@/components/compras/purchase-module-map"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export default async function ComprasCoberturaPage() {
  await connection()
  const supabase = await createSupabaseServerClient()
  if (!supabase) return <ComprasLogin configured={false} />
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return <ComprasLogin configured />
  const { error: permissionError } = await supabase.rpc("fn_listar_decisoes_compra", { p_chaves: [] })
  if (permissionError) return <main role="alert" className="mx-auto max-w-2xl rounded-2xl border border-amber-400/20 bg-amber-400/10 p-7 text-amber-100"><AlertTriangle /><h1 className="mt-3 text-xl font-bold">Acesso restrito ao Master ativo</h1><p className="mt-2 text-sm">Não foi possível confirmar sua permissão no Supabase.</p><Link href="/compras" className="mt-4 inline-block text-cyan-200 underline">Voltar para Compras</Link></main>

  return <main className="mx-auto max-w-[1520px] space-y-6 pb-14 text-slate-100">
    <header className="flex flex-wrap items-center justify-between gap-3"><Link href="/compras" className="inline-flex items-center gap-2 text-xs font-bold text-cyan-200"><ArrowLeft size={16} /> Voltar para Compras</Link><div className="flex items-center gap-3 text-xs text-slate-400"><ShieldCheck size={15} className="text-emerald-300" /> {user.email}<ComprasSair /></div></header>
    <section className="erp-surface rounded-[28px] p-7 sm:p-10"><p className="text-xs font-bold uppercase tracking-[.17em] text-cyan-300">Governança · Compras</p><h1 className="mt-3 text-3xl font-bold sm:text-4xl">Cobertura da <span className="text-cyan-300">Zacarini 2.3.7</span></h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">Veja o que pode ser usado hoje e quais funções ainda precisam de dados ou integração. A atualização dos extratos pode ser feita depois; a verba oficial continuará protegida até a homologação financeira.</p></section>
    <PurchaseModuleMap />
  </main>
}
