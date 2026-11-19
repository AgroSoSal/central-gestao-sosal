"use client"

import Link from "next/link"
import { useMemo, useState, type ReactNode } from "react"
import {
  AlertCircle, ArrowLeft, ArrowUpRight, CalendarRange, ChartNoAxesCombined,
  CheckCircle2, ClipboardList, Database, Layers3, LockKeyhole,
  Search, ShieldCheck, SlidersHorizontal, Wallet, Warehouse,
} from "lucide-react"
import { ComprasSair } from "@/components/compras/compras-auth"
import type { OtbResult, OtbSubgroupMonth } from "@/domains/compras/domain/otb-calculation"
import type { OtbHistoricalSourceStatus } from "@/domains/compras/domain/otb-historical-source"
import type { OtbStockPosition } from "@/domains/compras/domain/otb-position-source"
import type { OtbPurchaseSourceStatus } from "@/domains/compras/domain/otb-source-status"
import { pageOtbPositions } from "@/domains/compras/domain/otb-position-paging"

type Props = {
  email: string
  purchaseSource: OtbPurchaseSourceStatus
  historicalSource: OtbHistoricalSourceStatus
  stockPosition: OtbStockPosition
  /** Reposição calculada pelo cenário 90%: apenas simulação, sem teto nem aprovação. */
  indicativeMonths?: {month:string;amount:number}[] | null
  /** Resultado de fonte oficial, validado NO SERVIDOR. Nunca arquivo no navegador. */
  officialScenario?: OtbResult | null
}
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const percentage = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 })
const integer = new Intl.NumberFormat("pt-BR")

const kindLabels: Record<OtbSubgroupMonth["kind"], string> = {
  S: "Mercadoria", P: "Produção própria", M: "Matéria-prima", N: "Fora da OTB",
}

function monthLabel(date: string): string {
  const [year, month] = date.split("-").map(Number)
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)))
}

function dateBR(date: string): string {
  const [year, month, day] = date.split("-")
  return `${day}/${month}/${year}`
}

function Balance({ value }: { value: number }) {
  return <span className={value < -0.005 ? "font-bold text-rose-300" : "font-semibold text-emerald-300"}>{money.format(value)}</span>
}

