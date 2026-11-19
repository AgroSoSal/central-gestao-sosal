import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"
import { AlertTriangle, ArrowLeft, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { ComprasLogin } from "@/components/compras/compras-auth"
import { LoadingState } from "@/components/shared/mascot-loader"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type Params = { busca?: string; competencia?: string; pagina?: string }
type PlanRow = { grupo_subgrupo: string; competencia: string; dde_meta: number | null; versao: string;
  valor_estoque: string | number | null; cmv_90d: string | number | null;
  dde_observado: string | number | null; itens_estoque: number | null; total_itens: number | string }
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const qtd = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 })
function val(v: string | number | null | undefined) { if (v === null || v === undefined) return null; const n=Number(v);return Number.isFinite(n)?n:null }
function format(v: string | number | null | undefined, asMoney=false) { const n=val(v);return n===null?"—":asMoney?moeda.format(n):qtd.format(n) }
function href(params: {busca:string;competencia:string},page:number) { const q=new URLSearchParams();if(params.busca)q.set("busca",params.busca);if(params.competencia)q.set("competencia",params.competencia);q.set("pagina",String(page));return "/compras/plano-estoque?"+q }

export default function Page({ searchParams }: { searchParams: Promise<Params> }) {
  return <Suspense fallback={<LoadingState label="Carregando Plano de Estoque..."/>}><Content searchParams={searchParams}/></Suspense>
}

