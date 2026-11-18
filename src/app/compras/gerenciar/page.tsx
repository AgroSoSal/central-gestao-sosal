import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"
import {
  AlertTriangle, ArrowLeft, ClipboardPenLine, Boxes,
  Filter, PackageCheck, ReceiptText, Search, ShieldCheck, TrendingDown, Truck,
} from "lucide-react"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ComprasLogin, ComprasSair } from "@/components/compras/compras-auth"
import { BranchFilterSelect } from "@/components/compras/branch-filter-select"
import { FilterSubmitButton } from "@/components/compras/filter-submit-button"
import { ManagementTable } from "@/components/compras/management-table"
import { LoadingState } from "@/components/shared/mascot-loader"
import { decisionKey, type PurchaseDecisionRecord } from "@/domains/compras/domain/purchase-decisions"
import { hasOutstandingDelivery, purchaseFilteredHref } from "@/domains/compras/domain/purchase-management"

type SearchParams = Record<string, string | string[] | undefined>
type Props = { searchParams: Promise<SearchParams> }
type PurchaseItem = {
  loja: string | null
  pedido: string | null
  produto_codigo: string | null
  descricao: string | null
  fornecedor_nome: string | null
  fornecedor_codigo: string | null
  data_pedido: string | null
  quantidade: number | string | null
  quantidade_recebida: number | string | null
  quantidade_pendente: number | string | null
  valor_total: number | string | null
  valor_pendente: number | string | null
  situacao_recebimento: string | null
  total_itens: number | string | null
}

const shops = ["CAMPO GRANDE", "SO SAL", "RIO VERDE", "COXIM", "PEDRO GOMES", "ANASTACIO"] as const
const PAGE_SIZE = 50
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

function first(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : Array.isArray(value) ? (value[0] ?? "") : ""
}

function validDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(value + "T00:00:00Z")
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value) ? value : null
}

function valueOf(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function pageHref(filters: { busca: string; loja: string; inicio: string; fim: string }, pagina: number): string {
  const params = new URLSearchParams()
  if (filters.busca) params.set("busca", filters.busca)
  if (filters.loja) params.set("loja", filters.loja)
  if (filters.inicio) params.set("inicio", filters.inicio)
  if (filters.fim) params.set("fim", filters.fim)
  params.set("pagina", String(pagina))
  return `/compras/gerenciar?${params.toString()}`
}

function ErrorBox({ title, explanation, returnHref = "/compras" }: { title: string; explanation: string; returnHref?: string }) {
  return (
    <section role="alert" className="mx-auto max-w-3xl rounded-2xl border border-amber-300/25 bg-amber-950/30 p-7 text-amber-100">
      <AlertTriangle size={25} className="mb-3" />
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-amber-100/75">{explanation}</p>
      <Link href={returnHref} className="mt-6 inline-flex items-center gap-2 rounded-lg border border-amber-100/20 px-4 py-2 text-sm font-semibold"><ArrowLeft size={15} /> Voltar à consulta</Link>
    </section>
  )
}

export default function ManagementPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<LoadingState label="Organizando pedidos para gestão..." />}>
      <ManagementContent searchParams={searchParams} />
    </Suspense>
  )
}

