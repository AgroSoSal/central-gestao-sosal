import Link from "next/link"
import { Suspense } from "react"
import { connection } from "next/server"
import { AlertTriangle, ArrowLeft, CalendarClock, ClipboardPenLine, Search, ShieldCheck, Truck } from "lucide-react"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ComprasLogin, ComprasSair } from "@/components/compras/compras-auth"
import { BranchFilterSelect } from "@/components/compras/branch-filter-select"
import { FilterSubmitButton } from "@/components/compras/filter-submit-button"
import { FollowUpTable, type FollowUpRecord } from "@/components/compras/follow-up-table"
import type { ManagementPurchaseItem } from "@/components/compras/management-table"
import { LoadingState } from "@/components/shared/mascot-loader"
import { decisionKey, type PurchaseDecisionRecord } from "@/domains/compras/domain/purchase-decisions"
import { isApprovedForFollowUp, purchaseFilteredHref } from "@/domains/compras/domain/purchase-management"

type SearchParams = Record<string, string | string[] | undefined>
type Props = { searchParams: Promise<SearchParams> }
type PurchaseItem = ManagementPurchaseItem & { total_itens: number | string | null }
const PAGE_SIZE = 50
const shops = ["CAMPO GRANDE", "SO SAL", "RIO VERDE", "COXIM", "PEDRO GOMES", "ANASTACIO"] as const
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

function first(value: string | string[] | undefined): string { return typeof value === "string" ? value : Array.isArray(value) ? (value[0] ?? "") : "" }
function date(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(value + "T00:00:00Z")
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value) ? value : null
}
function positiveNumber(value: number | string | null | undefined): number { return Number.isFinite(Number(value)) ? Number(value) : 0 }
function pageHref(filters: { busca: string; loja: string; inicio: string; fim: string }, page: number): string {
  const url = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => { if (value) url.set(key, value) })
  url.set("pagina", String(page))
  return `/compras/follow-up?${url.toString()}`
}

export default function FollowUpPage({ searchParams }: Props) {
  return <Suspense fallback={<LoadingState label="Organizando entregas para acompanhamento…" />}><FollowUpContent searchParams={searchParams} /></Suspense>
}

