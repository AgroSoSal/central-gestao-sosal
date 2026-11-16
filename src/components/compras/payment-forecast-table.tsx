import { CalendarDays, CircleAlert, CircleCheck, ReceiptText } from "lucide-react"
import { getBranchDisplayName } from "@/domains/compras/domain/branches"
import { decisionKey } from "@/domains/compras/domain/purchase-decisions"
import type { ForecastWeek, PurchasePaymentForecast } from "@/domains/compras/domain/purchase-payment-forecast"

export type PaymentForecastRow = {
  item: {
    loja: string | null
    pedido: string | null
    produto_codigo: string | null
    descricao: string | null
    fornecedor_nome: string | null
    condicao_pagamento: string | null
    quantidade_pendente?: number | string | null
    quantidade_recebida?: number | string | null
    situacao_recebimento?: string | null
  }
  forecast: PurchasePaymentForecast
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const currencyCompact = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 })
const quantity = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 })
const dateBR = (iso: string | null) => iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)
  ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—"

function decisionStyle(status: string): string {
  if (status === "Aprovado") return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
  if (status === "Cancelar") return "border-rose-400/25 bg-rose-400/10 text-rose-200"
  return "border-amber-400/25 bg-amber-400/10 text-amber-200"
}

export function PaymentForecastCalendar({ weeks }: { weeks: ForecastWeek[] }) {
  const ceiling = Math.max(1, ...weeks.map((week) => week.amount))

  return <section className="erp-surface overflow-hidden rounded-2xl border border-cyan-400/15 p-5 sm:p-6" aria-label="Calendário de pagamentos em 26 semanas">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-base font-bold text-white"><CalendarDays size={18} className="text-cyan-300" /> Calendário de 26 semanas</h2><p className="mt-1 text-xs text-slate-400">Parcelas ainda pendentes de entrega. Sem saldo bancário, trava de caixa ou OTB nesta versão.</p></div>
      <span className="rounded-lg border border-cyan-300/15 bg-cyan-400/5 px-3 py-2 text-xs text-cyan-100">Semanas contadas a partir da data-base</span>
    </div>
    <div className="mt-6 overflow-x-auto pb-2" role="region" aria-label="Distribuição semanal dos vencimentos">
      <div className="flex min-w-max items-end gap-2">
        {weeks.map((week) => {
          const barHeight = week.amount > 0 ? Math.max(12, Math.round(108 * week.amount / ceiling)) : 4
          return <div key={week.index} className="w-[66px] shrink-0 text-center" title={`Semana ${week.index} · ${dateBR(week.startsAt)} a ${dateBR(week.endsAt)} · ${currency.format(week.amount)}`}>
            <div className="flex h-28 items-end justify-center"><div className={`w-9 rounded-t-md ${week.amount > 0 ? "bg-gradient-to-t from-cyan-600 to-blue-400" : "bg-slate-700/60"}`} style={{ height: `${barHeight}px` }} /></div>
            <p className="mt-2 text-[11px] font-bold text-slate-200">S{String(week.index).padStart(2, "0")}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">{week.startsAt.slice(8, 10)}/{week.startsAt.slice(5, 7)}</p>
            <p className="mt-1 truncate text-[10px] font-semibold text-cyan-200">{week.amount ? currencyCompact.format(week.amount) : "—"}</p>
          </div>
        })}
      </div>
    </div>
  </section>
}