export async function ManagementContent({ searchParams }: Props) {
  await connection()
  const supabase = await createSupabaseServerClient()
  if (!supabase) return <ComprasLogin configured={false} />

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) return <ComprasLogin configured />

  const params = await searchParams
  const busca = first(params.busca).trim().slice(0, 90)
  const loja = shops.find((value) => value === first(params.loja)) ?? ""
  const inicio = validDate(first(params.inicio)) ?? ""
  const fim = validDate(first(params.fim)) ?? ""
  const pagina = Math.min(1000, Math.max(1, Number.parseInt(first(params.pagina), 10) || 1))
  const filters = { busca, loja, inicio, fim }
  const returnHref = purchaseFilteredHref("/compras", filters)
  const genericCodes = (process.env.SOSAL_COMPRAS_CODIGOS_GENERICOS ?? "545,105329")
    .split(",").map((code) => code.trim()).filter(Boolean)

  const result = await supabase.rpc("fn_listar_pedidos_compra_conciliados", {
    p_busca: busca || null, p_loja: loja || null,
    p_inicio: inicio || null, p_fim: fim || null,
    p_pagina: pagina, p_tamanho: PAGE_SIZE,
    p_codigos_genericos: genericCodes,
  })
  if (result.error) {
    return <ErrorBox
      title={result.error.code === "42501" ? "Acesso restrito ao Master" : "Não foi possível conferir os pedidos"}
      explanation="A fila depende da conciliação com as NFs do SISCOM. Nenhum pedido foi classificado sem esses dados."
      returnHref={returnHref}
    />
  }

  const records = (result.data ?? []) as PurchaseItem[]
  const sourceItems = records.filter((item) => item.loja && item.pedido && item.produto_codigo)
  const keys = sourceItems.map((item) => ({
    loja: item.loja!, pedido: item.pedido!, produto_codigo: item.produto_codigo!,
  }))
  const decisionsResult = await supabase.rpc("fn_listar_decisoes_compra", { p_chaves: keys })
  if (decisionsResult.error) {
    return <ErrorBox
      title="Não foi possível consultar as decisões"
      explanation="A fila poderia esconder pedidos marcados como Segurar ou Cancelar. Aguarde a recuperação da consulta antes de gerenciar."
      returnHref={returnHref}
    />
  }

  const decisions = new Map(
    ((decisionsResult.data ?? []) as PurchaseDecisionRecord[]).map((record) => [
      decisionKey(record.loja, record.pedido, record.produto_codigo), record,
    ]),
  )
  const items = sourceItems.filter(hasOutstandingDelivery)
  const managementRows = items.map((item) => ({
    item, record: decisions.get(decisionKey(item.loja!, item.pedido!, item.produto_codigo!)) ?? null,
  }))
  const sourceTotal = valueOf(records[0]?.total_itens)
  const pages = Math.max(1, Math.ceil(sourceTotal / PAGE_SIZE))
  const pendingValue = items.reduce((sum, item) => sum + valueOf(item.valor_pendente), 0)
  const pendingCount = items.filter((item) => valueOf(item.quantidade_pendente) > 0).length
  const awaitingCount = managementRows.filter((row) => !row.record).length

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 pb-12 text-slate-100">
      <header className="erp-reveal flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[.13em] text-slate-400">
          <Link href={returnHref} className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-400/5 px-3 py-2 text-cyan-200 transition hover:bg-cyan-400/15"><ArrowLeft size={14} /> Voltar à consulta</Link>
          <span className="hidden text-slate-500 sm:inline">/ Gerenciar pedidos</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400"><Link href={purchaseFilteredHref("/compras/previsao", filters)} className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-3 py-2 font-bold text-cyan-200"><ReceiptText size={14} /> Previsão de pagamentos</Link><Link href={purchaseFilteredHref("/compras/follow-up", filters)} className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-3 py-2 font-bold text-cyan-200"><Truck size={14} /> Follow-up</Link><ShieldCheck size={14} className="text-emerald-300" /><span className="max-w-48 truncate">{user.email}</span><ComprasSair /></div>
      </header>

      <section className="erp-reveal relative overflow-hidden rounded-[28px] border border-cyan-300/20 bg-gradient-to-br from-[#10263f] via-[#0a192c] to-[#081323] p-7 shadow-[0_30px_80px_-55px_rgba(14,165,233,.45)] sm:p-10">
        <div className="pointer-events-none absolute -right-12 -top-24 size-72 rounded-full bg-cyan-400/10 blur-[70px]" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-200"><ClipboardPenLine size={14} /> Central operacional</span>
            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">Gerenciar <span className="text-cyan-300">pedidos</span></h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">Aprovação explícita por produto. Clique em uma linha da tabela para abrir o painel de gerenciamento, consultar o saldo e registrar sua decisão.</p>
          </div>
          <span className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-medium text-slate-300">Filial SO SAL = Bandeirantes</span>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Indicadores deste lote">
        <div className="erp-surface rounded-2xl p-5"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400"><Boxes size={15} /> Aguardam aprovação</p><p className="mt-3 text-3xl font-bold text-amber-200">{awaitingCount}</p><p className="mt-2 text-xs text-slate-500">Itens deste lote de até {PAGE_SIZE}</p></div>
        <div className="erp-surface rounded-2xl p-5"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400"><PackageCheck size={15} /> Com saldo pendente</p><p className="mt-3 text-3xl font-bold text-cyan-200">{pendingCount}</p><p className="mt-2 text-xs text-slate-500">Inclui chegada parcial</p></div>
        <div className="erp-surface rounded-2xl p-5"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400"><TrendingDown size={15} /> Valor pendente no lote</p><p className="mt-3 text-2xl font-bold text-amber-200">{money.format(pendingValue)}</p><p className="mt-2 text-xs text-slate-500">Dados conciliados com NFs</p></div>
      </section>

      <section className="erp-surface rounded-2xl p-5 sm:p-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.17em] text-cyan-300"><Filter size={15} /> Filtrar a fila</div>
        <form action="/compras/gerenciar" method="get" role="search" className="mt-5 grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_185px_160px_160px_auto]">
          <div><label htmlFor="gestao-busca" className="mb-2 block text-xs font-semibold text-slate-300">Buscar</label><div className="relative"><Search size={16} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-500" /><input id="gestao-busca" name="busca" type="search" maxLength={90} defaultValue={busca} placeholder="Pedido, fornecedor, produto..." className="erp-field pl-10 pr-3 text-[13px]" /></div></div>
          <div><label htmlFor="loja" className="mb-2 block text-xs font-semibold text-slate-300">Filial</label><BranchFilterSelect branches={shops} selectedBranch={loja} /></div>
          <div><label htmlFor="gestao-inicio" className="mb-2 block text-xs font-semibold text-slate-300">Data inicial</label><input id="gestao-inicio" name="inicio" type="date" defaultValue={inicio} className="erp-field px-3 text-[13px]" /></div>
          <div><label htmlFor="gestao-fim" className="mb-2 block text-xs font-semibold text-slate-300">Data final</label><input id="gestao-fim" name="fim" type="date" defaultValue={fim} className="erp-field px-3 text-[13px]" /></div>
          <FilterSubmitButton />
        </form>
        <p className="mt-3 text-xs leading-5 text-slate-500">Somente itens com saldo de entrega positivo; separe a aprovação operacional nas abas da tabela. A filtragem é aplicada dentro de cada lote de até {PAGE_SIZE} registros conciliados.</p>
      </section>

      <section aria-label="Pedidos que exigem gerenciamento" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Pedidos que exigem atenção</h2>
          <span className="text-xs text-slate-400">Lote {pagina} de {pages} · {items.length} itens para gestão</span>
        </div>
        <ManagementTable rows={managementRows} />
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3 text-xs text-slate-400"><span>Exibindo apenas os itens relevantes deste lote — não é um total global de pendências.</span><div className="flex items-center gap-2">{pagina > 1 && <Link href={pageHref(filters, pagina - 1)} className="rounded-lg border border-slate-500/30 px-3 py-2 font-semibold text-slate-200 hover:bg-white/5">Anterior</Link>}<span>{pagina} / {pages}</span>{pagina < pages && <Link href={pageHref(filters, pagina + 1)} className="rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-3 py-2 font-semibold text-cyan-200 hover:bg-cyan-400/20">Próximo lote</Link>}</div></div>
      </section>
    </div>
  )
}
