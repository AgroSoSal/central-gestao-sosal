"use client"

import Link from "next/link"
import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Database, LockKeyhole, Save, ShieldCheck, Wallet } from "lucide-react"
import { saveOtbPremises, type PremisesSaveState } from "@/app/compras/otb/premissas/actions"

const initialPremisesSaveState: PremisesSaveState = { status: "idle", message: "" }

export type ExistingPremise = {
  id: number
  competencia_inicio: string
  saldo_inicial_caixa: number
  colchao_caixa: number
  observacao: string
  criado_em: string
}

export function OtbPremissasForm({ month, versions, enabled }: {
  month: string
  versions: ExistingPremise[]
  enabled: boolean
}) {
  const router = useRouter()
  const [state, action, isPending] = useActionState(saveOtbPremises, initialPremisesSaveState)
  const latest = versions[0]

  return <main className="mx-auto max-w-5xl space-y-6 pb-14 text-slate-100">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <Link href="/compras/otb" className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-200 hover:text-white"><ArrowLeft size={16} /> Voltar ao OTB</Link>
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-xs font-bold text-emerald-200"><Database size={15} /> Somente Supabase</span>
    </div>

    <section className="erp-surface rounded-[26px] p-7 sm:p-9">
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-cyan-300"><LockKeyhole size={15} /> Planejamento financeiro · Master</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Premissas da Projeção 12M</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">Cadastre a posição de caixa e o colchão autorizado da competência de início. Cada salvamento cria uma nova versão auditável no Supabase; o histórico anterior não é apagado. Este cadastro inicial ainda não constitui uma previsão de caixa nem libera compras.</p>
    </section>

    {!enabled && <div role="alert" className="rounded-xl border border-amber-300/30 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">O cadastro seguro ainda não está disponível neste banco. Nenhum valor foi gravado. O módulo OTB continua bloqueado até a configuração da fonte oficial.</div>}

    <section className="erp-surface rounded-[24px] p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><Wallet size={19} className="text-cyan-300" /> Posição financeira inicial</h2>
          <p className="mt-2 text-xs leading-5 text-slate-400">Informe somente valores conferidos pela equipe financeira. Não converter ausência de dado em zero.</p>
        </div>
        <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1.5 text-[11px] font-bold text-amber-100">Premissas parciais</span>
      </div>

      <form action={action} className="mt-6 grid gap-5 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-slate-200">Competência inicial
          <input className="erp-field mt-2 w-full px-3" name="mes" type="month" defaultValue={month} onChange={(event) => { if (event.target.value) router.push(`/compras/otb/premissas?mes=${event.target.value}`) }} required disabled={!enabled || isPending} />
        </label>
        <div className="hidden sm:block" />
        <label className="block text-xs font-semibold text-slate-200">Saldo inicial do caixa (R$)
          <input className="erp-field mt-2 w-full px-3" name="saldo" type="text" inputMode="decimal" placeholder="Ex.: 250000,00" defaultValue={latest ? String(latest.saldo_inicial_caixa).replace(".", ",") : ""} required disabled={!enabled || isPending} />
        </label>
        <label className="block text-xs font-semibold text-slate-200">Colchão de caixa autorizado (R$)
          <input className="erp-field mt-2 w-full px-3" name="reserva" type="text" inputMode="decimal" placeholder="Ex.: 10000,00" defaultValue={latest ? String(latest.colchao_caixa).replace(".", ",") : ""} required disabled={!enabled || isPending} />
        </label>
        <label className="block text-xs font-semibold text-slate-200 sm:col-span-2">Origem / observação da conferência
          <textarea className="erp-field mt-2 min-h-24 w-full p-3" name="observacao" maxLength={500} placeholder="Descreva a fonte e a data da conciliação" defaultValue={latest?.observacao ?? ""} disabled={!enabled || isPending} />
        </label>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <button type="submit" disabled={!enabled || isPending} className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Save size={17} /> {isPending ? "Salvando no Supabase..." : "Salvar nova versão"}</button>
          {state.status !== "idle" && <p role="status" className={`max-w-xl text-xs leading-5 ${state.status === "success" ? "text-emerald-300" : "text-rose-300"}`}>{state.message}</p>}
        </div>
      </form>
    </section>

    <section className="erp-surface rounded-[24px] p-6 sm:p-8">
      <h2 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck size={19} className="text-cyan-300" /> Histórico de versões · {month}</h2>
      {!versions.length ? <p className="mt-3 text-sm text-slate-400">Nenhuma versão registrada para esta competência.</p> : <div className="mt-5 overflow-x-auto"><table className="erp-table w-full min-w-[650px] text-left text-xs">
        <thead><tr><th className="p-3">ID</th><th className="p-3">Gravado em</th><th className="p-3 text-right">Saldo inicial</th><th className="p-3 text-right">Colchão</th><th className="p-3">Conferência</th></tr></thead>
        <tbody>{versions.map((entry) => <tr key={entry.id}><td className="p-3 font-semibold text-cyan-300">#{entry.id}</td><td className="p-3">{new Date(entry.criado_em).toLocaleString("pt-BR", { timeZone: "America/Campo_Grande" })}</td><td className="p-3 text-right">{Number(entry.saldo_inicial_caixa).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td><td className="p-3 text-right">{Number(entry.colchao_caixa).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td><td className="p-3">{entry.observacao || "Sem observação"}</td></tr>)}</tbody>
      </table></div>}
      <p className="mt-5 text-xs leading-6 text-amber-200">Próxima etapa: completar os cenários de recebimentos, pagamentos, despesas, estoque, DDE e matéria-prima. Somente depois a verba poderá ser calculada e homologada.</p>
    </section>
  </main>
}