export function PaymentForecastTable({ rows }: { rows: PaymentForecastRow[] }) {
  return <section className="erp-surface overflow-hidden rounded-2xl border border-[#2b4058]" aria-label="Pedidos e parcelas projetadas">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0d2034] px-5 py-4">
      <h2 className="flex items-center gap-2 text-sm font-bold text-white"><ReceiptText size={17} className="text-cyan-300" /> Pedidos e vencimentos</h2>
      <span className="text-xs text-slate-400">{rows.length} itens neste lote. Confira as parcelas de cada produto.</span>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1180px] text-left text-xs">
        <thead className="bg-[#111d30] text-[10px] font-bold uppercase tracking-wide text-slate-400">
          <tr><th className="px-4 py-4">Pedido / Filial</th><th className="px-4 py-4">Fornecedor / Produto</th><th className="px-4 py-4">Decisão</th><th className="px-4 py-4">Chegada prevista</th><th className="px-4 py-4">Condição</th><th className="px-4 py-4 text-right">Saldo pendente</th><th className="px-4 py-4 text-right">26 semanas</th><th className="px-4 py-4">Detalhamento</th></tr>
        </thead>
        <tbody className="divide-y divide-white/[.07]">
          {rows.map(({ item, forecast }) => <tr key={decisionKey(item.loja ?? "", item.pedido ?? "", item.produto_codigo ?? "")} className="align-top text-slate-200 hover:bg-cyan-400/[.04]">
            <td className="px-4 py-4"><span className="font-bold text-cyan-300">#{item.pedido}</span><p className="mt-1 text-[11px] font-semibold text-slate-300">{getBranchDisplayName(item.loja ?? "")}</p><p className="mt-1 text-[10px] text-slate-500">SKU {item.produto_codigo}</p></td>
            <td className="max-w-56 px-4 py-4"><span className="block truncate text-[11px] text-slate-400" title={item.fornecedor_nome ?? ""}>{item.fornecedor_nome ?? "—"}</span><span className="mt-1 block font-semibold text-white" title={item.descricao ?? ""}>{item.descricao ?? "—"}</span></td>
            <td className="px-4 py-4"><span className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-bold ${decisionStyle(forecast.operationalDecision)}`}>{forecast.operationalDecision}</span><p className="mt-2 text-[11px] text-slate-400">{forecast.status === "conferir" ? "Conferir pagamento" : forecast.status === "entregue" ? "Entrega concluída" : forecast.status === "sem_valor" ? "Sem valor financeiro" : forecast.status === "sem_dados" ? "Dados incompletos" : forecast.included ? "Na projeção" : "Fora da projeção"}</p></td>
            <td className="whitespace-nowrap px-4 py-4"><span className="font-semibold">{dateBR(forecast.estimatedArrival)}</span><p className="mt-1 text-[10px] text-slate-400">{forecast.arrivalSource === "follow-up" ? "Follow-up do comprador" : forecast.arrivalSource === "calculada" ? "Estimativa de 7 dias" : "—"}</p></td>
            <td className="px-4 py-4"><span className="font-semibold">{forecast.conditionSource === "padrao" ? "30 dias padrão" : (item.condicao_pagamento || "—")}</span>{forecast.conditionSource === "invalida" && <p className="mt-1 text-[10px] text-amber-200">Conferir condição</p>}</td>
            <td className="whitespace-nowrap px-4 py-4 text-right font-bold text-amber-200">
              {forecast.pendingAmount === null ? "Não conciliado" : currency.format(forecast.pendingAmount)}
              {item.situacao_recebimento === "Chegada parcial" && <span className="mt-2 block text-[10px] font-semibold text-blue-200">Chegada parcial</span>}
              {item.quantidade_recebida != null && item.quantidade_pendente != null && <span className="mt-1 block text-[10px] font-normal text-slate-400">{quantity.format(Number(item.quantidade_recebida))} recebidas · {quantity.format(Number(item.quantidade_pendente))} pendentes</span>}
            </td>
            <td className="whitespace-nowrap px-4 py-4 text-right font-bold text-cyan-200">{forecast.included ? currency.format(forecast.inHorizonAmount) : "—"}</td>
            <td className="min-w-48 px-4 py-4">
              {forecast.installments.length > 0 ? <details className="group">
                <summary className="cursor-pointer font-bold text-cyan-300 underline-offset-4 hover:underline">Ver {forecast.installments.length} parcela(s)</summary>
                <ol className="mt-3 space-y-2 rounded-lg border border-white/10 bg-[#071525] p-3 text-[11px]">
                  {forecast.installments.map((installment) => <li key={installment.number} className="flex justify-between gap-3"><span>{installment.number}ª · {dateBR(installment.dueDate)}<span className="block text-[10px] text-slate-400">{installment.horizon === "26_semanas" ? "Dentro das 26 semanas" : installment.horizon === "vencido" ? "Vencido" : "Após o horizonte"}</span></span><strong className="whitespace-nowrap text-cyan-200">{currency.format(installment.amount)}</strong></li>)}
                </ol>
              </details> : <span className="text-xs text-slate-500">Sem parcelas</span>}
              {!!forecast.issue && <p className="mt-2 flex items-start gap-1 text-[10px] leading-4 text-amber-200"><CircleAlert size={12} className="mt-0.5 shrink-0" /> {forecast.issue}</p>}
              {forecast.status === "entregue" && <span className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-200"><CircleCheck size={13} /> Sem saldo a projetar</span>}
            </td>
          </tr>)}
        </tbody>
      </table>
    </div>
    {rows.length === 0 && <p className="px-6 py-12 text-center text-sm text-slate-400">Nenhum pedido encontrado neste lote.</p>}
  </section>
}
