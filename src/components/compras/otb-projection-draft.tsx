"use client"

import Link from "next/link"
import { useActionState } from "react"
import { CheckCircle2, Database, Save, ShieldAlert } from "lucide-react"
import { saveOtb12mDraft, type Otb12mSaveState } from "@/app/compras/otb/projecao/actions"
import { buildOtb12mDraftRows, type Otb12mDraftHeader } from "@/domains/compras/domain/otb-projection-draft-12m"
import type { CashForecastResult } from "@/domains/compras/domain/zacarini-cash-forecast"

const initialState:Otb12mSaveState={status:"idle",message:"",id:null}
const brDate=(date:string)=>date.split("-").reverse().join("/")

export function OtbProjectionDraft({
  forecast, baseDate, recent, sourceError,
}: {
  forecast:CashForecastResult | undefined
  baseDate:string
  recent:readonly Otb12mDraftHeader[]
  sourceError:boolean
}) {
  const [state, action, pending]=useActionState(saveOtb12mDraft,initialState)
   const rows=forecast?buildOtb12mDraftRows(forecast):null
 
  return <section className="erp-surface rounded-[24px] p-5 sm:p-7" aria-label="Versionamento da Projeção 12M">
    <div className="flex flex-wrap items-start justify-between gap-5">
      <div>
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.17em] text-cyan-300"><Database size={15}/> Histórico no Supabase</p>
        <h2 className="mt-2 text-xl font-bold text-white">Salvar versões auditáveis da Projeção 12M</h2>
        <p className="mt-2 max-w-4xl text-xs leading-6 text-slate-400">
          Registre a fotografia calculada pela simulação de referência, com 12 meses, três cenários e pior caso.
          Cada versão preserva data-base, integridade SHA-256, saldos parciais e situação das premissas no momento do registro.
          A versão é um <strong>rascunho</strong>; não vira teto de compra, aprovação bancária ou premissa homologada.
        </p>
      </div>
      <span className="inline-flex items-center gap-2 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[11px] font-bold text-amber-100"><ShieldAlert size={15}/> Sem liberação automática</span>
    </div>
    {rows?<form action={action} className="mt-5 flex flex-col gap-4 rounded-xl border border-[#2b4057] bg-[#0a1727]/60 p-4">
      <input type="hidden" name="data_base" value={baseDate}/>
      <input type="hidden" name="linhas" value={JSON.stringify(rows)}/>
      <label className="block text-xs font-semibold text-slate-200">
        Observação sobre esta fotografia de referência
        <textarea className="erp-field mt-2 min-h-16 w-full p-3" name="observacao"
          maxLength={500} placeholder="Opcional: data de conferência e pontos ainda não homologados" disabled={pending}/>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-50">
          <Save size={16}/>{pending?"Registrando...":"Guardar rascunho 12M no Supabase"}
        </button>
        <span className="text-xs text-slate-400">12 competências · não altera histórico SISCOM nem gera pedidos</span>
      </div>
      {state.status!=="idle"&&<p role="status" className={`text-xs leading-6 ${state.status==="success"?"text-emerald-200":"text-amber-200"}`}>
        {state.status==="success"&&<CheckCircle2 size={16} className="mr-2 inline"/>}{state.message}{state.id?" · Versão #"+state.id:""}{state.status==="success"&&<span> Atualize a página para listar a nova versão.</span>}
      </p>}
    </form>:
      <p role="status" className="mt-5 rounded-xl border border-amber-400/25 bg-amber-400/5 p-4 text-xs leading-6 text-amber-100">
        A projeção não contém 12 competências completas e válidas. O sistema não grava um rascunho incompleto e não inventa valores.
      </p>}
    <div className="mt-6 border-t border-slate-800 pt-5">
      <h3 className="text-sm font-bold text-slate-100">Versões anteriores para revisão</h3>
      {sourceError?<p className="mt-3 text-xs text-amber-200">A consulta de versões não está disponível. Não foi presumido nenhum histórico.</p>:
        recent.length===0?<p className="mt-3 text-xs text-slate-400">Ainda não há versões financeiras gravadas nesta tabela.</p>:
        <div className="mt-3 overflow-x-auto"><table className="erp-table w-full min-w-[740px] text-left text-xs">
          <thead><tr><th className="p-3">Versão</th><th className="p-3">Data-base</th><th className="p-3">Registrada em</th><th className="p-3">Conciliação no registro</th><th className="p-3">Estado</th><th className="p-3">Detalhes</th></tr></thead>
          <tbody>{recent.map(item=><tr key={item.id}>
            <td className="p-3 font-semibold text-cyan-300">#{item.id}</td>
            <td className="p-3">{brDate(item.data_base)}</td>
            <td className="p-3">{new Date(item.registrado_em).toLocaleString("pt-BR",{timeZone:"America/Campo_Grande"})}</td>
            <td className="p-3">{item.contas_conciliadas}/{item.contas_escopo}</td>
            <td className="p-3 text-amber-200">Rascunho não homologado</td>
            <td className="p-3"><Link href={`/compras/otb/projecao/${item.id}`} className="font-bold text-cyan-300 underline">Auditar versão</Link></td>
          </tr>)}</tbody>
        </table></div>}
    </div>
  </section>
}
