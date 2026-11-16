import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"
import { AlertTriangle, ArrowLeft, CalendarClock, ClipboardPenLine, Filter, ReceiptText, Search, ShieldCheck, Truck } from "lucide-react"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ComprasLogin, ComprasSair } from "@/components/compras/compras-auth"
import { BranchFilterSelect } from "@/components/compras/branch-filter-select"
import { FilterSubmitButton } from "@/components/compras/filter-submit-button"
import { PaymentForecastTable, type PaymentForecastRow } from "@/components/compras/payment-forecast-table"
import { GlobalPaymentForecast } from "@/components/compras/global-payment-forecast"
import { LoadingState } from "@/components/shared/mascot-loader"
import { decisionKey, type PurchaseDecisionRecord } from "@/domains/compras/domain/purchase-decisions"
import { forecastPurchasePayments } from "@/domains/compras/domain/purchase-payment-forecast"
import { purchaseFilteredHref } from "@/domains/compras/domain/purchase-management"

type SearchParams = Record<string, string | string[] | undefined>
type Props = { searchParams: Promise<SearchParams> }
type PurchaseItem = {
  loja: string | null
  pedido: string | null
  produto_codigo: string | null
  descricao: string | null
  fornecedor_nome: string | null
  data_pedido: string | null
  condicao_pagamento: string | null
  quantidade_pendente: number | string | null
  quantidade_recebida: number | string | null
  situacao_recebimento: string | null
  valor_pendente: number | string | null
  total_itens: number | string | null
}
type FollowUpArrival = { loja: string; pedido: string; produto_codigo: string; previsao_entrega: string | null }

const shops = ["CAMPO GRANDE", "SO SAL", "RIO VERDE", "COXIM", "PEDRO GOMES", "ANASTACIO"] as const
const PAGE_SIZE = 50

function first(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : Array.isArray(value) ? (value[0] ?? "") : ""
}

function validDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value) ? value : null
}

function pageHref(filters: { busca: string; loja: string; inicio: string; fim: string }, page: number): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
  params.set("pagina", String(page))
  return `/compras/previsao?${params.toString()}`
}

function ErrorBox({ title, description }: { title: string; description: string }) {
  return <section role="alert" className="mx-auto max-w-3xl rounded-2xl border border-amber-400/25 bg-amber-400/10 p-7 text-amber-100">
    <AlertTriangle size={23} />
    <h1 className="mt-4 text-xl font-bold">{title}</h1>
    <p className="mt-2 text-sm leading-6">{description}</p>
    <Link href="/compras" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-cyan-200 underline"><ArrowLeft size={14} /> Voltar à consulta</Link>
  </section>
}

export default function PurchaseForecastPage({ searchParams }: Props) {
  return <Suspense fallback={<LoadingState label="Calculando parcelas e vencimentos..." />}><PurchaseForecastContent searchParams={searchParams} /></Suspense>
}

