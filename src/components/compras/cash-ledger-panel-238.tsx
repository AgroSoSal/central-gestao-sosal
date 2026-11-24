"use client"

import { useState } from "react"
import { BookOpenCheck, ChevronDown, ShieldAlert } from "lucide-react"
import type { CashForecastResult } from "@/domains/compras/domain/zacarini-cash-forecast"
import {
  CASH_LEDGER_SCENARIOS_238,cashLedgerView238,cashLedgerIncome238,cashLedgerOutflow238,
  type CashLedgerScenario238,
} from "@/domains/compras/domain/cash-forecast-ledger-238"

const money = new Intl.NumberFormat("pt-BR", { style:"currency",currency:"BRL" })
const month = new Intl.DateTimeFormat("pt-BR",{month:"short",year:"numeric",timeZone:"UTC"})
const formatMonth=(date:string)=>month.format(new Date(date+"T12:00:00Z"))

export function CashLedgerPanel238({forecast}: {forecast:CashForecastResult | undefined}) {
  const [scenario,setScenario] = useState<CashLedgerScenario238>("noventa")
  const ledger = cashLedgerView238(forecast,scenario)
  if (!forecast || forecast.state !== "simulado") return null

  return <section className="erp-surface overflow-hidden rounded-[24px] border border-cyan-300/15" aria-label="Memória detalhada de cálculo da Projeção 12M">
    <details className="group" open>
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <span className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-cyan-200"><BookOpenCheck size={20}/></span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-300">Projeção 12M · memória da fórmula</p>
            <h2 className="mt-2 text-xl font-bold text-white">Entradas, saídas e saldo mês a mês</h2>
            <p className="mt-2 max-w-4xl text-xs leading-6 text-slate-400">
              Reconciliação matemática do próprio motor Zacarini: saldo inicial + entradas − saídas = saldo final.
              Abrange 12 competências, os três cenários e o pior caso. Não importa saldos do Excel.
            </p>
          </div>
        </div>
        <ChevronDown size={21} className="text-slate-400 transition-transform group-open:rotate-180"/>
      </summary>

      <div className="border-t border-[#25354e] px-5 py-5 sm:px-7">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Selecionar cenário detalhado">
          {CASH_LEDGER_SCENARIOS_238.map(item=><button
            key={item.id} type="button" aria-pressed={scenario===item.id}
            onClick={()=>setScenario(item.id)}
            className={`rounded-xl border px-4 py-2.5 text-xs font-semibold transition ${scenario===item.id
              ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-100"
              : "border-white/10 bg-white/[.035] text-slate-400 hover:border-cyan-400/25 hover:text-slate-200"}`}>
            {item.label}
          </button>)}
        </div>
        {!ledger?<p role="alert" className="mt-5 rounded-xl border border-amber-400/25 bg-amber-400/10 p-4 text-xs text-amber-100">
          As movimentações não fecham matematicamente com o saldo projetado. Por segurança, o detalhamento não é exibido nem tratado como valor autorizado.
        </p>:<>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {label:"Saldo inicial",value:ledger.saldoInicial},
              {label:"Entradas acumuladas",value:ledger.totalRecebimentos},
              {label:"Saídas acumuladas",value:ledger.totalSaidas},
              {label:"Saldo no 12º mês",value:ledger.saldoFinal},
            ].map(v=><div key={v.label} className="rounded-xl border border-slate-700/70 bg-[#0b192b] p-4">
              <p className="text-xs text-slate-400">{v.label}</p>
              <p className="mt-2 text-lg font-bold tabular-nums text-white">{money.format(v.value)}</p>
            </div>)}
          </div>
          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-700/70">
            <table className="w-full min-w-[1660px] text-left text-xs">
              <thead className="bg-[#122239] text-slate-300">
                <tr>
                  <th className="sticky left-0 bg-[#122239] p-3">Competência</th>
                  <th className="p-3 text-right">Saldo inicial</th>
                  <th className="p-3 text-right">Títulos receber</th>
                  <th className="p-3 text-right">Receb. vendas</th>
                  <th className="p-3 text-right">Recup. vencidos</th>
                  <th className="p-3 text-right">Títulos pagar</th>
                  <th className="p-3 text-right">Despesas</th>
                  <th className="p-3 text-right">Impostos</th>
                  <th className="p-3 text-right">Pessoal</th>
                  <th className="p-3 text-right">Compras novas</th>
                  {scenario==="pior"&&<th className="p-3 text-right">Saúde não recebida</th>}
                  <th className="p-3 text-right">Entradas</th>
                  <th className="p-3 text-right">Saídas</th>
                  <th className="p-3 text-right">Saldo final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {ledger.months.map(row=><tr key={row.mes} className="hover:bg-cyan-400/[.045]">
                  <td className="sticky left-0 bg-[#0b192b] p-3 font-semibold capitalize text-cyan-200">{formatMonth(row.mes)}</td>
                  <td className="whitespace-nowrap p-3 text-right tabular-nums">{money.format(row.saldoInicial)}</td>
                  <td className="whitespace-nowrap p-3 text-right tabular-nums">{money.format(row.titulosReceber)}</td>
                  <td className="whitespace-nowrap p-3 text-right tabular-nums">{money.format(row.recebimentosVendas)}</td>
                  <td className="whitespace-nowrap p-3 text-right tabular-nums">{money.format(row.recuperacaoVencidos)}</td>
                  <td className="whitespace-nowrap p-3 text-right tabular-nums">{money.format(row.titulosPagar)}</td>
                  <td className="whitespace-nowrap p-3 text-right tabular-nums">{money.format(row.despesas)}</td>
                  <td className="whitespace-nowrap p-3 text-right tabular-nums">{money.format(row.impostos)}</td>
                  <td className="whitespace-nowrap p-3 text-right tabular-nums">{money.format(row.pessoal)}</td>
                  <td className="whitespace-nowrap p-3 text-right tabular-nums">{money.format(row.comprasNovasVencidas)}</td>
                  {scenario==="pior"&&<td className="whitespace-nowrap p-3 text-right tabular-nums text-amber-200">{money.format(row.extraSaudeNaoRecebido)}</td>}
                  <td className="whitespace-nowrap p-3 text-right font-semibold tabular-nums text-emerald-200">{money.format(cashLedgerIncome238(row))}</td>
                  <td className="whitespace-nowrap p-3 text-right font-semibold tabular-nums text-amber-200">{money.format(cashLedgerOutflow238(row))}</td>
                  <td className="whitespace-nowrap p-3 text-right font-bold tabular-nums text-white">{money.format(row.saldoFinal)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-400/5 p-4 text-xs leading-6 text-amber-100">
            <ShieldAlert className="mt-0.5 shrink-0" size={17}/>
            <p>Simulação não homologada: inclui títulos identificados e premissas versionadas, mas a existência de 12 competências e o fechamento matemático não confirmam saldos bancários, impostos ou orçamento oficial. O pior caso mantém as despesas e compras e retira somente o recebimento projetado da venda adicional de Saúde.</p>
          </div>
        </>}
      </div>
    </details>
  </section>
}