async function Content({searchParams}:{searchParams:Promise<Params>}) {
  await connection()
  const supabase=await createSupabaseServerClient()
  if(!supabase)return <ComprasLogin configured={false}/>
  const {data:{user},error:authError}=await supabase.auth.getUser()
  if(authError||!user)return <ComprasLogin configured/>
  const {error:authz}=await supabase.rpc("fn_listar_decisoes_compra",{p_chaves:[]})
  if(authz)return <div role="alert" className="mx-auto max-w-3xl rounded-xl border border-amber-300/30 p-8 text-amber-100">Acesso restrito ao Master ativo.</div>
  const p=await searchParams
  const busca=(p.busca??"").trim().slice(0,80)
  const competencia=/^\d{4}-(0[1-9]|1[0-2])$/.test(p.competencia??"")?`${p.competencia}-01`:""
  const pagina=Number.isInteger(Number(p.pagina))&&Number(p.pagina)>=1&&Number(p.pagina)<=100?Number(p.pagina):1
  const {data,error}=await supabase.rpc("fn_compras_plano_estoque_237",{
    p_busca:busca||null,p_competencia:competencia||null,p_pagina:pagina,p_tamanho:50,
  })
  const rows=error?[]:(data??[]) as PlanRow[]
  const total=val(rows[0]?.total_itens)??0
  const totalPages=Math.max(1,Math.ceil(total/50))
  const today=new Date()
  const monthStart=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),1))
  const months=Array.from({length:12},(_,i)=>{
    const d=new Date(Date.UTC(monthStart.getUTCFullYear(),monthStart.getUTCMonth()+i,1))
    return {value:d.toISOString().slice(0,7),label:d.toLocaleDateString("pt-BR",{timeZone:"UTC",month:"long",year:"numeric"})}
  })
  return <main className="mx-auto max-w-[1520px] space-y-6 pb-16 text-slate-100">
    <Link href="/compras" className="inline-flex items-center gap-2 text-xs font-bold text-cyan-300"><ArrowLeft size={16}/> Voltar a Compras</Link>
    <section className="erp-surface rounded-3xl p-7 sm:p-9"><p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.15em] text-cyan-300"><CalendarDays size={17}/> Zacarini 2.3.7 · seis meses</p><h1 className="mt-4 text-3xl font-bold tracking-tight">Plano de Estoque</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">Metas de dias de estoque por subgrupo e competência, vinculadas às posições e ao CMV dos últimos 90 dias do Supabase. A meta é referência gerencial, não liberação de orçamento ou previsão mensal de compras.</p><div className="mt-5 flex flex-wrap gap-3 text-xs"><Link href="/compras/otb" className="text-cyan-300 hover:underline">OTB · Planejamento</Link><Link href="/compras/estoque-parado" className="text-cyan-300 hover:underline">Estoque parado</Link><Link href="/compras/liquidacao-linhas" className="text-cyan-300 hover:underline">Liquidação por linhas</Link></div></section>
    <div role="status" className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-5 text-xs leading-6 text-amber-100"><strong>Conferência necessária:</strong> das 56 metas versionadas, alguns nomes não correspondem literalmente aos subgrupos de estoque devido a caracteres e exportações diferentes. Esses casos mostram “—” para o saldo e o DDE observado, sem fazer junção por semelhança nem presumir valor. CMV é uma leitura histórica, não demanda futura homologada.</div>
    <section className="erp-surface rounded-2xl p-5"><form method="get" action="/compras/plano-estoque" className="flex flex-wrap items-end gap-3"><label className="min-w-[230px] flex-1 text-xs font-semibold text-slate-300">Buscar subgrupo<input name="busca" defaultValue={busca} maxLength={80} className="erp-field mt-2 w-full px-3" placeholder="Nutrição, medicamentos..."/></label><label className="text-xs font-semibold text-slate-300">Competência<select name="competencia" defaultValue={competencia.slice(0,7)} className="erp-field mt-2 min-w-48 px-3"><option value="">Todas as competências</option>{months.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}</select></label><button type="submit" className="h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 text-xs font-bold text-white">Consultar</button><Link href="/compras/plano-estoque" className="pb-3 text-xs text-slate-400 hover:text-cyan-300">Limpar</Link></form></section>
    {error ? <div role="alert" className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-6 text-sm text-amber-100"><AlertTriangle/> Não foi possível ler as metas protegidas. Nenhuma posição foi presumida.</div> : <section className="erp-surface overflow-hidden rounded-2xl"><div className="flex flex-wrap items-center justify-between border-b border-slate-700/40 p-5"><h2 className="font-bold">Metas e posição histórica</h2><span className="text-xs text-slate-400">{total} registros · página {pagina} de {totalPages}</span></div><div className="overflow-x-auto"><table className="erp-table w-full min-w-[1050px] text-left text-xs"><thead className="bg-[#121e30] text-[10px] uppercase tracking-wider text-slate-400"><tr>{["Subgrupo","Competência","Meta DDE","DDE observado","Estoque a custo","CMV 90d","SKUs/filial","Versão","Análise"].map(h=><th key={h} className="px-5 py-4">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{rows.map((r,i)=><tr key={`${r.grupo_subgrupo}-${r.competencia}-${i}`}><td className="max-w-96 px-5 py-4 font-medium text-slate-100">{r.grupo_subgrupo}</td><td className="whitespace-nowrap px-5 py-4">{r.competencia?.slice(0,7)}</td><td className="px-5 py-4 text-right font-bold text-cyan-300">{r.dde_meta ?? "—"}</td><td className="px-5 py-4 text-right">{format(r.dde_observado)}</td><td className="px-5 py-4 text-right">{format(r.valor_estoque,true)}</td><td className="px-5 py-4 text-right">{format(r.cmv_90d,true)}</td><td className="px-5 py-4 text-right">{format(r.itens_estoque)}</td><td className="px-5 py-4">{r.versao}</td><td className="px-5 py-4"><Link href={`/compras/estoque-parado?busca=${encodeURIComponent(r.grupo_subgrupo)}`} className="font-semibold text-cyan-300 hover:underline">Ver produtos</Link></td></tr>)}{rows.length===0&&<tr><td colSpan={9} className="px-5 py-12 text-center text-slate-400">Nenhuma meta encontrada para estes filtros.</td></tr>}</tbody></table></div><div className="flex items-center justify-end gap-2 border-t border-slate-700/40 p-4">{pagina>1&&<Link href={href({busca,competencia:competencia.slice(0,7)},pagina-1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs text-cyan-300"><ChevronLeft size={13}/> Anterior</Link>}{pagina<totalPages&&<Link href={href({busca,competencia:competencia.slice(0,7)},pagina+1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs text-cyan-300">Próxima <ChevronRight size={13}/></Link>}</div></section>}
  </main>
}
