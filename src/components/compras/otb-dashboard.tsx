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
import type { OtbSubgroupPreview } from "@/domains/compras/domain/otb-subgroup-preview"
import type { OtbSeasonalHistory } from "@/domains/compras/domain/otb-seasonal-source"
import type { OtbAbcProjection } from "@/domains/compras/domain/otb-abc-projection-237"
import type { OtbConsignedStock } from "@/domains/compras/domain/otb-consigned-stock-237"
import { buildOtbTestSimulation } from "@/domains/compras/domain/otb-test-simulation"
import type { CashForecastResult } from "@/domains/compras/domain/zacarini-cash-forecast"
import { assessOtbGoLive, type OtbGoLiveStatus } from "@/domains/compras/domain/otb-go-live-readiness"
import { OtbProjectionDraft } from "@/components/compras/otb-projection-draft"
import { OtbBuyer238Panel } from "@/components/compras/otb-buyer-238-panel"
import type { OtbAutomaticReference238 } from "@/domains/compras/domain/otb-automatic-reference-238"
import type { Otb12mDraftHeader } from "@/domains/compras/domain/otb-projection-draft-12m"

type Props = {
  email: string
  purchaseSource: OtbPurchaseSourceStatus
  historicalSource: OtbHistoricalSourceStatus
  stockPosition: OtbStockPosition
  /** Reposição calculada pelo cenário 90%: apenas simulação, sem teto nem aprovação. */
  indicativeMonths?: {month:string;amount:number}[] | null
  /** Por que a simulação não foi calculada, sem mascarar falhas de dados. */
  forecastIssues?: readonly string[]
  /** Série financeira 12M gerada pelo motor existente, somente simulação. */
  forecast?: CashForecastResult
  /** Comprovação efetiva das fontes oficiais, exclusivamente RPC protegida Master. */
  readinessStatus?: OtbGoLiveStatus | null
  recentDrafts?: readonly Otb12mDraftHeader[]
  draftSourceError?: boolean
  /** Prévia de estoque por subgrupo. Não é cenário oficial nem autorização. */
  subgroupPreview?: OtbSubgroupPreview | null
  /** Vendas entregues das quatro janelas da aba fx_VendaSubgrupo. */
  seasonalHistory?: OtbSeasonalHistory
  /** Venda e margem estimadas por SKU conforme ABCEstoque_DDE!D:P. */
  abcProjection?: OtbAbcProjection
  /** Estoque da OTB já líquido de GALLAGHER; bruto permanece em stockPosition. */
  consignedPosition?: OtbConsignedStock
  /** Resultado de fonte oficial, validado NO SERVIDOR. Nunca arquivo no navegador. */
  officialScenario?: OtbResult | null
  /** Referência automática de dados reais, mas com pendências explícitas; não aprova pedidos. */
  automaticReference?: OtbAutomaticReference238
  /** Data-base do servidor, para manter a simulação estável e sem dependência do relógio do cliente. */
  simulationBaseDate?: string
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

function Status({ value, simulated = false }: { value: string; simulated?: boolean }) {
  const color = value === "LIBERADO" || value === "SEM NECESSIDADE"
    ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200"
    : value === "TRAVADO" || value === "ESTOUROU"
      ? "border-rose-300/25 bg-rose-400/10 text-rose-200"
      : "border-amber-300/25 bg-amber-400/10 text-amber-200"
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide ${color}`}>{simulated ? `${value} · TESTE` : value}</span>
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

export function OtbDashboard({ email, purchaseSource, historicalSource, stockPosition, indicativeMonths, forecastIssues, forecast, readinessStatus, recentDrafts, draftSourceError, subgroupPreview, seasonalHistory, abcProjection, consignedPosition, officialScenario, automaticReference, simulationBaseDate }: Props) {
  const goLive = assessOtbGoLive(readinessStatus ?? null)
  const [testActive, setTestActive] = useState(false)
  const [testCashCaps, setTestCashCaps] = useState<[string, string, string]>(["120000", "150000", "180000"])
  const [testMpNeeds, setTestMpNeeds] = useState<[string, string, string]>(["15000", "20000", "25000"])
  const validNumber = (value: string) => value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0
  const testValid = testCashCaps.every(validNumber) && testMpNeeds.every(validNumber)
  const simulation = useMemo(() => testActive && testValid
    ? buildOtbTestSimulation({
      baseDate: simulationBaseDate ?? new Date().toISOString().slice(0, 10), preview: subgroupPreview,
      cashCaps: testCashCaps.map(Number) as [number, number, number],
      mpNeeds: testMpNeeds.map(Number) as [number, number, number],
    }) : null,
  [testActive, testValid, simulationBaseDate, subgroupPreview, testCashCaps, testMpNeeds])
  const automaticResult = automaticReference?.state==="referencia_parcial" ? automaticReference.result : null
  const indicativeActive=!testActive && !officialScenario && !!automaticResult
  const result = testActive ? simulation?.result ?? null : officialScenario ?? automaticResult
  const [monthIndex, setMonthIndex] = useState(0)
  const [lineFilter, setLineFilter] = useState("")
  const [kindFilter, setKindFilter] = useState("")
  const [search, setSearch] = useState("")
  const [positionLine, setPositionLine] = useState("")
  const [positionSearch, setPositionSearch] = useState("")
  const [positionPage, setPositionPage] = useState(1)
  const [previewLine, setPreviewLine] = useState("")
  const [previewPage, setPreviewPage] = useState(1)
  const [seasonalLine,setSeasonalLine] = useState("")
  const [seasonalPage,setSeasonalPage] = useState(1)

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
  const filteredPreview = useMemo(() => subgroupPreview?.state==="calculado"
    ? subgroupPreview.rows.filter(row=>!previewLine||String(row.line)===previewLine)
    :[],[subgroupPreview,previewLine])
  const previewPaged = pageOtbPositions(filteredPreview,previewPage,30)
  const seasonalRows=seasonalHistory?.state==="conectado"?seasonalHistory.groups.filter(r=>
    !seasonalLine||String(r.line)===seasonalLine):[]
  const seasonalPaged=pageOtbPositions(seasonalRows,seasonalPage,25)

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

    <section className="erp-surface rounded-[24px] border border-amber-300/25 p-5 sm:p-7" aria-label="Bancada de simulação da OTB">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-[10px] font-bold uppercase tracking-[.17em] text-amber-300">Modo teste · planilha Zacarini 2.3.7</p>
          <h2 className="mt-2 text-xl font-bold text-white">Teste os cálculos sem atualizar o banco</h2>
          <p className="mt-2 text-xs leading-6 text-slate-300">Simule as verbas dos próximos três meses, a prioridade da matéria-prima, a curva A e a divisão comprador 90% / diretoria 10%. Os subgrupos com prévia completa no Supabase entram no cálculo; se nenhum estiver pronto, usamos dados de exemplo identificados.</p>
        </div>
        <button type="button" onClick={() => { setTestActive(active => !active); setMonthIndex(0) }}
          className="inline-flex h-11 items-center rounded-xl bg-amber-400 px-5 text-xs font-bold text-slate-950 transition hover:bg-amber-300">
          {testActive ? "Encerrar simulação" : "Iniciar simulação de teste"}
        </button>
      </div>
      {testActive && <>
        <div role="status" aria-label="Simulação de teste ativa" className="mt-5 rounded-xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-100">
          <strong>Simulação de teste ativa — não autoriza compras.</strong> {simulation?.origin === "previa_supabase"
            ? `Prévia do Supabase usada para ${simulation.result.months[0].subgroups.length} subgrupos; ${simulation.excludedGroups} grupo(s) incompleto(s) excluído(s).`
            : "Cálculo com dados de exemplo, sem ligação com o orçamento real."}
          {simulation?.origin === "previa_supabase" && simulation.assumedCurveAGroups > 0
            ? ` Em ${simulation.assumedCurveAGroups} grupo(s), a curva A ausente foi assumida em 50% somente para testar.` : ""}
          <span className="block text-xs text-amber-200">Tetos e matéria-prima abaixo são digitados para teste. Pedidos anteriores, já gravados e vendas casadas não estão conciliados nesta simulação (valor zero). Nenhum registro é gravado no Supabase.</span>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2" aria-label="Premissas editáveis da simulação">
          <fieldset className="grid grid-cols-3 gap-3">
            <legend className="mb-3 text-sm font-bold text-slate-200">Teto mensal de caixa (R$)</legend>
            {testCashCaps.map((value, index) => <label key={index} className="text-xs text-slate-300">Mês {index + 1}
              <input aria-label={`Teto de caixa · mês ${index + 1}`} type="number" min="0" step="1000" inputMode="decimal"
                className="erp-field mt-2 w-full px-3 tabular-nums" value={value}
                onChange={event => setTestCashCaps(current => current.map((item, i) => i === index ? event.target.value : item) as [string, string, string])} />
            </label>)}
          </fieldset>
          <fieldset className="grid grid-cols-3 gap-3">
            <legend className="mb-3 text-sm font-bold text-slate-200">Reserva de matéria-prima (R$)</legend>
            {testMpNeeds.map((value, index) => <label key={index} className="text-xs text-slate-300">Mês {index + 1}
              <input aria-label={`Matéria-prima · mês ${index + 1}`} type="number" min="0" step="1000" inputMode="decimal"
                className="erp-field mt-2 w-full px-3 tabular-nums" value={value}
                onChange={event => setTestMpNeeds(current => current.map((item, i) => i === index ? event.target.value : item) as [string, string, string])} />
            </label>)}
          </fieldset>
        </div>
        {!testValid && <p role="alert" className="mt-3 text-sm font-semibold text-rose-300">Preencha os seis valores com números maiores ou iguais a zero para recalcular.</p>}
      </>}
    </section>

    <section className="erp-surface rounded-[24px] p-5 sm:p-7" aria-label="Origem e homologação da OTB">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.17em] text-cyan-400"><Database size={14} /> Estado da integração</p>
          <h2 className="mt-2 text-lg font-bold text-white">{testActive ? "OTB em simulação · sem homologação" : officialScenario ? "Projeção oficial do Supabase" : indicativeActive ? "OTB calculado automaticamente · referência operacional" : indicativeMonths ? "Prévia operacional de reposição calculada" : "Aguardando a Projeção 12M do Supabase"}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {testActive ? "Os indicadores completos abaixo são apenas o resultado do motor de cálculo com premissas de teste. Os números não representam teto de caixa real, aprovação financeira nem liberação de pedidos."
              : result
              ? `Cenário da fonte oficial do Supabase · origem ${result.source} · data-base ${dateBR(result.baseDate)}.`
              : indicativeMonths ? "Os volumes projetados por mês já podem ser consultados usando premissas 2.3.7 e dados atuais. Faltam a previsão de entrada dos pedidos, a matéria-prima e a conciliação do cenário de pior caso para transformar necessidade física em verba de compra."
                : "O banco atual não oferece uma fonte validada para o teto mensal de pior caso, o DDE projetado e todas as premissas da Projeção 12M. Para evitar valores de compras incorretos, os indicadores ficam indisponíveis até a integração oficial."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-4 text-xs font-bold text-emerald-200"><Database size={16} /> {testActive ? "Teste sem gravação" : "Somente Supabase"}</span>
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


    <section className="erp-surface rounded-[24px] p-5 sm:p-7" aria-label="Checklist real de homologação">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.17em] text-cyan-300"><ShieldCheck size={14} className="mr-2 inline"/>Governança financeira · dados reais</p>
          <h2 className="mt-2 text-xl font-bold text-white">Checklist de homologação do OTB</h2>
          <p className="mt-2 max-w-4xl text-xs leading-6 text-slate-400">Status consultado diretamente no Supabase. Auditoria interna dos extratos e confirmação de ausência de movimento não são conciliação com banco. As referências da Zacarini não se tornam premissas homologadas automaticamente.</p>
        </div>
        <Status value={goLive.safeToRelease ? "LIBERADO" : "TRAVADO"}/>
      </div>
      {goLive.available&&readinessStatus?
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/5 p-4"><p className="text-xs text-slate-400">Contas com saldo</p><p className="mt-2 text-xl font-bold tabular-nums">{readinessStatus.caixa.saldos}/{readinessStatus.caixa.contas}</p><p className="mt-1 text-[11px] text-amber-200">{readinessStatus.caixa.conciliadas} conciliadas oficialmente</p></div>
            <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/5 p-4"><p className="text-xs text-slate-400">Arquivos conferidos</p><p className="mt-2 text-xl font-bold tabular-nums">{readinessStatus.arquivos.auditados}/{readinessStatus.arquivos.importados}</p><p className="mt-1 text-[11px] text-slate-400">{readinessStatus.arquivos.reenvios_sem_movimento_informado} reenvios atestados · {readinessStatus.arquivos.cargas_anteriores_sem_ateste} sem confirmação</p></div>
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4"><p className="text-xs text-slate-400">Premissas homologadas</p><p className="mt-2 text-xl font-bold tabular-nums">{readinessStatus.premissas.homologadas}</p><p className="mt-1 text-[11px] text-slate-400">{readinessStatus.premissas.referencias} referências ainda não aprovadas</p></div>
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4"><p className="text-xs text-slate-400">Meses de Projeção 12M homologados</p><p className="mt-2 text-xl font-bold tabular-nums">{readinessStatus.projecao.linhas_homologadas}</p><p className="mt-1 text-[11px] text-slate-400">Exigência de 12 competências e alçada Master</p></div>
          </div>
          {readinessStatus.pendencias.length>0&&<p className="mt-4 text-xs text-slate-400">Pendências de extrato/caixa registradas: {readinessStatus.pendencias.map(item=>item.conta ? `${item.conta} · ${item.tipo.replaceAll("_"," ")}` : item.tipo.replaceAll("_"," ")).join("; ")}.</p>}
        </>:<p role="alert" className="mt-4 rounded-xl border border-amber-300/25 bg-amber-400/10 p-4 text-xs text-amber-100">Não foi possível conferir a fonte protegida da homologação. Nenhum teto foi liberado.</p>}
      <div className="mt-5 rounded-xl border border-amber-400/25 bg-amber-400/5 p-4 text-xs leading-6 text-amber-100">
        <p className="font-bold">Condições para liberar orçamento</p>
        <ul className="mt-2 list-inside list-disc space-y-1">{goLive.blockers.map(item=><li key={item}>{item}</li>)}</ul>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href="/compras/otb/fluxo-caixa" className="inline-flex h-10 items-center rounded-xl border border-cyan-300/30 px-4 text-xs font-bold text-cyan-200 hover:bg-cyan-400/10">Extratos, saldos e títulos</Link>
        <Link href="/compras/otb/premissas" className="inline-flex h-10 items-center rounded-xl border border-cyan-300/30 px-4 text-xs font-bold text-cyan-200 hover:bg-cyan-400/10">Premissas financeiras</Link>
      </div>
    </section>

    <section className="erp-surface overflow-hidden rounded-[24px]" aria-label="Simulação da Projeção 12M baseada na Zacarini">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-[#25354e] p-5 sm:p-7">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.17em] text-cyan-300"><ChartNoAxesCombined size={15}/> Motor Zacarini · 12 competências</p>
          <h2 className="mt-2 text-xl font-bold text-white">Projeção 12M simulada · três cenários e pior caso</h2>
          <p className="mt-2 max-w-4xl text-xs leading-6 text-slate-400">Motor financeiro existente da versão 2.3.7: combina saldos e títulos identificados, estoque a custo, CMV e premissas de referência para projetar cenários de caixa. Os resultados são estudos de sensibilidade, não o caixa real futuro nem o teto oficial de compras.</p>
        </div>
        <span className="rounded-lg border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-[11px] font-bold text-amber-100">Referência · não autoriza compras</span>
      </div>
      {forecast?.state==="simulado"?
        <>
          <div className="grid gap-3 border-b border-[#25354e] p-5 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-700 p-4"><p className="text-xs text-slate-400">Pior caixa projetado de referência</p><p className="mt-2 text-xl font-bold tabular-nums"><Balance value={forecast.minimumWorst12}/></p></div>
            <div className="rounded-xl border border-slate-700 p-4"><p className="text-xs text-slate-400">Saldo no último mês · cenário 90%</p><p className="mt-2 text-xl font-bold tabular-nums"><Balance value={forecast.final12}/></p></div>
            <div className="rounded-xl border border-slate-700 p-4"><p className="text-xs text-slate-400">Colchão da referência</p><p className="mt-2 text-xl font-bold tabular-nums text-white">{money.format(forecast.safetyFloor)}</p></div>
          </div>
          <div className="overflow-x-auto">
            <table className="erp-table w-full min-w-[960px] text-left text-xs">
              <thead className="bg-[#121e30] uppercase tracking-wider text-slate-400"><tr><th className="p-4">Mês</th><th className="p-4 text-right">Cenário 90%</th><th className="p-4 text-right">Plano</th><th className="p-4 text-right">Histórico</th><th className="p-4 text-right">Pior caso</th><th className="p-4 text-right">Reposição simulada</th></tr></thead>
              <tbody className="divide-y divide-slate-800">{forecast.monthLabels.map((month,i)=><tr key={month}>
                <td className="p-4 font-bold capitalize text-cyan-200">{monthLabel(month)}</td>
                <td className="p-4 text-right tabular-nums"><Balance value={forecast.monthly.noventa[i]}/></td>
                <td className="p-4 text-right tabular-nums"><Balance value={forecast.monthly.plano[i]}/></td>
                <td className="p-4 text-right tabular-nums"><Balance value={forecast.monthly.historico[i]}/></td>
                <td className="p-4 text-right tabular-nums"><Balance value={forecast.monthlyWorst[i]}/></td>
                <td className="p-4 text-right tabular-nums">{money.format(forecast.monthlyNewPurchases.noventa[i])}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="p-5 text-[11px] leading-6 text-amber-100">
            <strong>Premissas não homologadas:</strong> {forecast.warnings.join(" ")} O motor não preenche lacunas de conciliação, DDE, matéria-prima ou pedidos como se fossem zeros.
          </div>
        </>:
        <div role="status" className="p-6 text-xs leading-6 text-amber-200">
          <p className="font-bold">A simulação de 12 meses não pode ser calculada com a cobertura atual.</p>
          <ul className="mt-3 list-inside list-disc space-y-1">{(forecast?.state==="indisponivel"?forecast.reasons:forecastIssues??["Fonte financeira indisponível."]).map(x=><li key={x}>{x}</li>)}</ul>
          <p className="mt-3 text-slate-400">A tabela de títulos já contratados permanece disponível no fluxo de caixa. Não foi preenchido nenhum mês com dados de exemplo.</p>
        </div>}
    </section>

    <OtbProjectionDraft forecast={forecast} baseDate={simulationBaseDate??""} recent={recentDrafts??[]} sourceError={!!draftSourceError}/>

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

    {consignedPosition?.state==="conectado"&&<section className="rounded-2xl border border-cyan-400/25 bg-cyan-400/[.05] p-5 text-xs leading-6 text-cyan-100" aria-label="Estoque líquido de consignação">
      <strong>Estoque líquido da OTB conferido.</strong> {money.format(consignedPosition.consignedCost)} da marca consignada GALLAGHER foram descontados do estoque disponível segundo OTB!I, mantendo a foto bruta para auditoria. Estoque considerado na simulação: <strong>{money.format(consignedPosition.stockCost)}</strong>. A exclusão não representa venda, pagamento nem autorização de compra.
    </section>}
    {consignedPosition?.state==="indisponivel"&&<section role="status" className="rounded-2xl border border-amber-300/25 bg-amber-500/[.06] p-5 text-xs leading-6 text-amber-100"><strong>Conciliação da marca consignada indisponível.</strong> {consignedPosition.reason} A prévia não será calculada sobre estoque bruto indevidamente.</section>}

    {abcProjection?.state==="conectado"&&<section className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[.05] p-5 text-xs leading-6 text-emerald-100" aria-label="Previsão ABC da planilha">
      <strong>Previsão ABC por produto conectada ao Supabase.</strong> {integer.format(abcProjection.groups.reduce((sum,group)=>sum+group.skuCount,0))} produtos/grupos em {integer.format(abcProjection.groups.length)} subgrupos; foto {dateBR(abcProjection.snapshotAt)}. A regra usa vendas dos últimos 90 dias, crescimento comparável entre filiais, base do ano anterior, curva ABC e custo extra dos 60 itens de produção própria configurados na Zacarini 2.3.7. <span className="text-amber-200">Custo de produção ainda não homologado; {integer.format(abcProjection.pendingProductionCosts)} possível(is) produto(s) Só Sal sem custo referenciado. Não libera verba.</span>
    </section>}
    {abcProjection?.state==="indisponivel"&&<section role="status" className="rounded-2xl border border-amber-300/25 bg-amber-500/[.06] p-5 text-xs leading-6 text-amber-100"><strong>Previsão ABC por SKU indisponível.</strong> {abcProjection.reason} O cálculo pode usar aproximação de CMV histórico, sem autorização de compra.</section>}

    {seasonalHistory?.state==="indisponivel"&&<section role="status" className="rounded-2xl border border-amber-300/25 bg-amber-500/[.06] p-5 text-xs leading-6 text-amber-100">
      <strong>Vendas sazonais da OTB indisponíveis.</strong> {seasonalHistory.reason} A simulação, quando disponível, utiliza somente a participação histórica no CMV de 90 dias. Não libera compras.
    </section>}

    {seasonalHistory?.state==="conectado"&&<section className="erp-surface overflow-hidden rounded-[24px]" aria-label="Sazonalidade por subgrupo">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-7">
        <div><p className="text-[10px] font-bold uppercase tracking-[.17em] text-cyan-300">fx_VendaSubgrupo · Supabase / saída entregue</p>
          <h2 className="mt-2 text-xl font-bold">Sazonalidade por subgrupo</h2>
          <p className="mt-2 max-w-4xl text-xs leading-6 text-slate-300">Quatro janelas móveis do ano anterior, consolidadas entre filiais como na Zacarini 2.3.7. São vendas reais, não compras, nem a venda futura OTB!D. Esta leitura não libera compras.</p>
        </div>
        <span className="rounded-lg border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-[11px] font-bold text-emerald-200">{integer.format(seasonalHistory.groups.length)} subgrupos · fonte conectada</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-3">
        <span className="text-xs text-slate-400">Competência de referência: {monthLabel(seasonalHistory.month)}</span>
        <label className="text-xs text-slate-300">Linha <select value={seasonalLine} onChange={event=>{setSeasonalLine(event.target.value);setSeasonalPage(1)}} className="erp-field ml-2 w-40 px-3"><option value="">Todas</option>{[1,2,3,4].map(line=><option key={line} value={line}>Linha {line}</option>)}</select></label>
      </div>
      <div className="overflow-x-auto"><table aria-label="Vendas entregues por subgrupo nas quatro janelas sazonais" className="w-full min-w-[1000px] text-left text-xs">
        <thead className="bg-[#121e30] text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-4 py-3">Linha / subgrupo</th>{seasonalHistory.windowMonths.map(month=><th key={month} className="px-4 py-3 text-right">{month}</th>)}</tr></thead>
        <tbody className="divide-y divide-white/10">{seasonalPaged.items.map(group=><tr key={`${group.line}\0${group.name}`}><td className="max-w-[380px] px-4 py-3"><span className="block text-[10px] text-cyan-300">Linha {group.line}</span><strong className="text-slate-100">{group.name}</strong></td>{group.sales.map((value,index)=><td key={index} className="px-4 py-3 text-right tabular-nums">{money.format(value)}</td>)}</tr>)}</tbody>
      </table></div>
      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-4 text-xs text-slate-400"><span>{seasonalPaged.from}–{seasonalPaged.to} de {seasonalPaged.total} subgrupos</span><div className="flex items-center gap-3"><button type="button" disabled={seasonalPaged.page<=1} onClick={()=>setSeasonalPage(p=>p-1)} className="rounded-lg border border-cyan-300/20 px-3 py-2 text-cyan-200 disabled:opacity-35">Anterior</button><span>{seasonalPaged.page}/{seasonalPaged.totalPages}</span><button type="button" disabled={seasonalPaged.page>=seasonalPaged.totalPages} onClick={()=>setSeasonalPage(p=>p+1)} className="rounded-lg border border-cyan-300/20 px-3 py-2 text-cyan-200 disabled:opacity-35">Próximo</button></div></div>
    </section>}

    {!indicativeMonths&&!!forecastIssues?.length&&<section role="status" className="rounded-2xl border border-amber-300/25 bg-amber-500/[.06] p-5 text-xs text-amber-100">
      <p className="font-bold">A prévia de reposição não foi calculada</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">{forecastIssues.map((issue,index)=><li key={index}>{issue}</li>)}</ul>
      <p className="mt-2 text-amber-200">Nenhum valor substituto foi presumido.</p>
    </section>}

    {indicativeMonths && <section className="rounded-[24px] border border-cyan-300/20 bg-cyan-400/[.035] p-6 sm:p-7" aria-label="Prévia operacional dos três meses de compras">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.17em] text-cyan-300">OTB!B7 · três meses à frente</p><h2 className="mt-2 text-lg font-bold">Reposição prevista antes da trava financeira</h2><p className="mt-2 max-w-4xl text-xs leading-6 text-slate-400">Cenário de demanda a 90% com estoque atual e DDE por linha. Projeção operacional da Zacarini 2.3.7, recalculada com Supabase. Os pedidos já emitidos ainda não têm entregas confirmadas por item; esses volumes não são verba autorizada.</p></div><span className="rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-[10px] font-bold text-amber-200">Simulado · não libera compras</span></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">{indicativeMonths.map((item,i)=><div key={item.month} className="rounded-xl border border-cyan-300/15 bg-[#0b1626] p-5"><p className="text-[10px] font-bold uppercase text-slate-400">Mês {i+1} · {monthLabel(item.month)}</p><p className="mt-3 text-2xl font-bold tabular-nums text-white">{money.format(item.amount)}</p><p className="mt-2 text-[11px] text-amber-200">Necessidade de reposição simulada, sem conciliar pedidos em trânsito</p></div>)}</div>
      <p className="mt-4 text-xs leading-6 text-amber-100">O teto por mês, a reserva de matéria-prima, o saldo do comprador e o status “LIBERADO” permanecem indisponíveis enquanto a Projeção 12M oficial não estiver homologada. Não gravamos pedidos nem saldos automaticamente.</p>
    </section>}

    {subgroupPreview?.state==="indisponivel" && <section role="status" className="rounded-2xl border border-amber-300/20 bg-amber-500/[.05] p-5 text-xs leading-6 text-amber-100">
      A prévia por subgrupo não pôde ser calculada: {subgroupPreview.reason} Não foi estimado valor substituto.
    </section>}
    {subgroupPreview?.state==="calculado" && <section className="erp-surface overflow-hidden rounded-[24px]" aria-label="Reposição por subgrupo — simulação">
      <div className="p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[.17em] text-cyan-300">OTB!S/AB/AK · estoque futuro</p>
        <h2 className="mt-2 text-xl font-bold text-white">Reposição por subgrupo</h2>
        <p className="mt-2 max-w-4xl text-xs leading-6 text-slate-300">Estoque atual, vendas entregues projetadas por linha e metas DDE configuradas pelo Alex. {subgroupPreview.seasonality==="venda_abc_237"?"A previsão ABC por SKU substitui o proxy: OTB!D/E/F, curva ABC e pesos sazonais BH/BI/BJ seguem as fórmulas Zacarini 2.3.7.":subgroupPreview.seasonality==="venda_entregue"?"As quatro janelas entregues redistribuem os meses, mas a participação média ainda usa CMV histórico como proxy.":"Histórico sazonal incompleto: participação média baseada no CMV de 90 dias."} Pedidos em trânsito sem data confirmada e teto de caixa sem homologação não compõem verba liberada.</p>
      </div><span className="rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-[10px] font-bold text-amber-200">Sem autorização de compras</span></div>
      <div className="mt-5 overflow-x-auto"><table aria-label="Necessidade simulada por linha" className="w-full min-w-[680px] text-left text-xs"><thead className="bg-[#121e30] text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-4 py-3">Linha</th>{subgroupPreview.months.map(m=><th key={m} className="px-4 py-3 text-right">{monthLabel(m)}</th>)}<th className="px-4 py-3">Cobertura</th></tr></thead><tbody className="divide-y divide-white/10">
        {[1,2,3,4].map(line=>{const amount=subgroupPreview.totals[line];const entries=subgroupPreview.rows.filter(r=>r.line===line);const ready=entries.filter(r=>r.months!==null).length;return <tr key={line}><td className="px-4 py-3 font-bold text-cyan-200">Linha {line}</td>{[0,1,2].map(i=><td key={i} className="px-4 py-3 text-right font-semibold tabular-nums">{amount?.[i]===null||amount?.[i]===undefined?"—":money.format(amount[i]!)}</td>)}<td className="px-4 py-3 text-amber-100">{ready}/{entries.length} subgrupos</td></tr>})}
      </tbody></table></div>
      <p className="mt-3 text-[11px] leading-5 text-amber-100">O tipo S gera necessidade de compra de mercadoria; P (produção própria) e M (núcleo/premix) não geram compra nova nesta linha da OTB. A matéria-prima do grupo S é reservada separadamente antes da verba dos compradores. As necessidades não deduzem pedidos sem entrega confirmada, estoque a liquidar ou compras do mês atual. {subgroupPreview.seasonality==="venda_abc_237"?"Participação por subgrupo usa a venda ABC projetada por SKU.":"Participação média ainda usa CMV histórico como proxy."} Não podem ser convertidas em teto de caixa ou OTB liberada. {subgroupPreview.reconciledPlanGroups.length} nome(s) reconciliados por acentos perdidos na extração; {subgroupPreview.unmatchedPlanGroups.length} sem correspondência segura.</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4"><h3 className="text-sm font-bold text-slate-100">Simulação SKU agregada por subgrupo</h3><label className="text-xs text-slate-300">Filtrar linha <select className="erp-field ml-2 w-40 px-3" value={previewLine} onChange={e=>{setPreviewLine(e.target.value);setPreviewPage(1)}}><option value="">Todas</option>{[1,2,3,4].map(l=><option key={l} value={l}>Linha {l}</option>)}</select></label></div>
      <div className="overflow-x-auto">
        <table aria-label="Prévia de necessidades por subgrupo" className="w-full min-w-[1600px] text-left text-xs">
          <thead className="bg-[#121e30] text-[10px] uppercase tracking-wider text-slate-400"><tr>
            {["Linha / subgrupo","Tipo OTB","Estoque inicial","Venda ABC prevista 90d","CMV ABC previsto 90d","Curva A","Peso sazonal · 4 janelas","Meta DDE · 3 meses","Necessidade mês 1","Necessidade mês 2","Necessidade mês 3","Fonte / pendência"].map(t=><th key={t} className="px-4 py-3">{t}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-white/[.08]">{previewPaged.items.map(row=><tr key={`${row.line}\0${row.name}`}>
            <td className="max-w-64 px-4 py-3"><span className="block text-[10px] text-cyan-200">Linha {row.line}</span><strong className="text-slate-100">{row.name}</strong></td>
            <td className="px-4 py-3"><span className={row.kind==="S"?"text-emerald-200":"text-amber-200"}>{kindLabels[row.kind]} · {row.kind}</span></td>
            <td className="px-4 py-3 tabular-nums">{money.format(row.stockCost)}</td>
            <td className="px-4 py-3 tabular-nums">{row.projectedSales90d===null?"—":money.format(row.projectedSales90d)}</td>
            <td className="px-4 py-3 tabular-nums">{row.projectedCmv90d===null?"—":money.format(row.projectedCmv90d)}</td>
            <td className="px-4 py-3 tabular-nums">{row.curveAShare===null?"—":percentage.format(row.curveAShare)}</td>
            <td className="px-4 py-3 text-cyan-200">{row.seasonalWeights?row.seasonalWeights.map(w=>percentage.format(w)).join(" / "):"—"}</td>
            <td className="px-4 py-3">{row.targets.length===3?row.targets.map(t=>`${Math.round(t.days*10)/10} d`).join(" / "):"—"}</td>
            {[0,1,2].map(index=><td key={index} className="px-4 py-3 text-right font-semibold tabular-nums">{row.months?money.format(row.months[index].need):"—"}</td>)}
            <td className="max-w-40 px-4 py-3 text-[11px]">{row.issue?<span className="text-amber-200">{row.issue}</span>:row.kind!=="S"?<span className="text-amber-200">Sem compra de mercadoria</span>:row.targets.some(t=>t.source==="linha")?<span className="text-amber-100">Meta geral da linha aplicada</span>:<span className="text-emerald-200">Metas do Plano de Estoque</span>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4 text-xs text-slate-400"><span>{previewPaged.from}–{previewPaged.to} de {previewPaged.total} subgrupos · calculados somente na memória</span><div className="flex items-center gap-3"><button type="button" disabled={previewPaged.page<=1} onClick={()=>setPreviewPage(p=>p-1)} className="rounded-lg border border-cyan-300/20 px-3 py-2 font-bold text-cyan-200 disabled:opacity-35">Anterior</button><span>{previewPaged.page}/{previewPaged.totalPages}</span><button type="button" disabled={previewPaged.page>=previewPaged.totalPages} onClick={()=>setPreviewPage(p=>p+1)} className="rounded-lg border border-cyan-300/20 px-3 py-2 font-bold text-cyan-200 disabled:opacity-35">Próximo</button></div></div>
    </section>}

    {!month ? <>
      {automaticReference?.state==="indisponivel" && !testActive && !officialScenario && <p role="alert" className="rounded-xl border border-amber-300/25 bg-amber-400/10 p-4 text-xs leading-6 text-amber-100">
        A cadeia automática de cálculo não foi concluída: {automaticReference.reason} Nenhum limite faltante foi convertido em zero ou aprovado.
      </p>}
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
      {indicativeActive && automaticReference?.state==="referencia_parcial" && <section className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-5 text-xs leading-6 text-amber-100" aria-label="Limitações da prévia automática">
        <p className="font-bold text-amber-200">Cálculo automático pela lógica Zacarini 2.3.8, com ressalvas</p>
        <p className="mt-2">A sequência financeira foi executada sem inserir tetos manualmente: 12 meses de pior caso, prazos de pagamento por linha, necessidade de MP, três tetos de caixa e divisão de comprador. Nenhum número abaixo constitui aprovação.</p>
        <ul className="mt-2 list-inside list-disc space-y-1">{automaticReference.limitations.map(text=><li key={text}>{text}</li>)}</ul>
        <p className="mt-2">Subgrupos com cálculo incompleto: {automaticReference.excludedSubgroups.length}. A carteira atualizada foi considerada no estoque disponível (OTB!J) e no gravado dos três meses (OTB!V/AE/AN), mas pedidos totalmente recebidos e vendas casadas ainda exigem confirmação documental.</p>
        <div className="mt-4 rounded-xl border border-cyan-300/20 bg-[#0d1d30] p-4">
          <p className="text-xs font-bold text-cyan-200">Carteira de pedidos Supabase · conciliação operacional</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <div><p className="text-[11px] text-slate-400">Itens lidos</p><p className="font-bold tabular-nums">{integer.format(automaticReference.orderSummary.items)}</p></div>
            <div><p className="text-[11px] text-slate-400">Saldo em aberto</p><p className="font-bold tabular-nums">{money.format(automaticReference.orderSummary.pending)}</p></div>
            <div><p className="text-[11px] text-slate-400">Subgrupos vinculados</p><p className="font-bold tabular-nums">{automaticReference.orderSummary.matchedSubgroups}</p></div>
            <div><p className="text-[11px] text-slate-400">Sem subgrupo</p><p className="font-bold text-amber-200 tabular-nums">{automaticReference.orderSummary.unmappedItems} · {money.format(automaticReference.orderSummary.unmappedValue)}</p></div>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-slate-400">Pedidos sem classificação não foram distribuídos no OTB; itens que não correspondem a grupos de estoque também permanecem fora. Para classificar, abra o pedido em Gerenciar e registre o subgrupo oficial e o motivo.</p>
          {automaticReference.orderSummary.unmappedTop.length>0 && <div className="mt-3 flex flex-wrap gap-2">
            {automaticReference.orderSummary.unmappedTop.slice(0,8).map(item=><Link
              key={item.code}
              href={`/compras/gerenciar?busca=${encodeURIComponent(item.code)}`}
              className="rounded-lg border border-amber-400/20 bg-amber-300/5 px-3 py-2 text-[11px] text-amber-100 hover:bg-amber-300/10"
              title={item.description}>SKU {item.code} · {money.format(item.pending)}</Link>)}
          </div>}
        </div>
      </section>}
      <div role="status" className={`flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3 text-xs leading-5 ${(testActive || indicativeActive) ? "border-amber-300/40 bg-amber-400/10 text-amber-100" : "border-cyan-300/25 bg-cyan-400/10 text-cyan-100"}`}>
        <ShieldCheck size={17} className="shrink-0" /> {testActive ? "RESULTADO SIMULADO: valores demonstrativos, sem orçamento aprovado ou autorização de pedido." :
          indicativeActive ? "PRÉVIA AUTOMÁTICA: CMV, estoque e vencimentos do Supabase com hipóteses explícitas; não é verba aprovada nem permite pedidos." :
          "Cenário homologado no Supabase. Nenhuma autorização de pedido é gerada automaticamente."}
      </div>

      <section className="erp-surface overflow-hidden rounded-[22px] p-2" aria-label="Selecionar mês da OTB">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {result!.months.map((entry, index) => <button key={entry.month} type="button" aria-pressed={monthIndex === index} onClick={() => { setMonthIndex(index); setLineFilter(""); setKindFilter(""); setSearch("") }} className={`rounded-2xl border px-5 py-4 text-left transition ${monthIndex === index ? "border-cyan-300/40 bg-cyan-400/15 shadow-[inset_0_1px_rgba(255,255,255,.06)]" : "border-transparent hover:border-[#334b68] hover:bg-[#15263b]"}`}>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Mês {index + 1}</p>
            <p className={`mt-1 text-base font-bold capitalize ${monthIndex === index ? "text-cyan-200" : "text-slate-200"}`}>{monthLabel(entry.month)}</p>
            <div className="mt-3"><Status value={entry.cashStatus} simulated={testActive || indicativeActive} /></div>
          </button>)}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores de OTB do mês">
        <Metric label={testActive ? "Teto digitado (teste)" : indicativeActive ? "Teto referencial do pior caso" : "Teto de caixa"} value={money.format(month.cashCap)} sub={testActive ? "Premissa editável, não saldo bancário" : indicativeActive ? "Trava 12M calculada, não conciliada" : "Pior caso mensal da fonte informada"} icon={<Wallet size={20} />} />
        <Metric label="Necessidade total" value={money.format(month.totalNeed)} sub="Matéria-prima + mercadorias" icon={<Warehouse size={20} />} />
        <Metric label={testActive ? "Verba calculada (teste)" : indicativeActive ? "Verba calculada (não aprovada)" : "Verba liberada"} value={money.format(month.releasedTotal)} sub={(testActive || indicativeActive) ? "Referência sem efeito em pedidos" : "Distribuição limitada pelo caixa"} icon={<CheckCircle2 size={20} />} />
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
          <p className="mt-5 text-xs text-slate-500">Inclui a matéria-prima liberada no rateio global. Esta divisão não aumenta o limite mensal e não é a verba final após os cortes do comprador (caixa, DDE e limites por linha).</p>
        </article>
      </section>

      <section className="erp-surface overflow-hidden rounded-[24px]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#25354e] p-5 sm:p-7"><div><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.17em] text-cyan-300"><Layers3 size={14} /> Visão gerencial</p><h2 className="mt-2 text-xl font-bold">Orçamento por linha</h2><p className="mt-1 text-xs text-slate-400">O saldo da linha já considera excesso; não confundir com o saldo bruto do subgrupo.</p>{month.mpReleased > 0 && <p className="mt-2 text-xs text-amber-200">A matéria-prima não está distribuída por linha nesta tabela, embora componha o rateio global de 90/10. Não use a soma das linhas como verba total aprovada.</p>}</div><Status value={month.cashStatus} simulated={testActive || indicativeActive} /></div>
        <div className="overflow-x-auto"><table className="erp-table w-full min-w-[900px] text-left text-xs">
          <thead className="bg-[#121e30] text-[10px] uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-4">Linha</th><th className="px-5 py-4 text-right">Liberado</th><th className="px-5 py-4 text-right">Comprador 90%</th><th className="px-5 py-4 text-right">Diretoria 10%</th><th className="px-5 py-4 text-right">Já gravado</th><th className="px-5 py-4 text-right">Excesso</th><th className="px-5 py-4 text-right">Saldo livre</th></tr></thead>
          <tbody className="divide-y divide-[#1c2b40]">{month.lines.map((line) => <tr key={line.line}><td className="px-5 py-4 font-semibold text-cyan-200">{line.line}</td><td className="px-5 py-4 text-right tabular-nums">{money.format(line.released)}</td><td className="px-5 py-4 text-right tabular-nums">{money.format(line.buyerBudget)}</td><td className="px-5 py-4 text-right tabular-nums">{money.format(line.directorReserve)}</td><td className="px-5 py-4 text-right tabular-nums">{money.format(line.recorded)}</td><td className="px-5 py-4 text-right tabular-nums">{money.format(line.excess)}</td><td className="px-5 py-4 text-right tabular-nums"><Balance value={line.freeBalance} /></td></tr>)}
            {!month.lines.length && <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400">Nenhuma linha de mercadorias neste cenário.</td></tr>}
          </tbody>
        </table></div>
      </section>

      <OtbBuyer238Panel month={month} simulated={testActive || indicativeActive} />

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
          <tbody className="divide-y divide-[#1c2b40]">{filtered.map((item) => <tr key={`${item.line}\0${item.name}`}><td className="max-w-64 px-5 py-4"><p className="text-[10px] font-bold text-cyan-300">{item.line}</p><p className="mt-1 font-semibold text-slate-100">{item.name}</p></td><td className="px-5 py-4 text-slate-300">{kindLabels[item.kind]}</td><td className="px-5 py-4 text-right tabular-nums">{percentage.format(item.curveAShare)}</td><td className="px-5 py-4 text-right tabular-nums">{money.format(item.openingStock)}</td><td className="px-5 py-4 text-right tabular-nums">{money.format(item.forecastCost)}</td><td className="px-5 py-4 text-right tabular-nums">{money.format(item.targetStock)}</td><td className="px-5 py-4 text-right font-semibold tabular-nums">{money.format(item.need)}</td><td className="px-5 py-4 text-right font-semibold text-cyan-200 tabular-nums">{money.format(item.released)}</td><td className="px-5 py-4 text-right tabular-nums">{money.format(item.recorded)}</td><td className="px-5 py-4 text-right tabular-nums">{money.format(item.tiedSales)}</td><td className="px-5 py-4 text-right tabular-nums">{money.format(item.excess)}</td><td className="px-5 py-4 text-right tabular-nums"><Balance value={item.freeBalance} /></td><td className="px-5 py-4 text-right tabular-nums">{money.format(item.closingStock)}</td><td className="px-5 py-4"><Status value={item.status} simulated={testActive || indicativeActive} /></td></tr>)}
            {!filtered.length && <tr><td colSpan={14} className="px-6 py-10 text-center text-slate-400">Nenhum subgrupo corresponde aos filtros.</td></tr>}
          </tbody>
        </table></div>
      </section>
    </>}

    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/70 py-4 text-xs text-slate-500"><span>OTB / Projeção 12M · fonte única Supabase</span><Link href="/compras" className="inline-flex items-center gap-1.5 font-bold text-cyan-300 transition hover:text-cyan-100">Consulta de pedidos <ArrowUpRight size={13} /></Link></footer>
  </main>
}