function Status({ value }: { value: string }) {
  const color = value === "LIBERADO" || value === "SEM NECESSIDADE"
    ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200"
    : value === "TRAVADO" || value === "ESTOUROU"
      ? "border-rose-300/25 bg-rose-400/10 text-rose-200"
      : "border-amber-300/25 bg-amber-400/10 text-amber-200"
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide ${color}`}>{value}</span>
}

function Metric({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: ReactNode }) {
  return <div className="erp-surface erp-reveal rounded-2xl p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[.13em] text-slate-400">{label}</p>
        <p className="mt-4 break-words text-[clamp(1.35rem,2.4vw,1.8rem)] font-bold tracking-tight text-white tabular-nums">{value}</p>
        <p className="mt-3 text-xs leading-5 text-slate-400">{sub}</p>
      </div>
      <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/10 p-3 text-cyan-300">{icon}</div>
    </div>
  </div>
}

export function OtbDashboard({ email, purchaseSource, historicalSource, stockPosition, indicativeMonths, officialScenario }: Props) {
  const result = officialScenario ?? null
  const [monthIndex, setMonthIndex] = useState(0)
  const [lineFilter, setLineFilter] = useState("")
  const [kindFilter, setKindFilter] = useState("")
  const [search, setSearch] = useState("")
  const [positionLine, setPositionLine] = useState("")
  const [positionSearch, setPositionSearch] = useState("")
  const [positionPage, setPositionPage] = useState(1)

  const month = result?.months[monthIndex]
  const lines = useMemo(() => [...new Set(month?.subgroups.map((item) => item.line) ?? [])].sort((a, b) => a.localeCompare(b, "pt-BR")), [month])
  const filtered = useMemo(() => (month?.subgroups ?? []).filter((item) =>
    (!lineFilter || item.line === lineFilter)
    && (!kindFilter || item.kind === kindFilter)
    && (!search.trim() || `${item.line} ${item.name}`.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))),
  ), [month, lineFilter, kindFilter, search])
  const filteredPositions = useMemo(() => stockPosition.subgroups.filter((entry) =>
    (!positionLine || String(entry.line) === positionLine)
    && (!positionSearch.trim() || entry.subgroup.toLocaleLowerCase("pt-BR").includes(positionSearch.trim().toLocaleLowerCase("pt-BR")))
  ).sort((a, b) => Math.abs(b.stockCost) - Math.abs(a.stockCost)), [stockPosition, positionLine, positionSearch])
  const positionsPage = pageOtbPositions(filteredPositions, positionPage)

  return <main className="mx-auto max-w-[1520px] space-y-6 pb-14 text-slate-100">
    <header className="erp-reveal flex flex-wrap items-center justify-between gap-4">
      <nav aria-label="Localização" className="flex flex-wrap items-center gap-3 text-[11px] font-bold uppercase tracking-[.17em] text-slate-500">
        <Link href="/" className="transition hover:text-cyan-300">Central de Gestão</Link>
        <span>/</span><Link href="/compras" className="transition hover:text-cyan-300">Compras</Link>
        <span>/</span><span className="text-cyan-300">OTB</span>
      </nav>
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="hidden items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-emerald-300 sm:inline-flex"><ShieldCheck size={13} /> Master ativo</span>
        <span className="hidden max-w-48 truncate md:inline" title={email}>{email}</span>
        <ComprasSair />
      </div>
    </header>

    <section className="erp-reveal relative isolate overflow-hidden rounded-[28px] border border-cyan-300/20 bg-[#081727] px-6 py-8 sm:px-10 sm:py-10">
      <div className="pointer-events-none absolute inset-0 opacity-50" style={{ backgroundImage: "linear-gradient(rgba(64,155,193,.075) 1px, transparent 1px), linear-gradient(90deg, rgba(64,155,193,.075) 1px, transparent 1px)", backgroundSize: "32px 32px", maskImage: "linear-gradient(90deg, transparent, black)" }} />
      <div className="pointer-events-none absolute -right-12 -top-24 h-80 w-80 rounded-full bg-cyan-500/15 blur-[85px]" />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.15em] text-cyan-200"><ChartNoAxesCombined size={14} /> Inteligência de compras</span>
          <h1 className="mt-5 text-3xl font-bold tracking-[-.045em] sm:text-[43px]">Open-to-<span className="bg-gradient-to-r from-white to-cyan-300 bg-clip-text text-transparent">Buy</span></h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">Planejamento mensal de compras, estoque, matéria-prima e orçamento por linha e subgrupo. Dados operacionais exclusivamente no Supabase.</p>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5"><CalendarRange size={13} className="text-cyan-300" /> Horizonte: três meses</span>
            <span className="text-slate-600">/</span>
            <span className="flex items-center gap-1.5"><LockKeyhole size={13} className="text-emerald-300" /> Consulta sem gravação</span>
          </div>
        </div>
        <Link href="/compras" className="inline-flex h-11 items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 text-xs font-bold text-cyan-100 transition hover:bg-cyan-300/20"><ArrowLeft size={16} /> Voltar para Compras</Link>
      </div>
    </section>

    <section className="erp-surface rounded-[24px] p-5 sm:p-7" aria-label="Origem e homologação da OTB">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.17em] text-cyan-400"><Database size={14} /> Estado da integração</p>
          <h2 className="mt-2 text-lg font-bold text-white">{result ? "Projeção oficial do Supabase" : indicativeMonths ? "Prévia operacional de reposição calculada" : "Aguardando a Projeção 12M do Supabase"}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {result
              ? `Cenário da fonte oficial do Supabase · origem ${result.source} · data-base ${dateBR(result.baseDate)}.`
              : indicativeMonths ? "Os volumes projetados por mês já podem ser consultados usando premissas 2.3.7 e dados atuais. Faltam a previsão de entrada dos pedidos, a matéria-prima e a conciliação do cenário de pior caso para transformar necessidade física em verba de compra."
                : "O banco atual não oferece uma fonte validada para o teto mensal de pior caso, o DDE projetado e todas as premissas da Projeção 12M. Para evitar valores de compras incorretos, os indicadores ficam indisponíveis até a integração oficial."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-4 text-xs font-bold text-emerald-200"><Database size={16} /> Somente Supabase</span>
          <Link href="/compras/otb/fluxo-caixa" className="inline-flex h-11 items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 text-xs font-bold text-cyan-200 hover:bg-cyan-400/20"><Wallet size={16}/> Extratos e fluxo 12M</Link>
          <Link href="/compras/cobertura" className="inline-flex h-11 items-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 text-xs font-bold text-white shadow-lg shadow-cyan-900/40 transition hover:brightness-110">Conferir o que falta</Link>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#2c455e] bg-[#071625]/50 px-4 py-3" aria-label="Conexão de pedidos com Supabase">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200"><Database size={16} className="text-cyan-300" /> Pedidos de compra · Supabase</div>
        {purchaseSource.status === "conectado" ? <div className="flex flex-wrap items-center gap-3 text-xs text-emerald-200"><span className="inline-flex items-center gap-1.5 font-bold"><CheckCircle2 size={14} /> Fonte conectada</span><span className="text-slate-300">{integer.format(purchaseSource.itemCount)} itens registrados</span><span className="text-slate-400">Importado em {new Date(purchaseSource.lastImportedAt).toLocaleString("pt-BR", { timeZone: "America/Campo_Grande", dateStyle: "short", timeStyle: "short" })}</span></div>
          : <span className="inline-flex items-center gap-2 text-xs font-semibold text-amber-200"><AlertCircle size={14} /> Resumo de importação indisponível — nenhuma quantidade presumida</span>}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#2c455e] bg-[#071625]/50 px-4 py-3" aria-label="Histórico comercial do Supabase">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200"><Database size={16} className="text-cyan-300" /> Histórico de vendas e CMV · Supabase</div>
        {historicalSource.status === "conectado" ? <div className="flex flex-wrap items-center gap-3 text-xs text-emerald-200">
          <span className="inline-flex items-center gap-1.5 font-bold"><CheckCircle2 size={14} /> Leitura conectada</span>
          <span className="text-slate-300">{integer.format(historicalSource.monthCount)} competências · até {monthLabel(historicalSource.lastMonth)}</span>
          <span className="text-slate-400">{integer.format(historicalSource.totalRecords)} itens de vendas e saídas</span>
        </div> : <span className="inline-flex items-center gap-2 text-xs font-semibold text-amber-200"><AlertCircle size={14} /> Histórico indisponível — sem valores presumidos</span>}
      </div>
      {historicalSource.status === "conectado" && <div role="status" className={`mt-3 rounded-xl border px-4 py-3 text-xs leading-6 ${historicalSource.completeLast12Months ? "border-cyan-300/20 bg-cyan-400/5 text-cyan-100" : "border-amber-300/25 bg-amber-400/10 text-amber-100"}`}>
        {historicalSource.unmappedRecords > 0 && <strong className="mr-2">Atenção: {integer.format(historicalSource.unmappedRecords)} itens sem linha 1–4.</strong>}
        {historicalSource.excludedRecords > 0 && <strong className="mr-2">{integer.format(historicalSource.excludedRecords)} itens de serviços classificados fora da OTB.</strong>}
        {historicalSource.completeLast12Months
          ? "As últimas 12 competências possuem vendas e saídas classificadas. Ainda faltam premissas financeiras e fluxo de caixa futuro para liberar a OTB."
          : "Histórico ainda não homologado para previsão automática: confira competências ausentes e classificações de produtos. As travas financeiras continuam bloqueadas."}
      </div>}
    </section>

    <section className="erp-surface overflow-hidden rounded-[24px]" aria-label="Estoque e CMV reais do Supabase">
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 sm:p-7">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.17em] text-cyan-300"><Warehouse size={15} /> Posição operacional conectada</p>
          <h2 className="mt-2 text-xl font-bold text-white">Estoque e CMV por subgrupo</h2>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-400">Foto real das seis filiais e custo das saídas dos últimos 90 dias. DDE observado = estoque a custo ÷ CMV diário. Esta leitura não é DDE-alvo, previsão nem verba autorizada.</p>
        </div>
        {stockPosition.status === "conectado" && <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-bold text-emerald-200">Fonte Supabase atualizada</span>}
      </div>
      {stockPosition.status === "indisponivel" ?
        <div role="status" className="border-t border-[#25354e] bg-amber-400/5 px-7 py-6 text-sm text-amber-200">Não foi possível ler a posição completa do estoque. Valores não estimados.</div>
        : <>
          <div className="grid gap-3 border-y border-[#25354e] bg-[#0a1929]/60 p-5 sm:grid-cols-3">
            <Metric label="Estoque atual a custo" value={money.format(stockPosition.stockCost)} sub={`${integer.format(stockPosition.stockSkus)} SKUs distintos · consolidado`} icon={<Warehouse size={20} />} />
            <Metric label="CMV real · últimos 90 dias" value={stockPosition.cmv90d === null ? "—" : money.format(stockPosition.cmv90d)} sub="Saída efetiva, não meta nem previsão" icon={<ChartNoAxesCombined size={20} />} />
            <Metric label="DDE observado · consolidado" value={stockPosition.cmv90d !== null && stockPosition.cmv90d > 0 ? `${integer.format(Math.round(stockPosition.stockCost * 90 / stockPosition.cmv90d))} dias` : "—"} sub="Referência calculada, sem DDE-alvo definido" icon={<CalendarRange size={20} />} />
          </div>
          <div className="flex flex-wrap items-end gap-4 p-5 sm:p-7">
            <label className="min-w-[240px] flex-1 text-xs font-semibold text-slate-300">Buscar subgrupo
              <input className="erp-field mt-2 w-full px-3" type="search" value={positionSearch} onChange={(event) => { setPositionSearch(event.target.value); setPositionPage(1) }} placeholder="Família ou subgrupo" />
            </label>
            <label className="min-w-[180px] text-xs font-semibold text-slate-300">Linha
              <select className="erp-field mt-2 w-full px-3" value={positionLine} onChange={(event) => { setPositionLine(event.target.value); setPositionPage(1) }}>
                <option value="">Todas as linhas</option>
                {[1, 2, 3, 4, 0, -1].map((line) => <option key={line} value={String(line)}>{line === -1 ? "Fora da OTB" : line === 0 ? "Sem linha" : `Linha ${line}`}</option>)}
              </select>
            </label>
            <p className="text-[11px] text-slate-400">{integer.format(filteredPositions.length)} subgrupos · foto {new Date(stockPosition.snapshotAt).toLocaleString("pt-BR", { timeZone: "America/Campo_Grande" })}</p>
          </div>
          <div className="overflow-x-auto"><table className="erp-table w-full min-w-[850px] text-left text-xs">
            <thead className="bg-[#121e30] text-[10px] uppercase tracking-wide text-slate-400"><tr><th className="p-4">Linha</th><th className="p-4">Grupo / Subgrupo</th><th className="p-4 text-right">SKUs</th><th className="p-4 text-right">Estoque a custo</th><th className="p-4 text-right">CMV 90 dias</th><th className="p-4 text-right">DDE observado</th></tr></thead>
            <tbody className="divide-y divide-[#1c2b40]">{positionsPage.items.map((entry) => <tr key={`${entry.line}|${entry.subgroup}`}>
              <td className="p-4 font-bold text-cyan-300">{entry.line === -1 ? "Fora" : entry.line === 0 ? "Pendente" : entry.line}</td>
              <td className="max-w-[440px] p-4 text-slate-100">{entry.subgroup}</td>
              <td className="p-4 text-right tabular-nums">{integer.format(entry.skuCount)}</td>
              <td className="p-4 text-right tabular-nums">{money.format(entry.stockCost)}</td>
              <td className="p-4 text-right tabular-nums">{entry.cmv90d === null ? "—" : money.format(entry.cmv90d)}</td>
              <td className="p-4 text-right tabular-nums">{entry.observedDde === null ? "—" : `${integer.format(Math.round(entry.observedDde))} dias`}</td>
            </tr>)}</tbody>
          </table></div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-xs text-slate-400">
            <p>Exibindo {positionsPage.from}–{positionsPage.to} de {positionsPage.total} subgrupos filtrados. Todos os registros podem ser consultados; nenhum saldo foi alterado.</p>
            <div className="flex items-center gap-3" aria-label="Paginação dos subgrupos">
              <button type="button" disabled={positionsPage.page <= 1} onClick={() => setPositionPage((page) => page - 1)} className="rounded-lg border border-cyan-300/20 px-3 py-2 font-semibold text-cyan-200 disabled:cursor-not-allowed disabled:opacity-35">Anterior</button>
              <span className="whitespace-nowrap">{positionsPage.page} / {positionsPage.totalPages}</span>
              <button type="button" disabled={positionsPage.page >= positionsPage.totalPages} onClick={() => setPositionPage((page) => page + 1)} className="rounded-lg border border-cyan-300/20 px-3 py-2 font-semibold text-cyan-200 disabled:cursor-not-allowed disabled:opacity-35">Próxima</button>
            </div>
          </div>
        </>}
    </section>

    {indicativeMonths && <section className="rounded-[24px] border border-cyan-300/20 bg-cyan-400/[.035] p-6 sm:p-7" aria-label="Prévia operacional dos três meses de compras">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.17em] text-cyan-300">OTB!B7 · três meses à frente</p><h2 className="mt-2 text-lg font-bold">Reposição prevista antes da trava financeira</h2><p className="mt-2 max-w-4xl text-xs leading-6 text-slate-400">Cenário de demanda a 90% com estoque atual e DDE por linha. Projeção operacional da Zacarini 2.3.7, recalculada com Supabase. Os pedidos já emitidos ainda não têm entregas confirmadas por item; esses volumes não são verba autorizada.</p></div><span className="rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-[10px] font-bold text-amber-200">Simulado · não libera compras</span></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">{indicativeMonths.map((item,i)=><div key={item.month} className="rounded-xl border border-cyan-300/15 bg-[#0b1626] p-5"><p className="text-[10px] font-bold uppercase text-slate-400">Mês {i+1} · {monthLabel(item.month)}</p><p className="mt-3 text-2xl font-bold tabular-nums text-white">{money.format(item.amount)}</p><p className="mt-2 text-[11px] text-amber-200">Necessidade de reposição simulada, sem conciliar pedidos em trânsito</p></div>)}</div>
      <p className="mt-4 text-xs leading-6 text-amber-100">O teto por mês, a reserva de matéria-prima, o saldo do comprador e o status “LIBERADO” permanecem indisponíveis enquanto a Projeção 12M oficial não estiver homologada. Não gravamos pedidos nem saldos automaticamente.</p>
    </section>}

    {!month ? <>
      <div className="grid gap-4 md:grid-cols-3" aria-label="Indicadores indisponíveis">
        <Metric label="Teto mensal de caixa" value="—" sub="Depende do pior caso da Projeção 12M" icon={<Wallet size={20} />} />
        <Metric label="Necessidade de compras" value="—" sub="Depende do CMV, estoque e DDE projetado" icon={<Warehouse size={20} />} />
        <Metric label="Verba liberada" value="—" sub="Calculada após reservar matéria-prima" icon={<CheckCircle2 size={20} />} />
      </div>
      <section className="rounded-[24px] border border-amber-300/20 bg-amber-500/[.055] p-6 sm:p-8" role="status">
        <div className="flex items-start gap-4">
          <AlertCircle size={24} className="mt-0.5 shrink-0 text-amber-300" />
          <div>
            <h2 className="text-lg font-bold text-amber-100">Posição operacional disponível · autorização de compras ainda pendente</h2>
            <p className="mt-2 max-w-4xl text-sm leading-7 text-amber-100/75">Continue consultando pedidos, fazendo Follow-up e negociando rascunhos. Os extratos bancários já estão no Supabase e podem ser conferidos na nova tela de fluxo de caixa. A verba oficial exige ainda projeção financeira homologada, matéria-prima e saldo por subgrupo. Não criaremos verba fictícia neste intervalo.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { number: "01", title: "Projeção 12M", ready: false, note: "Pior caso de caixa, despesas e recebimentos a homologar" },
                { number: "02", title: "Estoque e CMV", ready: stockPosition.status === "conectado", note: stockPosition.status === "conectado" ? "Posição observada conectada; DDE-alvo e previsão ainda pendentes" : "Posição da fonte indisponível" },
                { number: "03", title: "Carteira de pedidos", ready: purchaseSource.status === "conectado", note: purchaseSource.status === "conectado" ? "Resumo conectado; faltam saldos gravados por subgrupo" : "Resumo da carteira indisponível" },
                { number: "04", title: "Produção e MP", ready: false, note: "Necessidade futura da matéria-prima não homologada" },
              ].map(({ number, title, ready, note }) => <div key={number} className="rounded-xl border border-amber-300/10 bg-black/10 px-4 py-4"><div className="flex items-center justify-between gap-2"><p className="font-mono text-xs text-amber-300/80">{number}</p><span className={`text-[10px] font-bold ${ready ? "text-emerald-300" : "text-amber-200"}`}>{ready ? "Fonte conectada" : "Pendente"}</span></div><p className="mt-2 text-sm font-bold text-slate-100">{title}</p><p className="mt-1 text-xs leading-5 text-slate-400">{note}</p></div>)}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-4"><Link href="/compras/otb/fluxo-caixa" className="inline-flex items-center gap-2 text-xs font-bold text-cyan-200 hover:text-cyan-100">Abrir conciliação bancária e agenda 12M <ArrowUpRight size={14}/></Link><Link href="/compras/cobertura" className="inline-flex items-center gap-2 text-xs font-bold text-cyan-200 hover:text-cyan-100">Ver comparação com a Zacarini <ArrowUpRight size={14}/></Link></div>
          </div>
        </div>
      </section>
    </> : <>
      <div role="status" className="flex flex-wrap items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-3 text-xs leading-5 text-cyan-100"><ShieldCheck size={17} className="shrink-0" /> Cenário recebido exclusivamente da fonte oficial do Supabase. Nenhuma autorização de pedido é gerada automaticamente.</div>

      <section className="erp-surface overflow-hidden rounded-[22px] p-2" aria-label="Selecionar mês da OTB">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {result!.months.map((entry, index) => <button key={entry.month} type="button" aria-pressed={monthIndex === index} onClick={() => { setMonthIndex(index); setLineFilter(""); setKindFilter(""); setSearch("") }} className={`rounded-2xl border px-5 py-4 text-left transition ${monthIndex === index ? "border-cyan-300/40 bg-cyan-400/15 shadow-[inset_0_1px_rgba(255,255,255,.06)]" : "border-transparent hover:border-[#334b68] hover:bg-[#15263b]"}`}>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Mês {index + 1}</p>
            <p className={`mt-1 text-base font-bold capitalize ${monthIndex === index ? "text-cyan-200" : "text-slate-200"}`}>{monthLabel(entry.month)}</p>
            <div className="mt-3"><Status value={entry.cashStatus} /></div>
          </button>)}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores de OTB do mês">
        <Metric label="Teto de caixa" value={money.format(month.cashCap)} sub="Pior caso mensal da fonte informada" icon={<Wallet size={20} />} />
        <Metric label="Necessidade total" value={money.format(month.totalNeed)} sub="Matéria-prima + mercadorias" icon={<Warehouse size={20} />} />
        <Metric label="Verba liberada" value={money.format(month.releasedTotal)} sub="Distribuição limitada pelo caixa" icon={<CheckCircle2 size={20} />} />
        <Metric label="Saldo de mercadorias" value={money.format(month.freeBalance)} sub="Após pedidos, vendas casadas e excessos" icon={<ClipboardList size={20} />} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <article className="erp-surface rounded-[24px] p-6">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.17em] text-cyan-300"><Layers3 size={14} /> Ordem de prioridade</p>
          <h2 className="mt-2 text-lg font-bold">Alocação do caixa</h2>
          <div className="mt-6 space-y-5">
            {[
              ["01 · Matéria-prima", month.mpReleased, month.mpNeed, "bg-emerald-400"],
              ["02 · Mercadorias", month.releasedMerchandise, month.needMerchandise, "bg-cyan-400"],
            ].map(([label, released, needed, color]) => {
              const allocated = Number(released)
              const requirement = Number(needed)
              return <div key={String(label)}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-semibold text-slate-200">{String(label)}</span><span className="tabular-nums text-slate-400">{money.format(allocated)} / {money.format(requirement)}</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#273750]"><div className={`h-full rounded-full ${color}`} style={{ width: `${requirement > 0 ? Math.min(100, allocated / requirement * 100) : 0}%` }} /></div>
              </div>
            })}
          </div>
          <p className="mt-5 text-xs text-slate-500">Do valor disponível após MP, a curva A é atendida primeiro. O restante é rateado aos demais itens.</p>
        </article>
        <article className="erp-surface rounded-[24px] p-6">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.17em] text-cyan-300"><SlidersHorizontal size={14} /> Governança de orçamento</p>
          <h2 className="mt-2 text-lg font-bold">Distribuição 90% / 10%</h2>
          <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-[#24334c]"><div className="bg-cyan-400" style={{ width: `${month.releasedTotal > 0 ? month.buyerBudget / month.releasedTotal * 100 : 90}%` }} /><div className="flex-1 bg-violet-400" /></div>
          <dl className="mt-6 grid grid-cols-2 gap-3">
            <div><dt className="text-xs text-slate-400">Comprador · 90%</dt><dd className="mt-2 text-xl font-bold text-cyan-200 tabular-nums">{money.format(month.buyerBudget)}</dd></div>
            <div><dt className="text-xs text-slate-400">Diretoria · 10%</dt><dd className="mt-2 text-xl font-bold text-violet-200 tabular-nums">{money.format(month.directorReserve)}</dd></div>
          </dl>
          <p className="mt-5 text-xs text-slate-500">Divisão da verba liberada; não aumenta o limite mensal.</p>
        </article>
      </section>

      <section className="erp-surface overflow-hidden rounded-[24px]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#25354e] p-5 sm:p-7"><div><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.17em] text-cyan-300"><Layers3 size={14} /> Visão gerencial</p><h2 className="mt-2 text-xl font-bold">Orçamento por linha</h2><p className="mt-1 text-xs text-slate-400">O saldo da linha já considera excesso; não confundir com o saldo bruto do subgrupo.</p></div><Status value={month.cashStatus} /></div>
        <div className="overflow-x-auto"><table className="erp-table w-full min-w-[900px] text-left text-xs">
          <thead className="bg-[#121e30] text-[10px] uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-4">Linha</th><th className="px-5 py-4 text-right">Liberado</th><th className="px-5 py-4 text-right">Comprador 90%</th><th className="px-5 py-4 text-right">Diretoria 10%</th><th className="px-5 py-4 text-right">Já gravado</th><th className="px-5 py-4 text-right">Excesso</th><th className="px-5 py-4 text-right">Saldo livre</th></tr></thead>
          <tbody className="divide-y divide-[#1c2b40]">{month.lines.map((line) => <tr key={line.line}><td className="px-5 py-4 font-semibold text-cyan-200">{line.line}</td><td className="px-5 py-4 text-right tabular-nums">{money.format(line.released)}</td><td className="px-5 py-4 text-right tabular-nums">{money.format(line.buyerBudget)}</td><td className="px-5 py-4 text-right tabular-nums">{money.format(line.directorReserve)}</td><td className="px-5 py-4 text-right tabular-nums">{money.format(line.recorded)}</td><td className="px-5 py-4 text-right tabular-nums">{money.format(line.excess)}</td><td className="px-5 py-4 text-right tabular-nums"><Balance value={line.freeBalance} /></td></tr>)}
            {!month.lines.length && <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400">Nenhuma linha de mercadorias neste cenário.</td></tr>}
          </tbody>
        </table></div>
      </section>

      <section className="erp-surface overflow-hidden rounded-[24px]">
        <div className="border-b border-[#25354e] p-5 sm:p-7">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.17em] text-cyan-300"><SlidersHorizontal size={14} /> Detalhamento</p>
          <h2 className="mt-2 text-xl font-bold">Subgrupos e necessidades</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_240px_220px]">
            <label className="relative"><span className="mb-2 block text-xs font-semibold text-slate-300">Buscar subgrupo</span><Search size={16} className="pointer-events-none absolute bottom-3.5 left-3.5 text-slate-500" /><input className="erp-field pl-10 pr-3 text-sm" type="search" placeholder="Nome ou linha" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
            <label><span className="mb-2 block text-xs font-semibold text-slate-300">Linha</span><select className="erp-field px-3 text-sm" value={lineFilter} onChange={(event) => setLineFilter(event.target.value)}><option value="">Todas as linhas</option>{lines.map((line) => <option key={line} value={line}>{line}</option>)}</select></label>
            <label><span className="mb-2 block text-xs font-semibold text-slate-300">Classificação</span><select className="erp-field px-3 text-sm" value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}><option value="">Todas</option>{Object.entries(kindLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">{filtered.length} de {month.subgroups.length} subgrupos · filtragem apenas visual, não altera os totais.</p>
        </div>
        <div className="overflow-x-auto"><table className="erp-table w-full min-w-[1880px] text-left text-xs">
          <thead className="bg-[#121e30] text-[10px] uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-4">Linha / subgrupo</th><th className="px-5 py-4">Tipo</th><th className="px-5 py-4 text-right">Curva A</th><th className="px-5 py-4 text-right">Estoque inicial</th><th className="px-5 py-4 text-right">CMV previsto</th><th className="px-5 py-4 text-right">Estoque-alvo</th><th className="px-5 py-4 text-right">Necessidade</th><th className="px-5 py-4 text-right">Liberado</th><th className="px-5 py-4 text-right">Gravado</th><th className="px-5 py-4 text-right">Venda casada</th><th className="px-5 py-4 text-right">Excesso</th><th className="px-5 py-4 text-right">Saldo bruto</th><th className="px-5 py-4 text-right">Estoque projetado</th><th className="px-5 py-4">Situação</th></tr></thead>
          <tbody className="divide-y divide-[#1c2b40]">{filtered.map((item) => <tr key={`${item.line}\0${item.name}`}><td className="max-w-64 px-5 py-4"><p className="text-[10px] font-bold text-cyan-300">{item.line}</p><p className="mt-1 font-semibold text-slate-100">{item.name}</p></td><td className="px-5 py-4 text-slate-300">{kindLabels[item.kind]}</td><td className="px-5 py-4 text-right tabular-nums">{percentage.format(item.curveAShare)}</td><td className="px-5 py-4 text-right tabular-nums">{money.format(item.openingStock)}</td><td className="px-5 py-4 text-right tabular-nums">{money.format(item.forecastCost)}</td><td className="px-5 py-4 text-right tabular-nums">{money.format(item.targetStock)}</td><td className="px-5 py-4 text-right font-semibold tabular-nums">{money.format(item.need)}</td><td className="px-5 py-4 text-right font-semibold text-cyan-200 tabular-nums">{money.format(item.released)}</td><td className="px-5 py-4 text-right tabular-nums">{money.format(item.recorded)}</td><td className="px-5 py-4 text-right tabular-nums">{money.format(item.tiedSales)}</td><td className="px-5 py-4 text-right tabular-nums">{money.format(item.excess)}</td><td className="px-5 py-4 text-right tabular-nums"><Balance value={item.freeBalance} /></td><td className="px-5 py-4 text-right tabular-nums">{money.format(item.closingStock)}</td><td className="px-5 py-4"><Status value={item.status} /></td></tr>)}
            {!filtered.length && <tr><td colSpan={14} className="px-6 py-10 text-center text-slate-400">Nenhum subgrupo corresponde aos filtros.</td></tr>}
          </tbody>
        </table></div>
      </section>
    </>}

    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/70 py-4 text-xs text-slate-500"><span>OTB / Projeção 12M · fonte única Supabase</span><Link href="/compras" className="inline-flex items-center gap-1.5 font-bold text-cyan-300 transition hover:text-cyan-100">Consulta de pedidos <ArrowUpRight size={13} /></Link></footer>
  </main>
}
