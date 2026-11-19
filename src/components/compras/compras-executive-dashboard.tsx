import Link from "next/link"
import { Activity, AlertTriangle, ArrowLeft, ArrowUpRight, BarChart3, CalendarDays,
  ChartNoAxesCombined, CheckCircle2, CircleHelp, Database, Landmark,
  ShieldCheck } from "lucide-react"
import { ComprasSair } from "@/components/compras/compras-auth"
import { DASHBOARD_BLOCKS, dashboardReference, metricWithTarget, summarizeDashboardSales,
  type DashboardReferenceRow, type DashboardSalesRow } from "@/domains/compras/domain/dashboard-zacarini-237"

type Position = { filial: string; estoque_custo: number | string | null; cmv_90d: number | string | null;
  dde_observado: number | string | null; carteira_aberta: number | string | null;
  carteira_vencida: number | string | null; percentual_vencido: number | string | null }
type Stock = { linha: number; estoque_custo: number | string | null; cmv_90d: number | string | null;
  grupo_subgrupo: string; sku_count: number | string | null; ultima_atualizacao: string | null }
type History = { mes: string; visao: string; linha: number; venda_bruta: number | string | null;
  cmv: number | string | null; lucro: number | string | null }
type Bank = { conta_ref: string; filial: string; banco: string; data_ultimo_saldo: string | null;
  ultimo_saldo: number | string | null; data_corte_comum: string | null; conciliado: boolean | null }
