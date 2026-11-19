import { BarChart3, CircleHelp, LineChart, Target } from "lucide-react"

type GaugeProps = { label: string; value: number | null; headline: string; detail: string }
type BarRow = { label: string; values: (number | null)[] }
type GroupedBarsProps = { title: string; subtitle: string; labels: string[]; rows: BarRow[]; unit: "money" | "days" }

const palette = ["#33c9f4", "#c4b5fd", "#eab308"]
const compactMoney = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 })
const compactDays = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 })

function point(angle: number, radius = 87) {
  const radians = angle * Math.PI / 180
  return [120 + Math.cos(radians) * radius, 119 + Math.sin(radians) * radius]
}
function arc(from: number, to: number) {
  const [x1, y1] = point(from)
  const [x2, y2] = point(to)
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A 87 87 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

/** Semicírculo do Excel: quatro zonas de desempenho até 120%, com ponteiro quando a meta existe. */
export function PerformanceGauge({ label, value, headline, detail }: GaugeProps) {
  const valid = value !== null && Number.isFinite(value)
  const angle = 180 + Math.min(1.2, Math.max(0, value ?? 0)) / 1.2 * 180
  const [x, y] = point(angle, 69)
  const ranges = [
    { start: 180, end: 300, color: "#f43f5e" },
    { start: 300, end: 315, color: "#f59e0b" },
    { start: 315, end: 330, color: "#facc15" },
    { start: 330, end: 360, color: "#10b981" },
  ]
  return <div className="relative flex min-w-0 flex-col rounded-2xl border border-cyan-300/10 bg-gradient-to-b from-[#101e32] to-[#090f1d] px-3 pb-5 pt-4 text-center shadow-[inset_0_1px_rgba(255,255,255,.06)]">
    <p className="min-h-8 text-[10px] font-extrabold uppercase leading-4 tracking-wider text-slate-300">{label}</p>
    <svg role="img" aria-label={`${label}: ${valid ? Math.round((value ?? 0) * 100) + "% do objetivo" : "sem índice de atingimento validado"}`} viewBox="0 0 240 148" className="mx-auto mt-2 w-full max-w-[232px] overflow-visible">
      <path d={arc(180, 360)} fill="none" stroke="#27364c" strokeWidth="19" strokeLinecap="round" />
      {ranges.map(r => <path key={r.start} d={arc(r.start + .6, r.end - .6)} fill="none" stroke={r.color} strokeWidth="16" />)}
      {valid && <><line x1="120" y1="119" x2={x} y2={y} stroke="white" strokeWidth="3.5" strokeLinecap="round" /><circle cx="120" cy="119" r="7" fill="#e2e8f0" stroke="#1f2937" strokeWidth="3" /></>}
      <text x="24" y="144" fill="#64748b" fontSize="12">0%</text><text x="198" y="144" fill="#64748b" fontSize="12">120%</text>
    </svg>
    <p className="-mt-6 text-[clamp(1.25rem,2vw,1.65rem)] font-extrabold tracking-tight text-white">{headline}</p>
    <p className="mx-auto mt-2 max-w-[230px] text-[11px] leading-5 text-slate-400">{detail}</p>
  </div>
}

function formatAxis(value: number, unit: "money" | "days") {
  return unit === "money" ? `${compactMoney.format(value / 1000000)} mi` : compactDays.format(value)
}

/** Barras reais e referências em uma só escala: nulos deixam lacunas, nunca barras zero. */
export function GroupedBarsChart({ title, subtitle, labels, rows, unit }: GroupedBarsProps) {
  const allValues = rows.flatMap(r => r.values).filter((n): n is number => n !== null && Number.isFinite(n) && n >= 0)
  const max = Math.max(1, ...allValues) * 1.12
  const plot = { left: 58, top: 26, width: 526, height: 200 }
  const groupWidth = plot.width / Math.max(1, rows.length)
  const barGap = 3
  const barWidth = Math.min(23, (groupWidth - 14) / Math.max(1, labels.length) - barGap)
  const hasData = allValues.length > 0
  return <article className="rounded-2xl border border-slate-700/50 bg-gradient-to-b from-[#101c2c] to-[#0b1422] p-5 shadow-[inset_0_1px_rgba(255,255,255,.04)]">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="flex items-center gap-2 text-sm font-bold text-slate-100"><BarChart3 size={16} className="text-cyan-300" /> {title}</h3><p className="mt-1.5 text-[11px] leading-5 text-slate-400">{subtitle}</p></div>
      <span className="rounded-full border border-cyan-300/15 bg-cyan-300/5 px-2 py-1 text-[10px] text-slate-400">{unit === "money" ? "R$ milhões" : "dias"}</span></div>
    <svg role="img" aria-label={title} viewBox="0 0 620 285" className="mt-4 w-full">
      {Array.from({ length: 5 }, (_, i) => {
        const y = plot.top + plot.height * i / 4
        return <g key={i}><line x1={plot.left} y1={y} x2={plot.left + plot.width} y2={y} stroke="#334155" strokeDasharray="4 5" opacity=".55"/><text x="50" y={y + 4} fill="#94a3b8" fontSize="10" textAnchor="end">{formatAxis(max * (1 - i / 4), unit)}</text></g>
      })}
      {rows.map((r, gi) => {
        const center = plot.left + gi * groupWidth + groupWidth / 2
        return <g key={`${r.label}-${gi}`}>
          {r.values.map((n, si) => {
            if (n === null || !Number.isFinite(n) || n < 0) return null
            const height = Math.max(n > 0 ? 2 : 0, n / max * plot.height)
            const x = center + (si - (labels.length - 1) / 2) * (barWidth + barGap) - barWidth / 2
            return <rect key={si} x={x} y={plot.top + plot.height - height} width={Math.max(3, barWidth)} height={height} rx="3" fill={palette[si]} opacity=".95"><title>{`${r.label} · ${labels[si]}: ${formatAxis(n, unit)}`}</title></rect>
          })}
          <text x={center} y={plot.top + plot.height + 19} textAnchor="middle" fontSize="10" fill="#cbd5e1">{r.label}</text>
        </g>
      })}
      {!hasData && <g><rect x="120" y="81" width="430" height="100" rx="12" fill="#111d2f" opacity=".9"/><text x="335" y="124" textAnchor="middle" fill="#fbbf24" fontSize="14">Sem série validada no Supabase</text><text x="335" y="146" textAnchor="middle" fill="#94a3b8" fontSize="10">O desenho é preservado sem estimar valores</text></g>}
    </svg>
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-slate-700/40 pt-4">{labels.map((label, i) => <span key={label} className="flex items-center gap-2 text-[11px] text-slate-300"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: palette[i] }} />{label}</span>)}</div>
  </article>
}

/** O esqueleto da projeção é intencional; extrato observado nunca vira previsão. */
export function ProjectionChart({ title, subtitle, legends, type = "linha", axisLabels, series }: {
  title: string; subtitle: string; legends: string[]; type?: "linha" | "barras"; axisLabels?: string[];
  series?: { label: string; values: (number | null)[] }[]
}) {
  const validSeries = (series ?? []).filter(s => s.values.length > 0 && s.values.every(n => n !== null && Number.isFinite(n)))
  const all = validSeries.flatMap(s => s.values as number[])
  const hasData = type === "linha" && all.length > 0
  const lower = hasData ? Math.min(...all) : 0
  const upper = hasData ? Math.max(...all) : 1
  const padding = Math.max((upper - lower) * .12, 1)
  const min = lower - padding
  const max = upper + padding
  const yOf = (v: number) => 224 - (v - min) / (max - min) * 194
  const xOf = (i: number, n: number) => 48 + i * 546 / Math.max(1, n - 1)
  return <article className="rounded-2xl border border-slate-700/50 bg-gradient-to-b from-[#101c2c] to-[#0b1422] p-5 shadow-[inset_0_1px_rgba(255,255,255,.04)]">
    <div><h3 className="flex items-center gap-2 text-sm font-bold text-slate-100">{type === "linha" ? <LineChart size={16} className="text-cyan-300" /> : <Target size={16} className="text-cyan-300" />}{title}</h3><p className="mt-1.5 text-[11px] leading-5 text-slate-400">{subtitle}</p></div>
    <div className="relative mt-4">
      <svg role="img" aria-label={`${title}: ${hasData ? "séries financeiras parciais" : "sem dados homologados"}`} viewBox="0 0 620 285" className="w-full">
        {Array.from({ length: 5 }, (_, i) => <g key={i}><line x1="48" x2="594" y1={30 + i * 48} y2={30 + i * 48} stroke="#334155" strokeDasharray="4 5" opacity=".55" />{hasData&&<text x="42" y={34+i*48} fill="#94a3b8" fontSize="10" textAnchor="end">{compactMoney.format((max-(max-min)*i/4)/1000000)} mi</text>}</g>)}
        <line x1="48" x2="48" y1="30" y2="224" stroke="#475569"/><line x1="48" x2="594" y1="224" y2="224" stroke="#475569"/>
        {validSeries.map((s, si) => <g key={s.label}>
          <polyline points={(s.values as number[]).map((v,i)=>`${xOf(i,s.values.length)},${yOf(v)}`).join(" ")} fill="none" stroke={palette[si % palette.length]} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          {(s.values as number[]).map((v, i) => <circle key={i} cx={xOf(i,s.values.length)} cy={yOf(v)} r="2.4" fill={palette[si % palette.length]}><title>{`${s.label}: ${new Intl.NumberFormat("pt-BR", { style:"currency",currency:"BRL" }).format(v)}`}</title></circle>)}
        </g>)}
        {(axisLabels ?? (type === "linha" ? ["S1", "S5", "S9", "S13", "S17", "S21", "S26"] : ["Nut.", "Saúde", "Outros", "Past."])).map((label, i, all) =>
          <text key={`${label}-${i}`} x={48 + i * 546 / Math.max(1, all.length - 1)} y="243" textAnchor="middle" fill="#94a3b8" fontSize="11">{label}</text>)}
      </svg>
      {!hasData&&<div className="absolute inset-x-[12%] top-[27%] flex flex-col items-center gap-3 rounded-xl border border-amber-400/20 bg-[#111a2b]/95 px-4 py-5 text-center shadow-lg"><CircleHelp size={23} className="text-amber-300"/><span className="text-xs font-semibold text-amber-100">Aguardando cenário homologado</span><span className="text-[11px] leading-5 text-slate-400">Sem simular valores que o banco ainda não possui</span></div>}
    </div>
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-slate-700/40 pt-4">{legends.map((label, i) => <span key={label} className="flex items-center gap-2 text-[11px] text-slate-400"><span className="h-1 w-5 rounded-full" style={{ backgroundColor: palette[i % palette.length] }} />{label}</span>)}</div>
  </article>
}
