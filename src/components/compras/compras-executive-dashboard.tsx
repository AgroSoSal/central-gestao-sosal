import Link from "next/link"
import { AlertTriangle, ArrowLeft, ArrowUpRight, CalendarDays,
  ChartNoAxesCombined, CheckCircle2, CircleHelp, Database, Landmark,
  ShieldCheck } from "lucide-react"
import { ComprasSair } from "@/components/compras/compras-auth"
import { GroupedBarsChart, PerformanceGauge, ProjectionChart } from "@/components/compras/dashboard-zacarini-charts"
import { DASHBOARD_BLOCKS, dashboardReference, metricWithTarget, summarizeDashboardSales,
  type DashboardReferenceRow, type DashboardSalesRow } from "@/domains/compras/domain/dashboard-zacarini-237"
import { buildPartialCashSeries, type ContractedWeek } from "@/domains/compras/domain/dashboard-cash-contracts"
import { buildZacariniCashForecast } from "@/domains/compras/domain/zacarini-cash-forecast"
import { resolveReceivablesRecovery, type RecoverableReceivablesLine } from "@/domains/compras/domain/receivables-recovery-237"
import type { BankPositionRow, ContractedMonth } from "@/domains/compras/domain/otb-bank-readiness"
import { accumulatedSalesTarget, accumulatedBudgetValue, summarizeDdePlanCoverage, type DdePlanRow } from "@/domains/compras/domain/dashboard-goals-and-dde-237"

type Position = { filial: string; estoque_custo: number | string | null; cmv_90d: number | string | null;
  dde_observado: number | string | null; carteira_aberta: number | string | null;
  carteira_vencida: number | string | null; percentual_vencido: number | string | null }
type Stock = { linha: number; estoque_custo: number | string | null; cmv_90d: number | string | null;
  grupo_subgrupo: string; sku_count: number | string | null; ultima_atualizacao: string | null }
type PendingOrdersQuality = { itens_pendentes: number | string; pedidos_pendentes: number | string;
  valor_pendente: number | string; itens_sem_grupo: number | string; valor_sem_grupo: number | string;
  itens_sem_previsao: number | string; itens_sem_condicao: number | string;
  itens_com_previsao_futura: number | string; data_pedido_mais_antigo: string | null;
  ultima_conciliacao: string | null }
type Props = { month: string; today: string; email: string; referenceRows: DashboardReferenceRow[]; salesRows: DashboardSalesRow[];
  shopPositions: Position[]; stockRows: Stock[]; bankRows: BankPositionRow[];
  contractedWeeks: ContractedWeek[]; contractedMonths: ContractedMonth[];
  recoveryRows: RecoverableReceivablesLine[];
  ddePlanRows?: DdePlanRow[];
  pendingOrdersQuality?: PendingOrdersQuality | null;
  errors: Record<string, string | null> }

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 })
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 })
const lines: Record<number, string> = { 1: "Nutrição", 2: "Saúde", 3: "Outros", 4: "Pastagem" }
const shops = [
  { id: "AN", nome: "Anastácio" }, { id: "BDS", nome: "Bandeirantes" },
  { id: "CG", nome: "Campo Grande" }, { id: "CX", nome: "Coxim" },
  { id: "PG", nome: "Pedro Gomes" }, { id: "RIO", nome: "Rio Verde" },
] as const

