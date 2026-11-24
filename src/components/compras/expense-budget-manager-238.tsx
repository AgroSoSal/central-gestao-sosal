"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ClipboardList, Save, ShieldAlert } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import {
  EXPENSE_BUDGET_GROUPS_238,type ExpenseBudgetGroup238,
  type ExpenseBudgetSnapshot238,
} from "@/domains/compras/domain/expense-budget-238"

const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"})

export function ExpenseBudgetManager238({snapshot,month}:{
  snapshot:ExpenseBudgetSnapshot238;month:string
}){
  const router=useRouter()
  const [group,setGroup]=useState<ExpenseBudgetGroup238>("Logística")
  const [item,setItem]=useState("")
  const [amount,setAmount]=useState("")
  const [saving,setSaving]=useState(false)
  const [message,setMessage]=useState("")
  const value=Number(amount)
  const valid=item.trim().length>0&&item.trim().length<=150&&
    amount.trim()!==""&&Number.isFinite(value)&&Math.abs(value)<=100000000000&&
    Math.abs(Math.round(value*100)-value*100)<0.000001

  async function save(){
    if(saving||!valid)return
    const client=createSupabaseBrowserClient()
    if(!client){setMessage("Conexão com Supabase indisponível. Nada foi salvo.");return}
    setSaving(true);setMessage("")
    try{
      const {data,error}=await client.rpc("fn_compras_orcamento_replanejado_salvar_238",{
        p_competencia:month,p_grupo:group,p_item:item.trim(),p_valor:value,
      })
      if(error){
        setMessage(error.code==="42501"?"Acesso restrito ao Master ativo.":
          error.code==="22023"?"Revise competência, grupo, item e valor.":
          "Falha ao gravar a referência mensal. Nenhum orçamento foi aprovado.")
        return
      }
      setMessage("Item de orçamento #"+String(data)+" registrado. Status: referência manual não homologada.")
      setItem("");setAmount("")
      router.refresh()
    }catch{setMessage("Falha de conexão. Confira o histórico antes de repetir a gravação.")}
    finally{setSaving(false)}
  }

  return <div className="space-y-5">
    <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-xs leading-6 text-amber-100">
      <div className="flex items-start gap-2"><ShieldAlert size={17} className="mt-0.5 shrink-0"/>
        <p>A planilha usa <strong>ABS(SOMA dos itens de Orc_Dados com Tipo = Replanejado, Ano, Mês e Grupo)</strong>.
        Estes valores são entradas preparatórias no Supabase e não representam orçamento oficial aprovado. Campos ausentes permanecem indisponíveis.</p>
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {snapshot.grupos.map(row=><article key={row.grupo} className="rounded-xl border border-slate-700/70 bg-[#0c1c2f] p-4">
        <p className="text-xs font-semibold text-cyan-200">{row.grupo}</p>
        <p className="mt-2 text-lg font-bold tabular-nums text-white">{row.orcamento===null?"Não cadastrado":money.format(Number(row.orcamento))}</p>
        <p className="mt-1 text-[11px] text-slate-500">{row.qtd_itens} item(ns) · sem homologação</p>
      </article>)}
    </div>

    <section className="rounded-xl border border-cyan-400/20 bg-cyan-400/[.045] p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold text-white"><ClipboardList size={17} className="text-cyan-200"/> Cadastrar ou atualizar item do Replanejado</h2>
      <p className="mt-2 text-xs leading-6 text-slate-300">Use os grupos de orçamento da coluna H de Cad_Despesas. Para editar um item, informe a mesma competência, grupo e nome de item. Cada alteração mantém trilha de auditoria.</p>
      <div className="mt-5 grid items-end gap-3 md:grid-cols-[190px_minmax(180px,1fr)_180px_auto]">
        <label className="text-xs font-semibold text-slate-300">Grupo do orçamento
          <select aria-label="Grupo orçamentário" className="erp-field mt-2 w-full px-3" value={group} onChange={e=>setGroup(e.target.value as ExpenseBudgetGroup238)}>
            {EXPENSE_BUDGET_GROUPS_238.map(g=><option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-300">Item (Orc_Dados!Item)
          <input aria-label="Item orçamentário" type="text" maxLength={150} value={item} onChange={e=>setItem(e.target.value)}
            className="erp-field mt-2 w-full px-3" placeholder="Ex.: COMBUSTÍVEL / FRETE"/>
        </label>
        <label className="text-xs font-semibold text-slate-300">Valor mensal R$ (com sinal)
          <input aria-label="Valor orçamentário" type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}
            className="erp-field mt-2 w-full px-3" placeholder="Ex.: -1000,00"/>
        </label>
        <button type="button" disabled={!valid||saving} onClick={()=>void save()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-cyan-500 px-5 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
          <Save size={15}/>{saving?"Gravando...":"Salvar item"}
        </button>
      </div>
      {message&&<p role="status" className="mt-3 text-xs text-cyan-100">{message}</p>}
    </section>

    <section className="overflow-hidden rounded-xl border border-slate-700/70">
      <header className="border-b border-slate-700/70 p-4"><h2 className="text-sm font-bold text-white">Itens da competência</h2>
        <p className="mt-1 text-xs text-slate-400">{snapshot.itens.length} linhas registradas, somente leitura do histórico atual.</p></header>
      <div className="overflow-x-auto"><table className="w-full min-w-[660px] text-left text-xs">
        <thead className="bg-[#122139] text-slate-300"><tr><th className="p-3">Grupo</th><th className="p-3">Item</th><th className="p-3 text-right">Valor com sinal</th><th className="p-3">Última atualização</th></tr></thead>
        <tbody className="divide-y divide-slate-800">{snapshot.itens.map(row=><tr key={row.id}>
          <td className="p-3 text-cyan-200">{row.grupo}</td>
          <td className="p-3 text-slate-300">{row.item}</td>
          <td className="p-3 text-right font-semibold tabular-nums">{money.format(Number(row.valor))}</td>
          <td className="p-3 text-slate-400">{new Date(row.atualizado_em).toLocaleString("pt-BR",{timeZone:"America/Campo_Grande"})}</td>
        </tr>)}</tbody>
      </table></div>
      {snapshot.itens.length===0&&<p className="p-6 text-xs text-slate-400">Ainda não existe Replanejado cadastrado para esta competência. Nenhuma verba foi presumida.</p>}
    </section>
  </div>
}