export async function FollowUpContent({ searchParams }: Props) {
  await connection()
  const supabase = await createSupabaseServerClient()
  if (!supabase) return <ComprasLogin configured={false} />
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return <ComprasLogin configured />

  const params = await searchParams
  const busca = first(params.busca).trim().slice(0, 90)
  const loja = shops.find((branch) => branch === first(params.loja)) ?? ""
  const inicio = date(first(params.inicio)) ?? ""
  const fim = date(first(params.fim)) ?? ""
  const pagina = Math.min(1000, Math.max(1, Number.parseInt(first(params.pagina), 10) || 1))
  const filters = { busca, loja, inicio, fim }
  const returnHref = purchaseFilteredHref("/compras/gerenciar", filters)
  const genericCodes = (process.env.SOSAL_COMPRAS_CODIGOS_GENERICOS ?? "").split(",").map((code) => code.trim()).filter(Boolean)
  const purchasesResult = await supabase.rpc("fn_listar_pedidos_compra_conciliados", {
    p_busca: busca || null, p_loja: loja || null, p_inicio: inicio || null, p_fim: fim || null,
    p_pagina: pagina, p_tamanho: PAGE_SIZE, p_codigos_genericos: genericCodes,
  })

  if (purchasesResult.error) return <div role="alert" className="mx-auto max-w-3xl rounded-2xl border border-amber-400/30 bg-amber-400/10 p-7 text-amber-100"><AlertTriangle size={22} /><h1 className="mt-4 text-xl font-bold">Não foi possível conciliar pedidos e recebimentos</h1><p className="mt-2 text-sm">O Follow-up não presume saldo de entrega sem as NFs; confira a função de conciliação e a autorização Master.</p><Link href={returnHref} className="mt-4 inline-flex text-cyan-200 underline">Voltar à gestão</Link></div>

  const sourceRecords = (purchasesResult.data ?? []) as PurchaseItem[]
  const items = sourceRecords.filter((row) => row.loja && row.pedido && row.produto_codigo)
  const keys = items.map((row) => ({ loja: row.loja!, pedido: row.pedido!, produto_codigo: row.produto_codigo! }))
  const decisionsResult = await supabase.rpc("fn_listar_decisoes_compra", { p_chaves: keys })
  if (decisionsResult.error) return <div role="alert" className="mx-auto max-w-3xl rounded-2xl border border-amber-400/30 bg-amber-400/10 p-7 text-amber-100"><AlertTriangle /><h1 className="mt-4 text-xl font-bold">Não foi possível confirmar as aprovações</h1><p className="mt-2 text-sm">Não é seguro incluir pedidos no Follow-up sem consultar decisões realmente gravadas.</p></div>

  const decisions = new Map(((decisionsResult.data ?? []) as PurchaseDecisionRecord[]).map((record) => [decisionKey(record.loja, record.pedido, record.produto_codigo), record]))
  const approved = items.filter((item) => isApprovedForFollowUp(item, decisions.get(decisionKey(item.loja!, item.pedido!, item.produto_codigo!))?.decisao))
  const approvedKeys = approved.map((item) => ({ loja: item.loja!, pedido: item.pedido!, produto_codigo: item.produto_codigo! }))
  // Sem pedidos aprovados a RPC pode não existir ainda, mas não há registros a exibir.
  const followupResult = approvedKeys.length ? await supabase.rpc("fn_listar_followup_compras", { p_chaves: approvedKeys }) : { data: [], error: null }
  const trackingAvailable = !followupResult.error
  const tracking = new Map(((followupResult.data ?? []) as FollowUpRecord[]).map((entry) => [decisionKey(entry.loja, entry.pedido, entry.produto_codigo), entry]))
  const rows = approved.map((item) => ({ item, tracking: tracking.get(decisionKey(item.loja!, item.pedido!, item.produto_codigo!)) ?? null }))
  const pages = Math.max(1, Math.ceil(positiveNumber(sourceRecords[0]?.total_itens) / PAGE_SIZE))
  const sumPending = approved.reduce((sum, item) => sum + positiveNumber(item.valor_pendente), 0)

  return <div className="mx-auto max-w-[1500px] space-y-6 pb-12 text-slate-100">
    <header className="erp-reveal flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3 text-xs font-bold"><Link href={returnHref} className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-400/5 px-3 py-2 text-cyan-200"><ArrowLeft size={14} /> Gerenciar pedidos</Link><Link href={purchaseFilteredHref("/compras", filters)} className="text-slate-400 hover:text-cyan-200">Consulta</Link><span className="text-slate-500">/ Follow-up</span></div>
      <div className="flex items-center gap-3 text-xs text-slate-400"><ShieldCheck size={14} className="text-emerald-300" /><span className="max-w-44 truncate">{user.email}</span><ComprasSair /></div>
    </header>
    <section className="erp-reveal relative overflow-hidden rounded-[28px] border border-cyan-400/20 bg-gradient-to-br from-[#12314a] via-[#0b1d32] to-[#071423] p-7 sm:p-10">
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan-400/10 blur-[70px]" />
      <div className="relative flex flex-wrap items-end justify-between gap-6"><div><p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.17em] text-cyan-300"><Truck size={15} /> Compras · inteligência logística</p><h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Follow-up <span className="text-cyan-300">de entregas</span></h1><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">Pedidos aprovados pelo comprador e ainda não entregues integralmente. Registre retorno de fornecedores, previsões e rastreabilidade, sem perder o saldo pendente.</p></div><span className="rounded-xl border border-cyan-300/15 bg-cyan-400/5 px-4 py-3 text-xs text-cyan-100">SO SAL = Bandeirantes</span></div>
    </section>

    {!trackingAvailable && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-5 text-sm text-amber-100"><AlertTriangle size={20} className="shrink-0" /><p>O registro de Follow-up ainda não foi habilitado no banco. Você pode visualizar o saldo conciliado, mas as previsões e o histórico não estão disponíveis para gravação.</p></div>}

    <section className="grid gap-4 sm:grid-cols-3" aria-label="Indicadores do lote"><div className="erp-surface rounded-2xl p-5"><p className="text-xs uppercase tracking-wider text-slate-400">Aprovados pendentes</p><p className="mt-3 text-3xl font-bold text-cyan-200">{rows.length}</p><p className="mt-1 text-xs text-slate-500">Itens do lote, incluindo parciais</p></div><div className="erp-surface rounded-2xl p-5"><p className="text-xs uppercase tracking-wider text-slate-400">Saldo financeiro pendente</p><p className="mt-3 text-2xl font-bold text-amber-200">{money.format(sumPending)}</p><p className="mt-1 text-xs text-slate-500">Somente os aprovados deste lote</p></div><div className="erp-surface rounded-2xl p-5"><p className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400"><CalendarClock size={14} /> Lote da origem</p><p className="mt-3 text-3xl font-bold text-white">{pagina} / {pages}</p><p className="mt-1 text-xs text-slate-500">50 itens por lote de origem</p></div></section>

    <section className="erp-surface rounded-2xl p-5 sm:p-6"><h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.17em] text-cyan-300"><Search size={15} /> Buscar entregas</h2><form action="/compras/follow-up" method="get" role="search" className="mt-5 grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_185px_160px_160px_auto]"><div><label htmlFor="follow-busca" className="mb-2 block text-xs font-semibold text-slate-300">Buscar</label><input id="follow-busca" name="busca" type="search" maxLength={90} defaultValue={busca} placeholder="Pedido, fornecedor, produto…" className="erp-field px-3 text-xs" /></div><div><label htmlFor="loja" className="mb-2 block text-xs font-semibold text-slate-300">Filial</label><BranchFilterSelect branches={shops} selectedBranch={loja} /></div><div><label htmlFor="follow-inicio" className="mb-2 block text-xs font-semibold text-slate-300">Data inicial</label><input id="follow-inicio" name="inicio" type="date" defaultValue={inicio} className="erp-field px-3 text-xs" /></div><div><label htmlFor="follow-fim" className="mb-2 block text-xs font-semibold text-slate-300">Data final</label><input id="follow-fim" name="fim" type="date" defaultValue={fim} className="erp-field px-3 text-xs" /></div><FilterSubmitButton /></form><p className="mt-3 text-xs text-slate-500">Itens aprovados são filtrados após a conciliação do lote. Outros lotes podem conter mais entregas pendentes.</p></section>

    <FollowUpTable rows={rows} trackingAvailable={trackingAvailable} />
    <footer className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3 text-xs text-slate-400"><span>Pedidos integralmente entregues saem da fila ativa, sem apagar o histórico auditado.</span><div className="flex items-center gap-2">{pagina > 1 && <Link href={pageHref(filters, pagina - 1)} className="rounded-lg border border-white/15 px-3 py-2 text-slate-200">Lote anterior</Link>}<span>{pagina} / {pages}</span>{pagina < pages && <Link href={pageHref(filters, pagina + 1)} className="rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-3 py-2 text-cyan-200">Próximo lote</Link>}</div></footer>
    <div className="flex justify-end"><Link href={returnHref} className="inline-flex items-center gap-2 text-xs font-bold text-cyan-300"><ClipboardPenLine size={14} /> Voltar à aprovação de pedidos</Link></div>
  </div>
}