export async function PurchaseForecastContent({ searchParams }: Props) {
  await connection()
  const supabase = await createSupabaseServerClient()
  if (!supabase) return <ComprasLogin configured={false} />
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return <ComprasLogin configured />

  const params = await searchParams
  const busca = first(params.busca).trim().slice(0, 90)
  const loja = shops.find((branch) => branch === first(params.loja)) ?? ""
  const inicio = validDate(first(params.inicio)) ?? ""
  const fim = validDate(first(params.fim)) ?? ""
  const pagina = Math.min(1000, Math.max(1, Number.parseInt(first(params.pagina), 10) || 1))
  const filters = { busca, loja, inicio, fim }
  const dataBase = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Campo_Grande", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
  const genericCodes = (process.env.SOSAL_COMPRAS_CODIGOS_GENERICOS ?? "").split(",").map((code) => code.trim()).filter(Boolean)

  const purchasesResult = await supabase.rpc("fn_listar_pedidos_compra_conciliados", {
    p_busca: busca || null, p_loja: loja || null, p_inicio: inicio || null, p_fim: fim || null,
    p_pagina: pagina, p_tamanho: PAGE_SIZE, p_codigos_genericos: genericCodes,
  })
  if (purchasesResult.error) return <ErrorBox
    title="Não foi possível conciliar pedidos e entradas"
    description="A previsão depende do saldo real das NFs do SISCOM e da autorização Master. Nenhum vencimento foi presumido sem a conciliação."
  />

  const purchases = ((purchasesResult.data ?? []) as PurchaseItem[]).filter((row) => row.loja && row.pedido && row.produto_codigo)
  const keys = purchases.map((row) => ({ loja: row.loja!, pedido: row.pedido!, produto_codigo: row.produto_codigo! }))
  const decisionsResult = keys.length ? await supabase.rpc("fn_listar_decisoes_compra", { p_chaves: keys }) : { data: [], error: null }
  if (decisionsResult.error) return <ErrorBox
    title="Não foi possível consultar as decisões de compra"
    description="Sem as decisões reais, não é seguro classificar pedidos como aprovados, segurados ou cancelados. Nenhum valor financeiro foi projetado."
  />

  const decisions = new Map(((decisionsResult.data ?? []) as PurchaseDecisionRecord[]).map((row) => [decisionKey(row.loja, row.pedido, row.produto_codigo), row.decisao]))
  const followUpResult = keys.length ? await supabase.rpc("fn_listar_followup_compras", { p_chaves: keys }) : { data: [], error: null }
  const followUpAvailable = !followUpResult.error
  const arrivalRows = ((followUpAvailable ? followUpResult.data : []) ?? []) as FollowUpArrival[]
  const arrivals = new Map(arrivalRows.map((row) => [decisionKey(row.loja, row.pedido, row.produto_codigo), row.previsao_entrega]))
  const rows: PaymentForecastRow[] = purchases.map((item) => {
    const key = decisionKey(item.loja!, item.pedido!, item.produto_codigo!)
    return {
      item,
      forecast: forecastPurchasePayments({
        orderDate: item.data_pedido,
        paymentTerms: item.condicao_pagamento,
        pendingQuantity: item.quantidade_pendente,
        pendingValue: item.valor_pendente,
        decision: decisions.get(key) ?? null,
        followUpArrival: arrivals.get(key) ?? null,
        baseDate: dataBase,
      }),
    }
  })

  const sourceTotal = Number((purchasesResult.data as PurchaseItem[] | null)?.[0]?.total_itens ?? 0)
  const pages = Math.max(1, Math.ceil((Number.isFinite(sourceTotal) ? sourceTotal : 0) / PAGE_SIZE))

  return <div className="mx-auto max-w-[1500px] space-y-6 pb-12 text-slate-100">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Navegação de Compras" className="flex flex-wrap items-center gap-3 text-xs font-semibold">
        <Link href={purchaseFilteredHref("/compras", filters)} className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-cyan-200"><ArrowLeft size={14} /> Consulta</Link>
        <Link href={purchaseFilteredHref("/compras/gerenciar", filters)} className="inline-flex items-center gap-2 text-slate-300 hover:text-cyan-200"><ClipboardPenLine size={14} /> Gerenciar pedidos</Link>
        <Link href={purchaseFilteredHref("/compras/follow-up", filters)} className="inline-flex items-center gap-2 text-slate-300 hover:text-cyan-200"><Truck size={14} /> Follow-up</Link>
      </nav>
      <div className="flex items-center gap-3 text-xs text-slate-400"><ShieldCheck size={15} className="text-emerald-300" /><span className="max-w-48 truncate">{user.email}</span><ComprasSair /></div>
    </header>

    <section className="erp-reveal relative overflow-hidden rounded-[28px] border border-cyan-400/20 bg-gradient-to-br from-[#102e43] via-[#0b1e32] to-[#071422] p-7 shadow-[0_25px_70px_-45px_rgba(6,182,212,.3)] sm:p-10">
      <div className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-cyan-400/10 blur-[70px]" />
      <div className="relative"><p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.17em] text-cyan-300"><ReceiptText size={16} /> Compras · planejamento</p><h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Previsão de <span className="text-cyan-300">pagamentos</span></h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Simulação dos vencimentos de pedidos já existentes, considerando saldo pendente de entrega, decisão do comprador e previsão do fornecedor. A data-base é {dataBase.slice(8, 10)}/{dataBase.slice(5, 7)}/{dataBase.slice(0, 4)}.</p><p className="mt-3 max-w-3xl rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-xs leading-5 text-amber-100">Projeção somente de leitura. Não lança contas a pagar, não verifica saldo do caixa/OTB e não modifica o SISCOM. Aguardando aprovação operacional entra no cálculo apenas porque a Zacarini considera a decisão vazia como Aprovado na projeção financeira.</p></div>
    </section>

    {!followUpAvailable && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100"><AlertTriangle size={19} className="shrink-0" /><p>Follow-up indisponível: as previsões informadas pelos fornecedores não puderam ser consultadas. Foram usadas estimativas calculadas pela regra de 7 dias, identificadas como tal na tabela.</p></div>}

    <section className="erp-surface rounded-2xl p-5 sm:p-6">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-cyan-300"><Filter size={15} /> Filtrar pedidos</div>
      <form action="/compras/previsao" method="get" role="search" className="mt-5 grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_185px_160px_160px_auto]">
        <div><label htmlFor="forecast-search" className="mb-2 block text-xs font-semibold text-slate-300">Buscar</label><div className="relative"><Search size={16} className="pointer-events-none absolute left-3 top-3.5 text-slate-500" /><input id="forecast-search" name="busca" type="search" maxLength={90} defaultValue={busca} placeholder="Pedido, fornecedor, produto..." className="erp-field pl-10 pr-3 text-xs" /></div></div>
        <div><label htmlFor="loja" className="mb-2 block text-xs font-semibold text-slate-300">Filial</label><BranchFilterSelect branches={shops} selectedBranch={loja} /></div>
        <div><label htmlFor="forecast-inicio" className="mb-2 block text-xs font-semibold text-slate-300">Data inicial</label><input id="forecast-inicio" name="inicio" type="date" defaultValue={inicio} className="erp-field px-3 text-xs" /></div>
        <div><label htmlFor="forecast-fim" className="mb-2 block text-xs font-semibold text-slate-300">Data final</label><input id="forecast-fim" name="fim" type="date" defaultValue={fim} className="erp-field px-3 text-xs" /></div>
        <FilterSubmitButton />
      </form>
      <p className="mt-3 text-xs text-slate-400">50 itens por lote para conferência detalhada. O consolidado financeiro considera todos os itens dos filtros, com progresso de leitura e conferência de integridade.</p>
    </section>

    <GlobalPaymentForecast key={JSON.stringify([filters, dataBase, sourceTotal])} filters={filters} dataBase={dataBase} genericCodes={genericCodes} expectedTotal={sourceTotal} viewerId={user.id} />
    <PaymentForecastTable rows={rows} />

    <footer className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-4 text-xs text-slate-400"><span className="flex items-center gap-2"><CalendarClock size={15} /> Lote {pagina} de {pages} · {rows.length} itens. Valores não programados não são contados nos vencimentos.</span><div className="flex items-center gap-2">{pagina > 1 && <Link href={pageHref(filters, pagina - 1)} className="rounded-lg border border-white/15 px-3 py-2 text-slate-200">Anterior</Link>}<span>{pagina} / {pages}</span>{pagina < pages && <Link href={pageHref(filters, pagina + 1)} className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-cyan-200">Próximo lote</Link>}</div></footer>
  </div>
}