function number(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
function brl(v: number | null | undefined) { return v === null || v === undefined ? "—" : money.format(v) }
function pct(v: number | null | undefined) { return v === null || v === undefined ? "—" : percent.format(v) }
function days(v: number | null | undefined) { return v === null || v === undefined ? "—" : `${decimal.format(v)} d` }
function panelTitle(id: string) { return DASHBOARD_BLOCKS.find(b => b.id === id)?.titulo ?? id }
function sourceStatus(ok: boolean) { return ok ? "Conectado ao Supabase" : "Sem leitura validada" }

function Section({ id, title, detail, children }: { id: string; title?: string; detail?: string; children: React.ReactNode }) {
  return <section id={id} className="erp-surface rounded-[24px] p-5 sm:p-7">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-xl font-bold tracking-tight text-white">{title ?? panelTitle(id)}</h2>
        {detail && <p className="mt-1.5 max-w-4xl text-xs leading-6 text-slate-400">{detail}</p>}</div>
      <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-200">Zacarini 2.3.7</span>
    </div>{children}
  </section>
}

function Missing({ reason = "Sem fonte homologada para este indicador" }: { reason?: string }) {
  return <span className="inline-flex items-center gap-1.5 text-amber-200"><CircleHelp size={12} /> {reason}</span>
}

function Indicator({ label, value, target, note }: { label: string; value: string; target?: number | null; note: string }) {
  const progress = target === null || target === undefined ? null : Math.max(0, Math.min(target * 100, 100))
  return <div className="rounded-2xl border border-slate-700/60 bg-[#0b1524] p-5">
    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
    <div className="mt-3 text-[clamp(1.35rem,2vw,1.9rem)] font-bold tracking-tight text-white">{value}</div>
    {progress !== null && <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${target! >= 1 ? "bg-emerald-400" : target! >= .9 ? "bg-cyan-400" : target! >= .8 ? "bg-amber-400" : "bg-rose-400"}`} style={{ width: `${progress}%` }} /></div>}
    <div className="mt-3 text-[11px] leading-5 text-slate-400">{note}</div>
  </div>
}

export function ComprasExecutiveDashboard({ month, today, email, referenceRows, salesRows, shopPositions,
  stockRows, bankRows, contractedWeeks, contractedMonths, recoveryRows, ddePlanRows = [], pendingOrdersQuality, errors }: Props) {
  const date = `${month}-01`
  const totals = summarizeDashboardSales(salesRows)
  const activeTargets = [...Array.from({ length: 4 }, (_, i) => dashboardReference(referenceRows, `meta_linha_${i + 1}`, date)),
    ...shops.map(s => dashboardReference(referenceRows, `meta_loja_${s.id}`, date))]
  const haveAllTargets = activeTargets.every(t => t.valor !== null)
  const targetMonth = haveAllTargets ? activeTargets.slice(0, 4).reduce((sum, t) => sum + (t.valor ?? 0), 0) : null
  const salesRatio = metricWithTarget(errors.vendas ? null : totals.vendidoMes,
    { valor: targetMonth, estado: haveAllTargets ? "referencia" : "indisponivel", origem: "Dashboard · metas de linha" })
  const annualLineGoal = accumulatedSalesTarget(referenceRows,[1,2,3,4].map(i=>`meta_linha_${i}`),month)
  const annualProgress = metricWithTarget(errors.vendas ? null : totals.vendidoAno,
    { valor: annualLineGoal, estado: annualLineGoal === null ? "indisponivel" : "referencia", origem: "Metas de Vendas · acumulado" })
  const cumulativeMonth = new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone:"UTC",month:"long" })
  const ddePlan = errors.planoDde ? summarizeDdePlanCoverage([]) : summarizeDdePlanCoverage(ddePlanRows)

  const stockByLine = new Map<number, { estoque: number; cmv: number; itens: number }>()
  const incompleteStockLines = new Set<number>()
  if (!errors.estoque) for (const row of stockRows) {
    if (!lines[row.linha]) continue
    const value = number(row.estoque_custo)
    const cost = number(row.cmv_90d)
    if (value === null || cost === null) incompleteStockLines.add(row.linha)
    const item = stockByLine.get(row.linha) ?? { estoque: 0, cmv: 0, itens: 0 }
    item.estoque += value ?? 0
    item.cmv += cost ?? 0
    item.itens += number(row.sku_count) ?? 0
    stockByLine.set(row.linha, item)
  }
  const stockValue = !errors.estoque && stockRows.length > 0 && incompleteStockLines.size === 0 ? [...stockByLine.values()].reduce((s, l) => s + l.estoque, 0) : null
  const cmv90 = !errors.estoque && stockRows.length > 0 && incompleteStockLines.size === 0 ? [...stockByLine.values()].reduce((s, l) => s + l.cmv, 0) : null
  const dde = stockValue !== null && cmv90 !== null && cmv90 > 0 ? stockValue * 90 / cmv90 : null
  const stockTarget = dashboardReference(referenceRows, "dde_alvo_rede", null)

  const positionMap = new Map(shopPositions.map(p => [p.filial, p]))
  // Receber Vencidos!G13: apenas títulos cobrados nas classes 1/2/3, pelo
  // valor ORIGINAL (vlr_titulo), não pelo líquido com juros de décadas.
  const recovery = errors.receberRecuperavel ? null : resolveReceivablesRecovery(recoveryRows)
  const overdue = recovery?.eligible ?? null
  const bankWithBalances = !errors.extratos ? bankRows.filter(b => number(b.ultimo_saldo) !== null) : []
  const banksReconciled = bankWithBalances.length > 0 && bankWithBalances.every(b => b.conciliado === true)
  const partialCash = buildPartialCashSeries(errors.extratos ? [] : bankRows,
    errors.agenda26s ? [] : contractedWeeks, errors.agenda12m ? [] : contractedMonths, today)
  const forecast = buildZacariniCashForecast({
    today, references: errors.premissas ? [] : referenceRows, contracts: partialCash,
    stock: errors.estoque ? [] : [1,2,3,4].filter(line => stockByLine.has(line) && !incompleteStockLines.has(line)).map(line => ({
      linha: line, estoque: stockByLine.get(line)!.estoque, cmv90: stockByLine.get(line)!.cmv,
    })),
    overdue,
  })
  const weeklyContracts = partialCash.state === "parcial"
    ? Array.from({ length: 13 }, (_, i) => ({ label: `S${i+1}`, values: [partialCash.weeklyReceivables[i], partialCash.weeklyPayables[i]] })) : []
  const monthlyContracts = partialCash.state === "parcial"
    ? partialCash.monthlyReceivables.map((received, i) => {
      const m = new Date(`${today.slice(0, 7)}-01T12:00:00Z`)
      m.setUTCMonth(m.getUTCMonth()+i)
      return { label: new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(m).replace(".", ""), values: [received, partialCash.monthlyPayables[i]] }
    }) : []

  const dateLabel = new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" })
  const budgetMarginEbitda = dashboardReference(referenceRows,"dre_margem_ebitda",date).valor
  const budgetProfit = dashboardReference(referenceRows,"dre_lucro_liquido",date).valor
  const dreMetrics = [
    ["Receita bruta","dre_receita_bruta"], ["Receita líquida","dre_receita_liquida"],
    ["(-) CMV","dre_cmv"], ["Lucro bruto","dre_lucro_bruto"],
    ["Margem bruta %","dre_margem_bruta"], ["Total despesas","dre_despesas"],
    ["EBITDA","dre_ebitda"], ["Margem EBITDA %","dre_margem_ebitda"],
    ["Lucro líquido","dre_lucro_liquido"],
  ] as const

  return <main className="mx-auto max-w-[1570px] space-y-6 pb-16 text-slate-100">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <Link href="/compras" className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-200 hover:text-white"><ArrowLeft size={15} /> Compras</Link>
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400"><ShieldCheck size={14} className="text-emerald-400" /> Master · {email}<ComprasSair /></div>
    </header>
    <section className="relative overflow-hidden rounded-[28px] border border-cyan-300/20 bg-gradient-to-br from-[#10233d] via-[#0a172a] to-[#07121f] p-7 sm:p-10">
      <div className="pointer-events-none absolute -right-14 -top-24 h-80 w-80 rounded-full bg-cyan-400/10 blur-[65px]" />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.19em] text-cyan-300"><ChartNoAxesCombined size={17} /> Gestão Zacarini · Dashboard executivo</p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-[42px]">Dashboard de <span className="text-cyan-300">Compras</span></h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">Mesmos blocos informativos da aba Dashboard da planilha 2.3.7. Configuração inicial identificada por versão; indicadores operacionais provenientes do Supabase, sem conexão com o Excel.</p>
        </div>
        <form method="get" action="/compras/dashboard" className="flex items-end gap-3">
          <label className="text-xs font-semibold text-slate-300"><span className="flex items-center gap-2"><CalendarDays size={14} /> Competência</span>
            <input type="month" name="mes" defaultValue={month} min="2020-01" max="2035-12" className="erp-field mt-2 px-3 py-2" /></label>
          <button type="submit" className="rounded-xl bg-cyan-500 px-4 py-2.5 text-xs font-extrabold text-[#081524] hover:bg-cyan-300">Atualizar</button>
        </form>
      </div>
      <div className="relative mt-7 flex flex-wrap gap-2 text-[11px]">
        {DASHBOARD_BLOCKS.map(block => <a key={block.id} href={`#${block.id}`} className="rounded-full border border-slate-600/40 bg-slate-900/50 px-3 py-2 text-slate-300 hover:border-cyan-400/50 hover:text-cyan-100">{block.titulo.split(" — ")[0]}</a>)}
      </div>
    </section>

    {(Object.values(errors).some(Boolean) || referenceRows.length === 0) && <div role="alert" className="rounded-2xl border border-amber-300/25 bg-amber-950/20 p-5 text-sm leading-6 text-amber-100"><AlertTriangle size={18} className="mb-2" /> Algumas fontes ainda não retornaram dados para a dashboard. A tela mantém os blocos correspondentes, mas não presume metas, saldos ou margens. {referenceRows.length === 0 && "As premissas versionadas ainda não estão disponíveis na configuração do Supabase."}</div>}

    <Section id="velocimetros" detail={`Desempenho referente a ${dateLabel}; metas importadas como referência não equivalem a orçamento homologado.`}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <PerformanceGauge label="Vendas do mês" value={salesRatio.percentual} headline={pct(salesRatio.percentual)} detail={`${brl(errors.vendas ? null : totals.vendidoMes)} de ${brl(targetMonth)} · meta de referência`} />
        <PerformanceGauge label="Vendas no ano" value={annualProgress.percentual} headline={pct(annualProgress.percentual)} detail={`${brl(errors.vendas ? null : totals.vendidoAno)} de ${brl(annualLineGoal)} · Meta acumulada até ${cumulativeMonth} (referência 2026)`} />
        <PerformanceGauge label="Margem bruta" value={null} headline={errors.vendas ? "—" : pct(totals.margemBruta)} detail="Margem observada nas saídas. Comparação com meta pendente." />
        <PerformanceGauge label="Margem EBITDA" value={null} headline="—" detail={`Orçado na referência: ${pct(budgetMarginEbitda)}; realizado depende de DRE classificada.`} />
        <PerformanceGauge label="Lucro líquido" value={null} headline="—" detail={`Orçado na referência: ${brl(budgetProfit)}; realizado depende de fechamento contábil.`} />
      </div>
    </Section>

    <Section id="caixa" title="Caixa: 13 semanas e Projeção 12M" detail="Simulação operacional pelas premissas da Zacarini 2.3.7 e dados atuais do Supabase, sem conexão com a planilha. Ainda não é orçamento aprovado nem caixa conciliado.">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Menor saldo · 13 semanas com compras novas", forecast.state === "simulado" ? forecast.minimum13WithPurchases : null],
          ["Menor saldo · 13 semanas sem compras novas", forecast.state === "simulado" ? forecast.minimum13WithoutPurchases : null],
          ["Menor saldo · Projeção 12M", forecast.state === "simulado" ? forecast.minimum12 : null],
          ["Menor saldo · Pior caso correto 12M", forecast.state === "simulado" ? forecast.minimumWorst12 : null],
          ["Saldo final · Projeção 12M", forecast.state === "simulado" ? forecast.final12 : null],
        ].map(([label,value]) =>
          <div key={String(label)} className="rounded-2xl border border-amber-300/15 bg-amber-400/[.025] p-5"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-3 text-2xl font-bold tabular-nums">{brl(typeof value === "number" ? value : null)}</p><p className="mt-2 text-[11px] text-amber-200">{forecast.state === "simulado" ? "Estimativa não homologada · não libera compras" : "Sem premissas completas para simular"}</p></div>)}
      </div>
      <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-500/[.04] px-5 py-4 text-xs leading-6 text-amber-100">
        <p className="font-bold">{forecast.state === "simulado" ? "Simulação calculada, ainda não homologada" : "Projeção indisponível"}</p>
        <ul className="mt-1 list-inside list-disc">{(forecast.state === "simulado" ? forecast.warnings : forecast.reasons).map(message => <li key={message}>{message}</li>)}</ul>
      </div>
      {pendingOrdersQuality && <div className="mt-4 rounded-2xl border border-amber-300/20 bg-[#181a25] px-5 py-4">
        <h3 className="text-sm font-bold text-amber-100">Pedidos pendentes sem previsão validada</h3>
        <p className="mt-2 text-xs leading-6 text-slate-300">A Zacarini considera a chegada prevista dos pedidos antes de calcular compras novas, usando um prazo padrão de sete dias. A carteira conciliada do Supabase contém pedidos de períodos anteriores e requer previsão de entrega por item; aplicar os sete dias a todos distorceria o estoque e o caixa.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Itens com saldo pendente",decimal.format(number(pendingOrdersQuality.itens_pendentes) ?? 0)],
            ["Valor ainda pendente",brl(number(pendingOrdersQuality.valor_pendente))],
            ["Itens sem previsão informada",decimal.format(number(pendingOrdersQuality.itens_sem_previsao) ?? 0)],
            ["Sem linha 1–4 identificada",brl(number(pendingOrdersQuality.valor_sem_grupo))],
          ].map(([label,value]) => <div key={label} className="rounded-xl border border-amber-200/10 bg-[#0b1524] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-lg font-bold tabular-nums text-white">{value}</p></div>)}
        </div>
        <p className="mt-3 text-[11px] leading-5 text-amber-200">{decimal.format(number(pendingOrdersQuality.itens_com_previsao_futura) ?? 0)} itens com entrega futura informada · última conciliação {pendingOrdersQuality.ultima_conciliacao?.slice(0,10) ?? "não informada"}. Essas entradas não foram consideradas como estoque disponível nem como verba aprovada.</p>
      </div>}
      <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-400/[.045] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-cyan-100">Carteira financeira identificada</h3><p className="mt-1 text-[11px] leading-5 text-slate-400">Saldos bancários e títulos existentes são informações diferentes. Não somamos os dois como se fossem a Projeção 12M da planilha.</p></div><span className="rounded-full border border-amber-400/20 px-3 py-1 text-[10px] font-bold text-amber-200">Parcial · não libera compras</span></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Saldo bancário · data-base", partialCash.openingCash],
            ["Títulos a receber · 13 semanas", partialCash.receivables13],
            ["Fornecedores a pagar · 13 semanas", partialCash.payables13],
            ["Títulos a receber · 12 meses", partialCash.receivables12],
            ["Fornecedores a pagar · 12 meses", partialCash.payables12],
          ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-cyan-300/10 bg-[#0b1524] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-xl font-bold tabular-nums text-white">{brl(typeof value === "number" ? value : null)}</p></div>)}
        </div>
        <p className="mt-4 text-[11px] leading-5 text-amber-100">{partialCash.warning}{partialCash.state === "parcial" && ` Base bancária comum: ${partialCash.base}. Agenda de fornecedores: última importação ${partialCash.lastPayablesImport?.slice(0,10) ?? "não identificada"}. O saldo final não pode ser obtido subtraindo todos os fornecedores sem projetar recebimentos das vendas novas.`}</p>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-cyan-400/15 bg-cyan-300/[.025] p-5 lg:col-span-2">
          <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold"><Landmark size={16} className="text-cyan-300" /> Extratos bancários importados</h3><span className="text-[10px] text-slate-400">{bankWithBalances.length} contas com saldo</span></div>
          <p className="mt-2 text-xs leading-6 text-slate-400">Saldos individualizados, sem soma consolidada quando a conciliação não foi confirmada.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {bankWithBalances.map((b, i) => <div key={`${b.conta_ref}-${i}`} className="flex items-center justify-between gap-2 rounded-xl border border-slate-700/45 bg-slate-950/25 px-3 py-3 text-xs"><div><p className="font-semibold text-slate-200">{b.filial} · conta •••• {b.conta_ref.slice(-4)}</p><p className="mt-1 text-[10px] text-slate-500">{b.banco === "PENDENTE_IDENTIFICACAO" ? "Banco a identificar" : b.banco} · {b.data_ultimo_saldo?.slice(0, 10) ?? "Sem data"} · {b.conciliado ? "Conciliado" : "Conciliação pendente"}</p></div><span className="shrink-0 font-bold text-white">{brl(number(b.ultimo_saldo))}</span></div>)}
            {!bankWithBalances.length && <p className="text-xs text-amber-200">Nenhum extrato disponível para leitura agora.</p>}
          </div>
        </div>
        <div className="rounded-xl border border-amber-300/15 bg-amber-400/[.025] p-5"><h3 className="font-bold">Controle financeiro</h3><p className="mt-3 text-xs leading-6 text-slate-400">Piso de caixa da configuração do Alex:</p><p className="mt-2 text-2xl font-bold text-white">{brl(dashboardReference(referenceRows, "minimo_caixa", null).valor)}</p><p className="mt-3 text-xs text-amber-200">{banksReconciled ? "Extratos individuais conciliados; fluxo projetado ainda pendente." : "Extratos sem conciliação integral; não liberar verba por esse saldo."}</p></div>
      </div>
    </Section>

    <Section id="indicadores" title="Indicadores operacionais e financeiros" detail="DDE observado = estoque a custo ÷ CMV médio diário de 90 dias; não é a meta nem a previsão de compras.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Indicator label="DDE da rede · estoque" value={days(dde)} note={`Alvo de referência: ${days(stockTarget.valor)} · base de CMV 90 dias`} />
        <Indicator label="Estoque a custo" value={brl(stockValue)} note="Posição observada no Supabase por subgrupo." />
        <Indicator label="Carteira vencida · valor original" value={brl(recovery?.overduePrincipal)} note="Soma do principal dos títulos vencidos, sem juros acumulados." />
        <Indicator label="Vencidos recuperáveis no fluxo" value={brl(overdue)} note="Classes cobrança normal, intensiva e Kohl, até cinco anos; exclui grupo, jurídico e perdas, como na Zacarini." />
        <Indicator label="Estoque parado" value="—" note="Critério completo de giro e idade não homologado nesta visão." />
        <Indicator label="Prazo médio de recebimento" value="—" note="Prazo efetivo ainda sem fonte homologada." />
        <Indicator label="Serviço da dívida e verba comprador" value="—" note="Obrigações futuras e orçamento de compra não homologados." />
      </div>
    </Section>

    <Section id="linhas" title="Por linha — vendas × meta e DDE × plano" detail="Metas da competência selecionada e plano de DDE versionados no Supabase; DDE do plano cobre apenas subgrupos com meta individualizada e CMV válido.">
      <div className="overflow-x-auto"><table className="erp-table w-full min-w-[1150px] text-left text-xs"><thead className="text-[10px] uppercase tracking-wider text-slate-400"><tr>{["Linha · comprador","Meta mês","Vendido mês","% meta mês","% meta ano","Estoque a custo","DDE hoje","DDE plano (subgrupos cobertos)","Meta DDE final","Diferença","Situação"].map(h => <th key={h} className="px-3 py-4">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-700/40">{[1,2,3,4].map(id => {
          const ref = dashboardReference(referenceRows, `meta_linha_${id}`, date)
          const assigned = referenceRows.find(r => r.codigo === `meta_linha_${id}` && r.competencia === date)
          const actual = errors.vendas ? null : totals.linhas[id]?.vendidoMes ?? 0
          const ratio = metricWithTarget(actual, ref).percentual
          const yearGoal = accumulatedSalesTarget(referenceRows,[`meta_linha_${id}`],month)
          const yearRatio = metricWithTarget(errors.vendas ? null : totals.linhas[id]?.vendidoAno ?? 0,
            {valor:yearGoal,estado:yearGoal===null?"indisponivel":"referencia",origem:"Metas de Vendas"}).percentual
          const stock = stockByLine.get(id)
          const ddeLine = stock && stock.cmv > 0 ? stock.estoque * 90 / stock.cmv : null
          const goal = dashboardReference(referenceRows, `dde_alvo_linha_${id}`, null).valor
          const diff = ddeLine !== null && goal !== null ? ddeLine - goal : null
          return <tr key={id} className="hover:bg-cyan-300/[.035]"><td className="px-3 py-4"><strong className="block text-white">{lines[id]}</strong><span className="text-[10px] text-slate-400">{assigned?.texto ?? "Responsável não configurado"}</span></td><td className="px-3 py-4">{brl(ref.valor)}</td><td className="px-3 py-4 font-semibold text-white">{brl(actual)}</td><td className="px-3 py-4">{pct(ratio)}</td><td className="px-3 py-4">{pct(yearRatio)}</td><td className="px-3 py-4">{brl(stock?.estoque ?? null)}</td><td className="px-3 py-4">{days(ddeLine)}</td><td className="px-3 py-4" title={`${ddePlan[id]?.valid ?? 0} subgrupos válidos de ${ddePlan[id]?.covered ?? 0} com meta`}>{days(ddePlan[id]?.targetDde ?? null)}<span className="block text-[10px] text-slate-500">{ddePlan[id]?.valid ?? 0} grupos</span></td><td className="px-3 py-4">{days(goal)}</td><td className="px-3 py-4">{days(diff)}</td><td className="px-3 py-4 text-amber-200">{diff === null ? "A conferir" : diff > 0 ? "Acima do alvo" : "Dentro do alvo"}</td></tr>
        })}</tbody></table></div>
      <p className="mt-4 flex items-center gap-2 text-[11px] text-amber-200"><CircleHelp size={13} /> A comparação DDE completo da linha × meta final é observacional. O DDE plano ponderado considera só os {ddePlanRows.length} subgrupos parametrizados disponíveis; não deve ser tratado como meta de toda a linha. Nenhum status libera compras.</p>
    </Section>

    <Section id="lojas" title="Por loja — vendas, margem, estoque, receber e parado" detail="Seis filiais da rede. Margem operacional utiliza saídas; carteira vencida utiliza títulos importados e data de vencimento.">
      <div className="overflow-x-auto"><table className="erp-table w-full min-w-[1150px] text-left text-xs"><thead className="text-[10px] uppercase tracking-wider text-slate-400"><tr>{["Loja · gerente","Meta mês","Vendido mês","% meta mês","% meta ano","Margem bruta","Estoque","DDE","Vencido %","Estoque parado","Situação"].map(h => <th key={h} className="px-3 py-4">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-700/40">{shops.map(s => {
          const ref = dashboardReference(referenceRows, `meta_loja_${s.id}`, date)
          const assigned = referenceRows.find(r => r.codigo === `meta_loja_${s.id}` && r.competencia === date)
          const actual = errors.vendas ? null : totals.lojas[s.id]?.vendidoMes ?? 0
          const marge = errors.vendas ? null : totals.lojas[s.id]?.margemBruta ?? null
          const p = errors.posicao ? undefined : positionMap.get(s.id)
          const late = recovery?.byBranch[s.id]?.overdueShare ?? null
          const ratio = metricWithTarget(actual, ref).percentual
          const yearGoal = accumulatedSalesTarget(referenceRows,[`meta_loja_${s.id}`],month)
          const yearRatio = metricWithTarget(errors.vendas ? null : totals.lojas[s.id]?.vendidoAno ?? 0,
            {valor:yearGoal,estado:yearGoal===null?"indisponivel":"referencia",origem:"Metas de Vendas"}).percentual
          return <tr key={s.id} className="hover:bg-cyan-300/[.035]"><td className="px-3 py-4"><strong className="block text-white">{s.nome}</strong><span className="text-[10px] text-slate-400">{assigned?.texto ?? "Gerente não configurado"}</span></td><td className="px-3 py-4">{brl(ref.valor)}</td><td className="px-3 py-4 font-semibold text-white">{brl(actual)}</td><td className="px-3 py-4">{pct(ratio)}</td><td className="px-3 py-4">{pct(yearRatio)}</td><td className="px-3 py-4">{pct(marge)}</td><td className="px-3 py-4">{brl(number(p?.estoque_custo))}</td><td className="px-3 py-4">{days(number(p?.dde_observado))}</td><td className="px-3 py-4">{pct(late)}</td><td className="px-3 py-4">—</td><td className="px-3 py-4 text-amber-200">Conferir giro e metas</td></tr>
        })}</tbody></table></div>
      <p className="mt-4 text-[11px] text-slate-400">A divergência de referências “SO SAL” entre extrações não interfere aqui: a dashboard usa os seis códigos de filial existentes no Supabase.</p>
    </Section>

    <Section id="dre" title={`DRE ${month.slice(0,4)} — orçado × realizado`} detail="Orçado 2026 · referência da planilha (ou 2027, quando selecionado). Recalculado no banco a partir de Orc_Dados, tipo Projetado. Não há integração contábil homologada do realizado atual: células correspondentes permanecem indisponíveis.">
      <div className="overflow-x-auto"><table className="erp-table w-full min-w-[600px] text-left text-xs"><thead><tr className="text-[10px] uppercase tracking-wider text-slate-400"><th className="px-4 py-3">Conta de resultado</th><th className="px-4 py-3">Orçado mês</th><th className="px-4 py-3">Realizado mês</th><th className="px-4 py-3">Orçado acumulado</th><th className="px-4 py-3">Realizado acumulado</th><th className="px-4 py-3">Desvio</th></tr></thead>
        <tbody className="divide-y divide-slate-700/40">{dreMetrics.map(([label,code]) => {
          const asPercent = code.includes("margem")
          const monthValue = dashboardReference(referenceRows,code,date).valor
          const yearValue = accumulatedBudgetValue(referenceRows,code,month)
          return <tr key={code}><td className="px-4 py-3 font-semibold text-white">{label}</td><td className="px-4 py-3 tabular-nums text-cyan-200">{asPercent?pct(monthValue):brl(monthValue)}</td><td className="px-4 py-3 text-amber-200">—</td><td className="px-4 py-3 tabular-nums text-cyan-200">{asPercent?pct(yearValue):brl(yearValue)}</td><td className="px-4 py-3 text-amber-200">—</td><td className="px-4 py-3 text-amber-200">—</td></tr>
        })}</tbody></table></div>
      <div className="mt-4 text-xs text-amber-200"><Missing reason="Orçamento importado como referência, ainda sem aprovação; resultado contábil realizado e classificação aguardam homologação" /></div>
    </Section>

    <Section id="graficos" title="Galeria de gráficos — mesma organização do Excel" detail="Seis gráficos maiores: duas linhas e quatro barras, acompanhando os cinco velocímetros do topo. As séries disponíveis vêm apenas do Supabase.">
      <div className="grid gap-5 lg:grid-cols-2">
        <ProjectionChart title="Saldo de caixa semanal × mínimo (26 semanas)" subtitle="Simulação com reposições por DDE, sem compras novas e piso de segurança · não homologada" legends={["Com novas compras", "Sem novas compras", "Mínimo de segurança"]}
          series={forecast.state === "simulado" ? [
            {label:"Com novas compras",values:forecast.weekly.noventa.withPurchases},
            {label:"Sem novas compras",values:forecast.weekly.noventa.withoutPurchases},
            {label:"Piso de segurança",values:Array(26).fill(forecast.safetyFloor)},
          ] : undefined} />
        <GroupedBarsChart title="Títulos previstos por semana (13 semanas)" subtitle="Entradas e pagamentos contratados na carteira do Supabase; não é saldo de caixa." labels={["Recebíveis", "Fornecedores"]} unit="money" rows={weeklyContracts} />
        <GroupedBarsChart title="Venda × meta do mês por loja" subtitle={`${dateLabel} · realizado SISCOM × referência do Alex`} labels={["Meta do mês", "Vendido"]} unit="money" rows={shops.map((s, i) => ({
          label: ["Anast.", "Band.", "Campo G.", "Coxim", "Pedro G.", "Rio V."][i],
          values: [dashboardReference(referenceRows, `meta_loja_${s.id}`, date).valor,
            errors.vendas ? null : totals.lojas[s.id]?.vendidoMes ?? 0],
        }))} />
        <GroupedBarsChart title="DDE por linha: hoje × plano × meta final" subtitle="Hoje e plano calculados nos subgrupos com meta individual; meta final definida por linha. Não representa toda a linha." labels={["Hoje (com plano)", "Plano do mês", "Meta final da linha"]} unit="days" rows={[1,2,3,4].map(id => {
          return { label: lines[id], values: [ddePlan[id]?.observedDde ?? null,
            ddePlan[id]?.targetDde ?? null, dashboardReference(referenceRows, `dde_alvo_linha_${id}`, null).valor] }
        })} />
        <GroupedBarsChart title="Estoque parado por loja" subtitle="Aguardando série comparável com os critérios da referência" labels={["Parado (R$)"]} unit="money" rows={shops.map((s, i) => ({ label: ["Anast.", "Band.", "Campo G.", "Coxim", "Pedro G.", "Rio V."][i], values: [null] }))} />
        <ProjectionChart title="Projeção 12M — saldo no fim do mês" subtitle="Planos 90%, 100%, histórico e pior caso correto (sem recebimento do extra de Saúde, com custos mantidos) · não homologados" legends={["Plano 90%", "Plano 100%", "Histórico", "Piso mínimo", "Pior caso correto"]} axisLabels={["M1", "M3", "M5", "M7", "M9", "M11", "M12"]}
          series={forecast.state === "simulado" ? [
            {label:"Plano 90%",values:forecast.monthly.noventa},
            {label:"Plano 100%",values:forecast.monthly.plano},
            {label:"Histórico",values:forecast.monthly.historico},
            {label:"Piso de segurança",values:Array(12).fill(forecast.safetyFloor)},
            {label:"Pior caso correto",values:forecast.monthlyWorst},
          ] : undefined} />
        <GroupedBarsChart title="Títulos previstos por mês (12 meses)" subtitle="Recebíveis e fornecedores de contratos registrados; exclui vendas e compras novas." labels={["Recebíveis", "Fornecedores"]} unit="money" rows={monthlyContracts} />
        <ProjectionChart title="Verba do comprador: já gravado × saldo" subtitle="Orçamento de compra por linha após conciliação financeira" legends={["Verba liberada", "Pedidos gravados", "Saldo"]} type="barras" />
      </div>
      <p className="mt-5 rounded-xl border border-amber-300/15 bg-amber-400/5 px-4 py-3 text-xs leading-6 text-amber-100">Os gráficos separam a carteira contratada das estimativas futuras. A projeção utiliza parâmetros históricos do Alex e dados operacionais atuais, mas falta homologar a conciliação, pedidos a chegar e demais movimentos financeiros. Nenhuma série simulada constitui autorização de OTB.</p>
    </Section>

    <section className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[.04] p-5 text-xs leading-6 text-slate-300">
      <div className="flex flex-wrap items-center gap-2 font-semibold text-cyan-200"><Database size={16} /> Origem e rastreabilidade</div>
      <p className="mt-2">Metas e premissas: {referenceRows.length} registros versionados no Supabase. Valores atuais: tabelas operacionais e RPCs protegidas do Supabase. Referência original: Gestão Zacarini 2.3.7 (Alex), importação inicial independente do Excel.</p>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-400">{Object.entries(errors).map(([name, error]) => <span key={name} className="inline-flex items-center gap-1">{error ? <AlertTriangle size={12} className="text-amber-300" /> : <CheckCircle2 size={12} className="text-emerald-400" />}{name}: {sourceStatus(!error)}</span>)}</div>
      <div className="mt-4 flex flex-wrap items-center gap-4"><Link className="inline-flex items-center gap-1 font-bold text-cyan-300 hover:text-white" href="/compras/otb">OTB <ArrowUpRight size={12} /></Link><Link className="inline-flex items-center gap-1 font-bold text-cyan-300 hover:text-white" href="/compras/plano-estoque">Plano de Estoque <ArrowUpRight size={12} /></Link><Link className="inline-flex items-center gap-1 font-bold text-cyan-300 hover:text-white" href="/compras/otb/fluxo-caixa">Fluxo de Caixa <ArrowUpRight size={12} /></Link></div>
    </section>
  </main>
}
