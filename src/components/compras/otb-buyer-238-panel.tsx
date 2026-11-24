"use client"

import { useMemo, useState } from "react"
import { ShieldAlert, Layers3 } from "lucide-react"
import type { OtbMonth } from "@/domains/compras/domain/otb-calculation"
import { calculateBuyerBudget238 } from "@/domains/compras/domain/otb-buyer-budget-238"

const money = new Intl.NumberFormat("pt-BR", {style:"currency",currency:"BRL"})

/** Versão 2.3.8: aplica a regra posterior ao rateio 90/10.
 * Não mistura o valor simulado com verba operacional homologada.
 */
export function OtbBuyer238Panel({month, simulated}:{month:OtbMonth; simulated:boolean}) {
  const budget=useMemo(()=>{
    try {
      const [year,mon]=month.month.split("-").map(Number)
      const days=new Date(Date.UTC(year,mon,0)).getUTCDate()
      return calculateBuyerBudget238({
        month:month.month,cashCap:month.cashCap,daysInMonth:days,share:0.9,
        subgroups:month.subgroups.map(s=>({
          line:s.line,name:s.name,kind:s.kind,need:s.need,
          openingStock:s.openingStock,forecastCost:s.forecastCost,
        })),
        lines:month.lines.map(line=>({
          line:line.line,availableAfterExcess:line.freeBalance,
        })),
      })
    } catch { return null }
  },[month])
  const [query, setQuery] = useState("")
  const missingMp=month.mpNeed>0
  return <section className="erp-surface overflow-hidden rounded-[24px]" aria-label="Verba do Comprador conforme fórmulas Zacarini 2.3.8">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#25354e] p-5 sm:p-7">
      <div>
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-cyan-300"><Layers3 size={15}/> Verba Comprador · Zacarini 2.3.8</p>
        <h2 className="mt-2 text-xl font-bold text-white">Cortes após a reserva de 10%, por DDE e saldo da linha</h2>
        <p className="mt-2 max-w-4xl text-xs leading-6 text-slate-400">
          A fórmula efetiva usa 90% em OTB!R24 (mesmo que rótulos da aba digam 85%).
          Mantém subgrupos com DDE inicial abaixo de 30 dias, corta os demais quando o teto aperta,
          e aplica por linha o saldo depois dos excessos e pedidos. Este cálculo não aprova compras.
        </p>
      </div>
      <span className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[11px] font-bold text-amber-100">
        {simulated?"Somente teste":"Prévia não homologada"}
      </span>
    </div>
    {!budget?<p role="status" className="p-6 text-xs text-amber-200">Verba do comprador não calculada: há valores, linhas ou classificações inconsistentes.</p>:
      <>
        <div className="grid gap-3 border-b border-slate-800 p-5 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-700 p-4"><p className="text-xs text-slate-400">Necessidade × 90% · mercadorias classificadas S</p><p className="mt-2 text-xl font-bold tabular-nums">{money.format(budget.desired)}</p></div>
          <div className="rounded-xl border border-slate-700 p-4"><p className="text-xs text-slate-400">Verba protegida · DDE inferior a 30 dias</p><p className="mt-2 text-xl font-bold tabular-nums">{money.format(budget.protected)}</p></div>
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4"><p className="text-xs text-slate-400">Após cortes por linha · referência</p><p className="mt-2 text-xl font-bold tabular-nums text-cyan-200">{money.format(budget.buyerTotal)}</p></div>
        </div>
        <div className="overflow-x-auto"><table className="erp-table w-full min-w-[850px] text-left text-xs">
          <thead className="bg-[#121e30] uppercase tracking-wide text-slate-400"><tr>
            <th className="p-4">Linha</th><th className="p-4 text-right">Necessidade 90%</th><th className="p-4 text-right">DDE protegido</th><th className="p-4 text-right">Após trava caixa</th><th className="p-4 text-right">Saldo após excesso</th><th className="p-4 text-right">Verba comprador</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-800">{budget.lines.map(line=><tr key={line.line}>
            <td className="p-4 font-bold text-cyan-300">{line.line}</td>
            <td className="p-4 text-right tabular-nums">{money.format(line.desired)}</td>
            <td className="p-4 text-right tabular-nums">{money.format(line.protected)}</td>
            <td className="p-4 text-right tabular-nums">{money.format(line.afterCashCut)}</td>
            <td className="p-4 text-right tabular-nums">{money.format(line.availableAfterExcess)}</td>
            <td className="p-4 text-right font-bold tabular-nums">{money.format(line.buyer)}</td>
          </tr>)}</tbody>
        </table></div>
        <details className="border-t border-slate-800" aria-label="Detalhamento por grupo e subgrupo">
          <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/5 sm:px-7">
            Conferir rateio por grupo-subgrupo ({budget.subgroups.length} registros) · fórmula Verba Comprador
          </summary>
          <div className="border-t border-slate-800 px-5 py-4 sm:px-7">
            <label htmlFor="buyer238-subgroup-search" className="block text-xs font-semibold text-slate-300">
              Filtrar grupo, subgrupo ou linha
            </label>
            <input id="buyer238-subgroup-search" type="search" value={query}
              onChange={(event)=>setQuery(event.target.value)}
              placeholder="Ex.: SEMENTES, SAÚDE, MATÉRIA PRIMA"
              className="mt-2 w-full max-w-xl rounded-lg border border-slate-600 bg-[#091829] px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
            />
            <p className="mt-2 text-[11px] text-slate-400">Apenas classificação S gera necessidade de compra nesta aba. Linhas P/M/N ficam visíveis com verba zero.</p>
          </div>
          <div className="max-h-[520px] overflow-auto">
            <table className="erp-table w-full min-w-[1010px] text-left text-xs">
              <thead className="sticky top-0 z-10 bg-[#121e30] text-slate-300">
                <tr>
                  <th className="p-3">Linha / subgrupo</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3 text-right">DDE inicial</th>
                  <th className="p-3 text-right">Necessidade × 90%</th>
                  <th className="p-3 text-right">Após trava de caixa</th>
                  <th className="p-3 text-right">Verba comprador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {budget.subgroups.filter(s=>{
                  const term=query.trim().toLocaleUpperCase("pt-BR")
                  return !term || (s.line+" "+s.name).toLocaleUpperCase("pt-BR").includes(term)
                }).map(s=><tr key={s.line+"|"+s.name}>
                  <td className="p-3"><span className="font-semibold text-slate-200">{s.name}</span><span className="ml-2 text-slate-500">({s.line})</span></td>
                  <td className="p-3 text-slate-300">{s.kind}</td>
                  <td className="p-3 text-right tabular-nums">{s.ddeOpening===null?"—":s.ddeOpening.toLocaleString("pt-BR",{maximumFractionDigits:1})+" dias"}{s.isProtected?<span className="ml-2 text-emerald-300">Protegido</span>:null}</td>
                  <td className="p-3 text-right tabular-nums">{money.format(s.desired)}</td>
                  <td className="p-3 text-right tabular-nums">{money.format(s.afterCashCut)}</td>
                  <td className="p-3 text-right font-bold tabular-nums text-cyan-200">{money.format(s.buyer)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </details>
        <p className="p-5 text-[11px] leading-6 text-amber-200">
          {missingMp?"A matéria-prima aparece em um bloco separado neste ERP; enquanto seu DDE e orçamento por linha não forem conciliados com a linha S da planilha, estes totais são APENAS de mercadorias e não podem ser comparados à verba global da Zacarini. ":""}
          {budget.protectedAboveCashCap?"A proteção DDE excede o teto simulado; isso exige decisão financeira explícita. ":""}
          Este painel não registra autorização, não desconta valores em contas e não cria pedidos.
        </p>
      </>}
  </section>
}
