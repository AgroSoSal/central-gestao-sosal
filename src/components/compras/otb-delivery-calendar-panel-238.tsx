import Link from "next/link"
import { CalendarClock, AlertTriangle, Truck } from "lucide-react"
import type { OtbDeliveryCalendar238 } from "@/domains/compras/domain/otb-manual-calendar-238"

const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"})
const d=(s:string)=>s.slice(8,10)+"/"+s.slice(5,7)+"/"+s.slice(0,4)
export function OtbDeliveryCalendarPanel238({calendar}:{calendar:OtbDeliveryCalendar238}) {
 return <section className="erp-surface overflow-hidden rounded-[24px]" aria-label="Calendário 26 semanas dos pedidos Zacarini 2.3.8">
  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 p-5 sm:p-7">
   <div>
    <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-cyan-300"><CalendarClock size={15}/> Pedidos de Compra · colunas P até AK</p>
    <h2 className="mt-2 text-xl font-bold">Chegadas e vencimentos das parcelas</h2>
    <p className="mt-2 max-w-4xl text-xs leading-6 text-slate-400">
     Como na Zacarini 2.3.8: prazo padrão de chegada de 7 dias, ou a data específica do Follow-up;
     parcelas pelo número de dias da condição de pagamento e 30 dias para condição não informada.
     Consulta de 26 semanas e 12 competências, apenas informativa.
    </p>
   </div>
   <Link href="/compras/follow-up" className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-xs font-bold text-cyan-200 hover:bg-cyan-400/15"><Truck size={16}/> Informar datas de chegada</Link>
  </div>
  {calendar.state==="indisponivel"?<p role="alert" className="p-5 text-xs text-amber-200">{calendar.reason} Nenhum vencimento foi presumido.</p>:
  <>
   <div className="grid gap-3 p-5 sm:grid-cols-4">
    <div className="rounded-xl border border-slate-700 p-4"><p className="text-xs text-slate-400">Itens ainda pendentes</p><p className="mt-2 text-lg font-bold tabular-nums">{calendar.itemCount.toLocaleString("pt-BR")}</p></div>
    <div className="rounded-xl border border-slate-700 p-4"><p className="text-xs text-slate-400">Saldo pendente da carteira</p><p className="mt-2 text-lg font-bold tabular-nums">{money.format(calendar.pendingValue)}</p></div>
    <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4"><p className="text-xs text-slate-400">Chegada calculada (7 dias)</p><p className="mt-2 text-lg font-bold tabular-nums text-amber-100">{calendar.assumedArrivalItems.toLocaleString("pt-BR")} itens</p></div>
    <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4"><p className="text-xs text-slate-400">Chegada individual confirmada</p><p className="mt-2 text-lg font-bold tabular-nums text-cyan-200">{calendar.explicitArrivalItems.toLocaleString("pt-BR")} itens</p></div>
   </div>
   <div className="p-5 pt-0"><p className="flex items-start gap-2 text-[11px] leading-5 text-amber-200">
    <AlertTriangle size={15} className="mt-0.5 shrink-0"/>
    {calendar.termsToReview.toLocaleString("pt-BR")} itens têm condição de pagamento ausente ou ambígua. Vencimentos estimados podem coincidir com títulos já lançados no contas a pagar; não foram somados novamente ao caixa, evitando duplicidade.
   </p></div>
   <div className="grid gap-4 px-5 pb-6 lg:grid-cols-2">
    <div className="overflow-x-auto rounded-xl border border-slate-700">
     <h3 className="border-b border-slate-800 p-4 text-sm font-bold">Parcelas por competência · próximos 12 meses</h3>
     <table className="erp-table w-full min-w-[420px] text-xs"><thead><tr><th className="p-3 text-left">Mês</th><th className="p-3 text-right">Parcelas</th><th className="p-3 text-right">Valor previsto</th></tr></thead>
      <tbody>{calendar.months.map(m=><tr key={m.month}><td className="p-3">{m.month.slice(5,7)}/{m.month.slice(0,4)}</td><td className="p-3 text-right tabular-nums">{m.installments}</td><td className="p-3 text-right tabular-nums">{money.format(m.amount)}</td></tr>)}</tbody>
     </table>
    </div>
    <div className="overflow-x-auto rounded-xl border border-slate-700">
     <h3 className="border-b border-slate-800 p-4 text-sm font-bold">Calendário semanal · próximas 26 semanas</h3>
     <div className="max-h-[440px] overflow-y-auto"><table className="erp-table w-full min-w-[440px] text-xs"><thead><tr><th className="p-3 text-left">Período</th><th className="p-3 text-right">Parcelas</th><th className="p-3 text-right">Valor previsto</th></tr></thead>
     <tbody>{calendar.weeks.map(w=><tr key={w.start}><td className="p-3">{d(w.start)} a {d(w.end)}</td><td className="p-3 text-right tabular-nums">{w.installments}</td><td className="p-3 text-right tabular-nums">{money.format(w.amount)}</td></tr>)}</tbody>
     </table></div>
    </div>
   </div>
  </>}
 </section>
}