type Props = { month: string; email: string; referenceRows: DashboardReferenceRow[]; salesRows: DashboardSalesRow[];
  shopPositions: Position[]; stockRows: Stock[]; historicalRows: History[]; bankRows: Bank[];
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

export function ComprasExecutiveDashboard({ month, email, referenceRows, salesRows, shopPositions,
  stockRows, historicalRows, bankRows, errors }: Props) {
  const date = `${month}-01`
  const totals = summarizeDashboardSales(salesRows)
  const activeTargets = [...Array.from({ length: 4 }, (_, i) => dashboardReference(referenceRows, `meta_linha_${i + 1}`, date)),
    ...shops.map(s => dashboardReference(referenceRows, `meta_loja_${s.id}`, date))]
  const haveAllTargets = activeTargets.every(t => t.valor !== null)
  const targetMonth = haveAllTargets ? activeTargets.slice(0, 4).reduce((sum, t) => sum + (t.valor ?? 0), 0) : null
  const salesRatio = metricWithTarget(errors.vendas ? null : totals.vendidoMes,
    { valor: targetMonth, estado: haveAllTargets ? "referencia" : "indisponivel", origem: "Dashboard · metas de linha" })

  const stockByLine = new Map<number, { estoque: number; cmv: number; itens: number }>()
  if (!errors.estoque) for (const row of stockRows) {
    if (!lines[row.linha]) continue
    const item = stockByLine.get(row.linha) ?? { estoque: 0, cmv: 0, itens: 0 }
    item.estoque += number(row.estoque_custo) ?? 0
    item.cmv += number(row.cmv_90d) ?? 0
    item.itens += number(row.sku_count) ?? 0
    stockByLine.set(row.linha, item)
  }
  const stockValue = !errors.estoque && stockRows.length > 0 ? [...stockByLine.values()].reduce((s, l) => s + l.estoque, 0) : null
  const cmv90 = !errors.estoque && stockRows.length > 0 ? [...stockByLine.values()].reduce((s, l) => s + l.cmv, 0) : null
  const dde = stockValue !== null && cmv90 !== null && cmv90 > 0 ? stockValue * 90 / cmv90 : null
  const stockTarget = dashboardReference(referenceRows, "dde_alvo_rede", null)

  const positionMap = new Map(shopPositions.map(p => [p.filial, p]))
  const overdue = !errors.posicao && shopPositions.length > 0
    ? shopPositions.reduce((sum, p) => sum + (number(p.carteira_vencida) ?? 0), 0) : null
  const bankWithBalances = !errors.extratos ? bankRows.filter(b => number(b.ultimo_saldo) !== null) : []
  const banksReconciled = bankWithBalances.length > 0 && bankWithBalances.every(b => b.conciliado === true)

  const months = new Map<string, number>()
  if (!errors.historico) for (const row of historicalRows) {
    if (row.visao !== "vendido" || !/^\d{4}-\d{2}/.test(row.mes)) continue
    const key = row.mes.slice(0, 7)
    const val = number(row.venda_bruta)
    if (val !== null) months.set(key, (months.get(key) ?? 0) + val)
  }
  const trend = [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8)
  const maxTrend = Math.max(1, ...trend.map(([, value]) => value))

  const dateLabel = new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" })

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Indicator label="Vendas do mês × meta" value={errors.vendas ? "—" : brl(totals.vendidoMes)} target={salesRatio.percentual} note={`Meta de referência: ${brl(targetMonth)} · atingimento ${pct(salesRatio.percentual)}`} />
        <Indicator label="Vendas no ano" value={errors.vendas ? "—" : brl(totals.vendidoAno)} note="Meta anual homologada não encontrada; % da meta indisponível." />
        <Indicator label="Margem bruta · saídas" value={errors.vendas ? "—" : pct(totals.margemBruta)} note="Lucro líquido de saída ÷ faturamento de saída, visão operacional." />
        <Indicator label="Margem EBITDA" value="—" note="DRE orçado e realizado homologado ainda indisponível." />
        <Indicator label="Lucro líquido" value="—" note="Resultado líquido oficial ainda indisponível." />
      </div>
    </Section>

    <Section id="caixa" title="Caixa: 13 semanas e Projeção 12M" detail="Mantém os mesmos indicadores prospectivos da planilha. Extratos importados mostram posição bancária observada; não substituem cenários de caixa projetados.">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {["Menor saldo · 13 semanas com OTB", "Menor saldo · 13 semanas sem compras", "Menor saldo · Projeção 12M", "Saldo final · Projeção 12M"].map(label =>
          <div key={label} className="rounded-2xl border border-amber-300/15 bg-amber-400/[.025] p-5"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-3 text-2xl font-bold">—</p><p className="mt-2 text-[11px] text-amber-200">Cenário homologado ainda não disponível</p></div>)}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-cyan-400/15 bg-cyan-300/[.025] p-5 lg:col-span-2">
          <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold"><Landmark size={16} className="text-cyan-300" /> Extratos bancários importados</h3><span className="text-[10px] text-slate-400">{bankWithBalances.length} contas com saldo</span></div>
          <p className="mt-2 text-xs leading-6 text-slate-400">Saldos individualizados, sem soma consolidada quando a conciliação não foi confirmada.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {bankWithBalances.map((b, i) => <div key={`${b.conta_ref}-${i}`} className="flex items-center justify-between gap-2 rounded-xl border border-slate-700/45 bg-slate-950/25 px-3 py-3 text-xs"><div><p className="font-semibold text-slate-200">{b.banco || "Banco"} · {b.filial}</p><p className="mt-1 text-[10px] text-slate-500">{b.data_ultimo_saldo?.slice(0, 10) ?? "Sem data"} · {b.conciliado ? "Conciliado" : "Sem conciliação confirmada"}</p></div><span className="shrink-0 font-bold text-white">{brl(number(b.ultimo_saldo))}</span></div>)}
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
        <Indicator label="Carteira vencida" value={brl(overdue)} note="Títulos em aberto com vencimento anterior à data atual." />
        <Indicator label="Estoque parado" value="—" note="Critério completo de giro e idade não homologado nesta visão." />
        <Indicator label="Prazo médio de recebimento" value="—" note="Prazo efetivo ainda sem fonte homologada." />
        <Indicator label="Serviço da dívida e verba comprador" value="—" note="Obrigações futuras e orçamento de compra não homologados." />
      </div>
    </Section>

    <Section id="linhas" title="Por linha — vendas × meta e DDE × plano" detail="Compradores e metas de novembro são referências identificadas da planilha; vendas, estoque e CMV são leituras do Supabase.">
      <div className="overflow-x-auto"><table className="erp-table w-full min-w-[1050px] text-left text-xs"><thead className="text-[10px] uppercase tracking-wider text-slate-400"><tr>{["Linha · comprador","Meta mês","Vendido mês","% meta mês","% meta ano","Estoque a custo","DDE hoje","Meta DDE","Diferença","Situação"].map(h => <th key={h} className="px-3 py-4">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-700/40">{[1,2,3,4].map(id => {
          const ref = dashboardReference(referenceRows, `meta_linha_${id}`, date)
          const assigned = referenceRows.find(r => r.codigo === `meta_linha_${id}` && r.competencia === date)
          const actual = errors.vendas ? null : totals.linhas[id]?.vendidoMes ?? 0
          const ratio = metricWithTarget(actual, ref).percentual
          const stock = stockByLine.get(id)
          const ddeLine = stock && stock.cmv > 0 ? stock.estoque * 90 / stock.cmv : null
          const goal = dashboardReference(referenceRows, `dde_alvo_linha_${id}`, null).valor
          const diff = ddeLine !== null && goal !== null ? ddeLine - goal : null
          return <tr key={id} className="hover:bg-cyan-300/[.035]"><td className="px-3 py-4"><strong className="block text-white">{lines[id]}</strong><span className="text-[10px] text-slate-400">{assigned?.texto ?? "Responsável não configurado"}</span></td><td className="px-3 py-4">{brl(ref.valor)}</td><td className="px-3 py-4 font-semibold text-white">{brl(actual)}</td><td className="px-3 py-4">{pct(ratio)}</td><td className="px-3 py-4 text-slate-500">—</td><td className="px-3 py-4">{brl(stock?.estoque ?? null)}</td><td className="px-3 py-4">{days(ddeLine)}</td><td className="px-3 py-4">{days(goal)}</td><td className="px-3 py-4">{days(diff)}</td><td className="px-3 py-4 text-amber-200">{diff === null ? "A conferir" : diff > 0 ? "Acima do alvo" : "Dentro do alvo"}</td></tr>
        })}</tbody></table></div>
      <p className="mt-4 flex items-center gap-2 text-[11px] text-amber-200"><CircleHelp size={13} /> Não extrapolar metas desta versão para meses sem configuração; nenhum status constitui autorização de compra.</p>
    </Section>

    <Section id="lojas" title="Por loja — vendas, margem, estoque, receber e parado" detail="Seis filiais da rede. Margem operacional utiliza saídas; carteira vencida utiliza títulos importados e data de vencimento.">
      <div className="overflow-x-auto"><table className="erp-table w-full min-w-[1150px] text-left text-xs"><thead className="text-[10px] uppercase tracking-wider text-slate-400"><tr>{["Loja · gerente","Meta mês","Vendido mês","% meta mês","% meta ano","Margem bruta","Estoque","DDE","Vencido %","Estoque parado","Situação"].map(h => <th key={h} className="px-3 py-4">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-700/40">{shops.map(s => {
          const ref = dashboardReference(referenceRows, `meta_loja_${s.id}`, date)
          const assigned = referenceRows.find(r => r.codigo === `meta_loja_${s.id}` && r.competencia === date)
          const actual = errors.vendas ? null : totals.lojas[s.id]?.vendidoMes ?? 0
          const marge = errors.vendas ? null : totals.lojas[s.id]?.margemBruta ?? null
          const p = errors.posicao ? undefined : positionMap.get(s.id)
          const late = number(p?.percentual_vencido)
          const ratio = metricWithTarget(actual, ref).percentual
          return <tr key={s.id} className="hover:bg-cyan-300/[.035]"><td className="px-3 py-4"><strong className="block text-white">{s.nome}</strong><span className="text-[10px] text-slate-400">{assigned?.texto ?? "Gerente não configurado"}</span></td><td className="px-3 py-4">{brl(ref.valor)}</td><td className="px-3 py-4 font-semibold text-white">{brl(actual)}</td><td className="px-3 py-4">{pct(ratio)}</td><td className="px-3 py-4 text-slate-500">—</td><td className="px-3 py-4">{pct(marge)}</td><td className="px-3 py-4">{brl(number(p?.estoque_custo))}</td><td className="px-3 py-4">{days(number(p?.dde_observado))}</td><td className="px-3 py-4">{pct(late)}</td><td className="px-3 py-4">—</td><td className="px-3 py-4 text-amber-200">Conferir giro e metas</td></tr>
        })}</tbody></table></div>
      <p className="mt-4 text-[11px] text-slate-400">A divergência de referências “SO SAL” entre extrações não interfere aqui: a dashboard usa os seis códigos de filial existentes no Supabase.</p>
    </Section>

    <Section id="dre" title="DRE 2026 — orçado × realizado" detail="Estrutura reproduzida da dashboard. Os valores de DRE não podem ser substituídos pelo retrato da planilha nem inferidos apenas pelas vendas e despesas; requerem fechamento contábil e orçamento homologado.">
      <div className="overflow-x-auto"><table className="erp-table w-full min-w-[600px] text-left text-xs"><thead><tr className="text-[10px] uppercase tracking-wider text-slate-400"><th className="px-4 py-3">Conta de resultado</th><th className="px-4 py-3">Orçado mês</th><th className="px-4 py-3">Realizado mês</th><th className="px-4 py-3">Orçado acumulado</th><th className="px-4 py-3">Realizado acumulado</th><th className="px-4 py-3">Desvio</th></tr></thead>
        <tbody className="divide-y divide-slate-700/40">{["Receita bruta","Receita líquida","(-) CMV","Lucro bruto","Margem bruta %","Total despesas","EBITDA","Margem EBITDA %","Lucro líquido"].map(label => <tr key={label}><td className="px-4 py-3 font-semibold text-white">{label}</td>{[1,2,3,4,5].map(n => <td key={n} className="px-4 py-3 text-amber-200">—</td>)}</tr>)}</tbody></table></div>
      <div className="mt-4 text-xs text-amber-200"><Missing reason="Orçamento e resultado contábil homologados pendentes" /></div>
    </Section>

    <Section id="graficos" title="Gráficos — vendas, margens e projeções" detail="Vendas mensais reais por competência. Projeções de caixa, EBITDA e lucro aguardam fonte financeira oficial; nenhuma curva foi estimada a partir do Excel.">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-700/50 bg-[#0b1524] p-5"><h3 className="flex items-center gap-2 text-sm font-bold"><BarChart3 size={17} className="text-cyan-300" /> Vendas mensais · Supabase</h3>
          {trend.length ? <div className="mt-7 flex h-52 items-end gap-3">{trend.map(([key, val]) => <div className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2" key={key}><span className="text-[10px] font-semibold text-slate-300 opacity-0 transition group-hover:opacity-100">{brl(val)}</span><div className="w-full max-w-16 rounded-t-lg bg-gradient-to-t from-blue-600 to-cyan-400" style={{ height: `${Math.max(2, val / maxTrend * 160)}px` }} title={`${key}: ${brl(val)}`} /><span className="text-[10px] text-slate-400">{key.slice(5)}/{key.slice(2,4)}</span></div>)}</div> : <p className="mt-7 text-xs text-amber-200">Histórico indisponível para o período.</p>}
        </div>
        <div className="rounded-2xl border border-slate-700/50 bg-[#0b1524] p-5"><h3 className="flex items-center gap-2 text-sm font-bold"><Activity size={17} className="text-cyan-300" /> Cenários de caixa 13 semanas e 12M</h3><div className="mt-7 flex h-52 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-amber-300/20 bg-amber-400/[.025] px-8 text-center"><CircleHelp size={28} className="text-amber-300"/><p className="max-w-sm text-xs leading-6 text-slate-300">Cenários projetados ainda não homologados no Supabase. A curva será exibida quando houver dados reais de planejamento, sem vínculo com o arquivo Excel.</p></div></div>
      </div>
    </Section>

    <section className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[.04] p-5 text-xs leading-6 text-slate-300">
      <div className="flex flex-wrap items-center gap-2 font-semibold text-cyan-200"><Database size={16} /> Origem e rastreabilidade</div>
      <p className="mt-2">Metas e premissas: {referenceRows.length} registros versionados no Supabase. Valores atuais: tabelas operacionais e RPCs protegidas do Supabase. Referência original: Gestão Zacarini 2.3.7 (Alex), importação inicial independente do Excel.</p>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-400">{Object.entries(errors).map(([name, error]) => <span key={name} className="inline-flex items-center gap-1">{error ? <AlertTriangle size={12} className="text-amber-300" /> : <CheckCircle2 size={12} className="text-emerald-400" />}{name}: {sourceStatus(!error)}</span>)}</div>
      <div className="mt-4 flex flex-wrap items-center gap-4"><Link className="inline-flex items-center gap-1 font-bold text-cyan-300 hover:text-white" href="/compras/otb">OTB <ArrowUpRight size={12} /></Link><Link className="inline-flex items-center gap-1 font-bold text-cyan-300 hover:text-white" href="/compras/plano-estoque">Plano de Estoque <ArrowUpRight size={12} /></Link><Link className="inline-flex items-center gap-1 font-bold text-cyan-300 hover:text-white" href="/compras/otb/fluxo-caixa">Fluxo de Caixa <ArrowUpRight size={12} /></Link></div>
    </section>
  </main>
}
