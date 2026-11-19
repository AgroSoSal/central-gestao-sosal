import Link from "next/link"
import { connection } from "next/server"
import { Suspense, type ReactNode } from "react"
import {
  AlertCircle, ArrowUpRight, Boxes, ChevronLeft, ChevronRight, ClipboardList,
  Clock3, Search, ShieldCheck, ShoppingCart, Wallet, CalendarDays,
  Activity, SlidersHorizontal, Database, Sparkles, ClipboardPenLine, Truck, ReceiptText, ChartNoAxesCombined, Factory, TrendingDown,
} from "lucide-react"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ComprasLogin, ComprasSair } from "@/components/compras/compras-auth"
import { BranchFilterSelect } from "@/components/compras/branch-filter-select"
import { getBranchDisplayName } from "@/domains/compras/domain/branches"
import { AnimatedMetricValue } from "@/components/compras/animated-metric-value"
import { FilterSubmitButton } from "@/components/compras/filter-submit-button"
import { PurchaseStatus } from "@/components/compras/purchase-status"
import { purchaseFilteredHref } from "@/domains/compras/domain/purchase-management"
import { LoadingState } from "@/components/shared/mascot-loader"

type SearchParams = Record<string, string | string[] | undefined>
type Props = { searchParams: Promise<SearchParams> }

type PurchaseItem = {
  importacao_id: number | null
  linha_excel: number | null
  importado_em: string | null
  loja: string | null
  fornecedor_codigo: string | null
  fornecedor_nome: string | null
  pedido: string | null
  data_pedido: string | null
  condicao_pagamento: string | null
  produto_codigo: string | null
  descricao: string | null
  quantidade: number | string | null
  custo_unitario: number | string | null
  valor_total: number | string | null
  quantidade_recebida: number | string | null
  quantidade_pendente: number | string | null
  valor_pendente: number | string | null
  situacao_recebimento: string | null
  total_itens: number | string
  total_pedidos: number | string
  soma_total: number | string
  ultima_importacao: string | null
  ultima_entrada: string | null
}

const shops = ["CAMPO GRANDE", "SO SAL", "RIO VERDE", "COXIM", "PEDRO GOMES", "ANASTACIO"] as const
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const whole = new Intl.NumberFormat("pt-BR")
const amount = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 })

function first(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : Array.isArray(value) ? (value[0] ?? "") : ""
}

function safeDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(value + "T00:00:00Z")
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) ? value : null
}

function num(value: number | string | null | undefined): number {
  const result = Number(value ?? 0)
  return Number.isFinite(result) ? result : 0
}

function dateBR(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value.slice(0, 10))) return "—"
  const [y, m, d] = value.slice(0, 10).split("-")
  return d + "/" + m + "/" + y
}

function dateTimeBR(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Campo_Grande",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function pageHref(values: { busca: string; loja: string; inicio: string; fim: string }, page: number) {
  const params = new URLSearchParams()
  if (values.busca) params.set("busca", values.busca)
  if (values.loja) params.set("loja", values.loja)
  if (values.inicio) params.set("inicio", values.inicio)
  if (values.fim) params.set("fim", values.fim)
  params.set("pagina", String(page))
  return "/compras?" + params.toString()
}

function Metric({ label, value, footnote, icon: Icon, delay }: {
  label: string; value: ReactNode; footnote: string; icon: typeof ShoppingCart; delay: number
}) {
  return (
    <div className="erp-surface erp-metric erp-reveal rounded-2xl p-5 sm:p-6" style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[.12em] text-slate-400">{label}</p>
          <p className="mt-4 truncate text-[clamp(1.3rem,2.5vw,1.9rem)] font-semibold leading-tight tracking-tight text-white">{value}</p>
          <p className="mt-3 text-xs leading-5 text-slate-400">{footnote}</p>
        </div>
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-400/10 text-cyan-300 shadow-[inset_0_1px_rgba(255,255,255,.08)]">
          <Icon size={19} />
        </span>
      </div>
    </div>
  )
}

export default function ComprasPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<LoadingState label="Consultando os pedidos..." />}>
      <ComprasContent searchParams={searchParams} />
    </Suspense>
  )
}

export async function ComprasContent({ searchParams }: Props) {
  // Supabase Auth pode consultar Date.now() para renovar a sessão. A página é
  // dinâmica e precisa esperar um request real antes de carregar o usuário.
  await connection()
  const supabase = await createSupabaseServerClient()
  if (!supabase) return <ComprasLogin configured={false} />

  // Confere a identidade com Supabase Auth; não confia em metadados editáveis do navegador.
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return <ComprasLogin configured />

  const params = await searchParams
  const busca = first(params.busca).trim().slice(0, 90)
  const loja = shops.find((item) => item === first(params.loja)) ?? ""
  const inicio = safeDate(first(params.inicio)) ?? ""
  const fim = safeDate(first(params.fim)) ?? ""
  const pagina = Math.min(1000, Math.max(1, Number.parseInt(first(params.pagina), 10) || 1))
  const tamanho = 25
  const filters = { busca, loja, inicio, fim }
  const manageHref = purchaseFilteredHref("/compras/gerenciar", filters)
  const followUpHref = purchaseFilteredHref("/compras/follow-up", filters)
  const forecastHref = purchaseFilteredHref("/compras/previsao", filters)

  // A função PostgreSQL exige JWT válido e profile Master ativo, devolvendo apenas leitura.
  // A nova RPC devolve a conciliação calculada em contexto completo, nunca
  // somente pelas 25 linhas da página (o que duplicaria entradas de NFs).
  const codigosGenericos = (process.env.SOSAL_COMPRAS_CODIGOS_GENERICOS ?? "545,105329")
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean)
  const { data: dataConciliada, error: erroConciliacao } = await supabase.rpc("fn_listar_pedidos_compra_conciliados", {
    p_busca: busca || null,
    p_loja: loja || null,
    p_inicio: inicio || null,
    p_fim: fim || null,
    p_pagina: pagina,
    p_tamanho: tamanho,
    p_codigos_genericos: codigosGenericos,
  })

  // Se a consulta de NFs falhar por indisponibilidade, a listagem antiga
  // continua acessível, mas NUNCA apresenta quantidades recebidas presumidas.
  let data = dataConciliada
  let error = erroConciliacao
  let conciliacaoDisponivel = !erroConciliacao
  if (erroConciliacao && erroConciliacao.code !== "42501") {
    const anterior = await supabase.rpc("fn_listar_pedidos_compra", {
      p_busca: busca || null,
      p_loja: loja || null,
      p_inicio: inicio || null,
      p_fim: fim || null,
      p_pagina: pagina,
      p_tamanho: tamanho,
    })
    if (!anterior.error) {
      data = anterior.data
      error = null
      conciliacaoDisponivel = false
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <div className="flex justify-end"><ComprasSair /></div>
        <div role="alert" className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-950/40 p-7 text-amber-100">
          <AlertCircle size={27} className="mb-4" />
          <h1 className="text-xl font-semibold">{error.code === "42501" ? "Acesso restrito ao Master" : "Não foi possível consultar os pedidos"}</h1>
          <p className="mt-2 text-sm leading-6">
            {error.code === "42501"
              ? "Sua conta está autenticada, mas não tem autorização de Master ativo no módulo Compras."
              : "A consulta de pedidos e recebimentos está indisponível. Nenhum saldo foi presumido. Peça ao administrador para verificar a função de conciliação no Supabase."}
          </p>
        </div>
      </div>
    )
  }

  const rows = (data ?? []) as PurchaseItem[]
  const summary = rows[0]
  const items = rows.filter((row) => row.pedido !== null)
  const total = num(summary?.total_itens)
  const totalPages = Math.max(1, Math.ceil(total / tamanho))
  const from = total === 0 || items.length === 0 ? 0 : (pagina - 1) * tamanho + 1
  const to = Math.min(total, pagina * tamanho)

  return (
    <div className="mx-auto max-w-[1520px] space-y-6 pb-12 text-slate-100">
      {!conciliacaoDisponivel && (
        <div role="alert" className="rounded-2xl border border-amber-500/30 bg-amber-950/30 px-5 py-4 text-sm text-amber-100">
          A conferência com as NFs está temporariamente indisponível. Os pedidos continuam visíveis, mas os saldos recebidos e pendentes não foram calculados.
        </div>
      )}
      <header className="erp-reveal flex flex-wrap items-center justify-between gap-3">
        <nav className="text-[11px] font-bold uppercase tracking-[.19em] text-slate-500" aria-label="Localização">
          <Link href="/" className="transition-colors hover:text-cyan-300">Central de Gestão</Link>
          <span className="mx-3 text-slate-600">/</span>
          <span className="text-cyan-300">Compras</span>
        </nav>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-emerald-300 sm:inline-flex">
            <ShieldCheck size={13} /> Acesso Master
          </span>
          <span className="max-w-48 truncate" title={user.email ?? ""}>{user.email}</span>
          <ComprasSair />
        </div>
      </header>

      <section className="erp-reveal relative isolate overflow-hidden rounded-[28px] border border-cyan-300/15 bg-[#091524] px-7 py-9 text-white shadow-[0_28px_85px_-48px_rgba(5,126,173,.48)] sm:px-10 sm:py-11" style={{ "--reveal-delay": "80ms" } as React.CSSProperties}>
        <div className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(rgba(86,151,203,.065) 1px, transparent 1px), linear-gradient(90deg, rgba(86,151,203,.065) 1px, transparent 1px)", backgroundSize: "36px 36px", maskImage: "linear-gradient(90deg, transparent, black)" }} />
        <div className="erp-glow pointer-events-none absolute -right-16 -top-32 h-96 w-96 rounded-full bg-cyan-500/15 blur-[85px]" />
        <div className="pointer-events-none absolute -right-32 top-20 h-56 w-96 rotate-[-28deg] border border-cyan-400/20 bg-gradient-to-r from-cyan-400/5 to-blue-600/10 blur-[1px]" />
        <div className="relative flex flex-wrap items-end justify-between gap-8">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.15em] text-cyan-200">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" /> Módulo operacional <Sparkles size={13} />
            </span>
            <h1 className="mt-5 text-3xl font-bold tracking-[-.045em] sm:text-[44px] sm:leading-tight">Pedidos de <span className="bg-gradient-to-r from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent">compra</span></h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              Consulte o histórico integrado ao SISCOM, confira entradas de NFs e acompanhe os saldos por filial.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span className="inline-flex items-center gap-2"><Activity size={14} className="text-cyan-300" /> Histórico consolidado</span>
              <span className="h-3 w-px bg-slate-700" />
              <span className="inline-flex items-center gap-2"><ShieldCheck size={14} className="text-emerald-400" /> Consulta protegida</span>
              <span className="h-3 w-px bg-slate-700" />
              <span className="inline-flex items-center gap-2"><CalendarDays size={14} className="text-cyan-300" /> NFs atualizadas até {dateBR(summary?.ultima_entrada ?? null)}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0b1e30]/80 px-5 py-4 shadow-[inset_0_1px_rgba(255,255,255,.07)] backdrop-blur-md">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400"><Database size={13} /> Origem de dados</p>
            <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-100"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" /> Supabase · SISCOM RPA</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores de compras">
        <Metric label="Itens de pedidos" value={<AnimatedMetricValue value={total} format="integer" />} footnote="Registros correspondentes aos filtros" icon={Boxes} delay={140} />
        <Metric label="Pedidos distintos" value={<AnimatedMetricValue value={num(summary?.total_pedidos)} format="integer" />} footnote="Número de pedido por filial" icon={ClipboardList} delay={210} />
        <Metric label="Valor nominal" value={<AnimatedMetricValue value={num(summary?.soma_total)} format="currency" />} footnote="Não equivale ao saldo a pagar" icon={Wallet} delay={280} />
        <Metric label="Última importação" value={dateTimeBR(summary?.ultima_importacao)} footnote="Horário de Campo Grande (MS)" icon={Clock3} delay={350} />
      </section>

      <section className="erp-surface rounded-[24px] p-5 sm:p-7" aria-label="Planejamento e liquidação">
        <div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-400">Zacarini 2.3.7 · Produtos e estoque</p><h2 className="mt-2 text-xl font-semibold text-white">Planejamento, giro e produção</h2><p className="mt-1 text-xs leading-6 text-slate-400">Dados por SKU e filial do Supabase. Indicadores de liquidação são estimativos e não liberam orçamento ou pedido.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            {href:"/compras/plano-estoque", label:"Plano de estoque", icon:CalendarDays},
            {href:"/compras/estoque-parado", label:"Estoque parado", icon:TrendingDown},
            {href:"/compras/liquidacao-lojas", label:"Liquidação lojas", icon:Boxes},
            {href:"/compras/liquidacao-linhas", label:"Liquidação linhas", icon:SlidersHorizontal},
            {href:"/compras/producao-propria", label:"Produção própria", icon:Factory},
          ].map(link=><Link key={link.href} href={link.href} className="flex min-h-20 items-center gap-3 rounded-xl border border-cyan-300/15 bg-cyan-400/5 px-4 py-3 text-xs font-bold text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-400/10"><link.icon size={18} className="shrink-0 text-cyan-300"/>{link.label}<ArrowUpRight size={13} className="ml-auto text-slate-400"/></Link>)}
        </div>
      </section>

      <section className="erp-surface erp-reveal overflow-hidden rounded-[24px]" style={{ "--reveal-delay": "400ms" } as React.CSSProperties}>
        <div className="border-b border-[#25354e] p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-cyan-400"><SlidersHorizontal size={13} /> Centro de consulta</p>
              <h2 className="text-xl font-semibold tracking-tight text-white">Consulta de pedidos</h2>
              <p className="mt-1.5 text-sm text-slate-400">Confira pedidos, entradas de NFs, quantidades e valores ainda pendentes.</p>
            </div>
            <div className="flex flex-wrap gap-2"><Link href="/compras/cobertura" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/10 px-5 text-xs font-bold text-amber-100 transition hover:bg-amber-300/15"><ClipboardList size={16} /> Cobertura Zacarini 2.3.7</Link><Link href="/compras/atendimento" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 text-xs font-bold text-white transition hover:brightness-110"><ShoppingCart size={15} /> Atendimento Fornecedor</Link>
              <Link href="/compras/dashboard" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-5 text-sm font-bold text-cyan-200 transition hover:bg-cyan-400/20"><ChartNoAxesCombined size={17} /> Dashboard de Compras</Link><Link href="/compras/otb" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-5 text-sm font-bold text-cyan-200 transition hover:bg-cyan-400/20"><ChartNoAxesCombined size={17} /> OTB · Planejamento</Link><Link href={forecastHref} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-5 text-sm font-bold text-cyan-200 transition hover:bg-cyan-400/20"><ReceiptText size={17} /> Previsão de pagamentos</Link><Link href={followUpHref} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-5 text-sm font-bold text-cyan-200 transition hover:bg-cyan-400/20"><Truck size={17} /> Follow-up de entregas</Link><Link href={manageHref} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 text-sm font-bold text-white shadow-[0_12px_30px_-15px_rgba(6,182,212,.9)] transition hover:-translate-y-0.5 hover:shadow-[0_15px_35px_-12px_rgba(6,182,212,.65)]"><ClipboardPenLine size={17} /> Gerenciar pedidos <ArrowUpRight size={15} /></Link></div>
          </div>

          <form action="/compras" method="get" role="search" className="mt-7 grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_185px_160px_160px_auto]">
            <div>
              <label htmlFor="busca" className="mb-2 block text-xs font-semibold text-slate-300">Buscar</label>
              <div className="relative">
                <Search size={17} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-500" />
                <input id="busca" name="busca" type="search" maxLength={90} defaultValue={busca} placeholder="Pedido, fornecedor, produto..." className="erp-field pl-10 pr-3 text-[13px]" />
              </div>
            </div>
            <div>
              <label htmlFor="loja" className="mb-2 block text-xs font-semibold text-slate-300">Filial</label>
              <BranchFilterSelect branches={shops} selectedBranch={loja} />
            </div>
            <div>
              <label htmlFor="inicio" className="mb-2 block text-xs font-semibold text-slate-300">Data inicial</label>
              <input id="inicio" name="inicio" type="date" defaultValue={inicio} className="erp-field px-3 text-[13px]" />
            </div>
            <div>
              <label htmlFor="fim" className="mb-2 block text-xs font-semibold text-slate-300">Data final</label>
              <input id="fim" name="fim" type="date" defaultValue={fim} className="erp-field px-3 text-[13px]" />
            </div>
            <FilterSubmitButton />
          </form>
          <div className="mt-3 flex justify-end"><Link href="/compras" className="text-xs font-medium text-slate-400 transition-colors hover:text-cyan-300">Limpar filtros</Link></div>
        </div>

        <div className="overflow-x-auto">
          <table className="erp-table w-full min-w-[1670px] text-left text-[13px]">
            <thead className="bg-[#121e30] text-[10px] uppercase tracking-[.12em] text-slate-400">
              <tr className="border-b border-[#26354c]">
                <th className="px-5 py-4 font-semibold">Pedido</th>
                <th className="px-5 py-4 font-semibold">Data</th>
                <th className="px-5 py-4 font-semibold">Filial</th>
                <th className="px-5 py-4 font-semibold">Fornecedor</th>
                <th className="px-5 py-4 font-semibold">Produto</th>
                <th className="px-5 py-4 text-right font-semibold">Pedida</th>
                <th className="px-5 py-4 text-right font-semibold">Recebida</th>
                <th className="px-5 py-4 text-right font-semibold">Pendente</th>
                <th className="px-5 py-4 text-right font-semibold">Valor pedido</th>
                <th className="px-5 py-4 text-right font-semibold">Valor pendente</th>
                <th className="px-5 py-4 font-semibold">Situação</th>
                <th className="px-5 py-4 font-semibold">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1c2b40]">
              {items.map((item, index) => (
                <tr key={String(item.importacao_id) + "-" + String(item.linha_excel) + "-" + String(index)} className="align-top text-slate-200">
                  <td className="whitespace-nowrap px-5 py-4 font-bold text-cyan-300">#{item.pedido}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-400">{dateBR(item.data_pedido)}</td>
                  <td className="whitespace-nowrap px-5 py-4"><span className="rounded-lg border border-slate-600/30 bg-slate-700/30 px-2.5 py-1 text-[10px] font-bold tracking-wide text-slate-200">{item.loja ? getBranchDisplayName(item.loja) : "—"}</span></td>
                  <td className="max-w-56 px-5 py-4"><p className="max-w-56 truncate font-medium text-slate-100" title={item.fornecedor_nome ?? ""}>{item.fornecedor_nome || "Não informado"}</p><p className="mt-1 text-xs text-slate-500">Cód. {item.fornecedor_codigo ?? "—"}</p></td>
                  <td className="max-w-64 px-5 py-4"><p className="max-w-64 truncate" title={item.descricao ?? ""}>{item.descricao || "Não informado"}</p><p className="mt-1 text-xs text-slate-500">SKU {item.produto_codigo ?? "—"}</p></td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-medium tabular-nums">{amount.format(num(item.quantidade))}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-medium tabular-nums text-cyan-200">{item.quantidade_recebida == null ? "—" : amount.format(num(item.quantidade_recebida))}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-medium tabular-nums text-amber-200">{item.quantidade_pendente == null ? "—" : amount.format(num(item.quantidade_pendente))}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-semibold tabular-nums text-white">{brl.format(num(item.valor_total))}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-semibold tabular-nums text-amber-200">{item.valor_pendente == null ? "—" : brl.format(num(item.valor_pendente))}</td>
                  <td className="px-5 py-4"><PurchaseStatus status={item.situacao_recebimento} /></td>
                  <td className="px-5 py-4">
                    <details className="group/details">
                      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md text-xs font-semibold text-cyan-300 transition-colors hover:text-cyan-100 focus-visible:outline-2 focus-visible:outline-cyan-300">Ver detalhes <ArrowUpRight size={13} className="transition-transform group-open/details:rotate-45" /></summary>
                      <div className="mt-3 w-64 rounded-xl border border-[#34445e] bg-[#101d2d] p-4 text-xs shadow-[0_12px_30px_-15px_rgba(0,0,0,.8)]">
                        <dl className="space-y-2">
                          <div><dt className="text-slate-400">Pagamento</dt><dd className="mt-1 font-semibold text-slate-100">{item.condicao_pagamento || "Não informado"}</dd></div>
                          <div><dt className="text-slate-400">Custo unitário</dt><dd className="mt-1 font-semibold text-slate-100">{brl.format(num(item.custo_unitario))}</dd></div>
                          <div><dt className="text-slate-400">Importado em</dt><dd className="mt-1 font-semibold text-slate-100">{dateTimeBR(item.importado_em)}</dd></div>
                        </dl>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-5 py-16 text-center">
                    <Search className="mx-auto mb-3 text-cyan-400/40" size={28} />
                    <p className="font-semibold text-slate-100">Nenhum item encontrado</p>
                    <p className="mt-1 text-sm text-slate-400">Tente alterar os filtros ou o período.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#25354e] px-5 py-4 text-sm sm:px-7">
          <p className="text-slate-400">Exibindo <strong className="text-white">{whole.format(from)}–{whole.format(to)}</strong> de <strong className="text-white">{whole.format(total)}</strong> itens</p>
          <div className="flex items-center gap-2">
            {pagina > 1 ? <Link href={pageHref(filters, pagina - 1)} className="inline-flex items-center gap-1 rounded-lg border border-[#2c425f] px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-cyan-400/10 hover:text-cyan-200"><ChevronLeft size={14} /> Anterior</Link> : <span className="rounded-lg border border-[#243248] px-3 py-2 text-xs text-slate-500">Anterior</span>}
            <span className="px-2 text-xs text-slate-400">{pagina} / {totalPages}</span>
            {pagina < totalPages ? <Link href={pageHref(filters, pagina + 1)} className="inline-flex items-center gap-1 rounded-lg border border-[#2c425f] px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-cyan-400/10 hover:text-cyan-200">Próxima <ChevronRight size={14} /></Link> : <span className="rounded-lg border border-[#243248] px-3 py-2 text-xs text-slate-500">Próxima</span>}
          </div>
        </div>
      </section>

      <section className="erp-reveal grid gap-4 lg:grid-cols-2" style={{ "--reveal-delay": "500ms" } as React.CSSProperties}>
        <div className="erp-surface flex items-start gap-3 rounded-2xl p-5 text-sm">
          <CalendarDays size={20} className="mt-0.5 shrink-0 text-cyan-400" />
          <div><h3 className="font-semibold text-slate-100">Origem e atualização</h3><p className="mt-1 leading-6 text-slate-400">Pedidos das extrações RPA e entradas de NFs do SISCOM. O saldo recebido considera as entradas até {dateBR(summary?.ultima_entrada ?? null)}; dados posteriores ainda não carregados não entram no cálculo.</p></div>
        </div>
        <div className="erp-surface flex items-start gap-3 rounded-2xl p-5 text-sm">
          <AlertCircle size={20} className="mt-0.5 shrink-0 text-amber-400" />
          <div><h3 className="font-semibold text-slate-100">Decisões em tela dedicada</h3><p className="mt-1 leading-6 text-slate-400">Para aprovar, segurar ou cancelar, use <Link href={manageHref} className="font-semibold text-cyan-300 hover:text-cyan-100">Gerenciar pedidos</Link>. As decisões ficam auditadas; não cancelam automaticamente no SISCOM e ainda não alteram OTB ou caixa.</p></div>
        </div>
      </section>
    </div>
  )
}
