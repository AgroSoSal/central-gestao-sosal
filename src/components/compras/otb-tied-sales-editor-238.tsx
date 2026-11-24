"use client"

import { useMemo, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { FileCheck2, Loader2, PlusCircle } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import type { OtbTiedSales238 } from "@/domains/compras/domain/otb-manual-calendar-238"

const fmt=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"})
const label=(s:string)=>s.slice(5,7)+"/"+s.slice(0,4)
const addMonth=(s:string,i:number)=>{
 const [y,m]=s.split("-").map(Number)
 return new Date(Date.UTC(y,m-1+i,1)).toISOString().slice(0,10)
}

export function OtbTiedSalesEditor238({start,subgroups,sales}:{
 start:string;subgroups:readonly string[];sales:OtbTiedSales238
}){
 const router=useRouter()
 const months=useMemo(()=>[start,addMonth(start,1),addMonth(start,2)], [start])
 const [group,setGroup]=useState(subgroups[0]??"")
 const [month,setMonth]=useState(start)
 const [amount,setAmount]=useState("")
 const [reason,setReason]=useState("")
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState("")
 const canSave=group!==""&&months.includes(month)&&amount.trim()!==""
   &&Number.isFinite(Number(amount))&&Number(amount)>=0&&reason.trim().length>=8&&reason.trim().length<=500
 async function save(event:FormEvent<HTMLFormElement>){
   event.preventDefault()
   if(!canSave||busy)return
   const client=createSupabaseBrowserClient()
   if(!client){setMessage("Supabase indisponível.");return}
   setBusy(true);setMessage("")
   try {
     const {error}=await client.rpc("fn_otb_vendas_casadas_salvar_238",{
       p_subgrupo:group,p_competencia:month,p_valor:Number(amount),p_motivo:reason.trim(),
     })
     if(error){setMessage(error.code==="42501"?"Somente Master ativo pode lançar vendas casadas.":"Não foi possível salvar. Confira o cadastro do subgrupo, o período e o valor.");return}
     setMessage("Venda casada registrada com auditoria. A próxima prévia OTB usará este valor.")
     setReason("");setAmount("")
     router.refresh()
   } catch {setMessage("Erro de conexão. Verifique o lançamento antes de repetir.")}
   finally {setBusy(false)}
 }
 const entries=sales.state==="conectado"?sales.rows:[]
 return <section className="erp-surface overflow-hidden rounded-[24px]" aria-label="Vendas casadas aprovadas da Zacarini 2.3.8">
   <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 p-5 sm:p-7">
    <div>
     <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-cyan-300"><FileCheck2 size={15}/> OTB!U / AD / AM · lançamentos manuais</p>
     <h2 className="mt-2 text-lg font-bold text-white">Vendas casadas aprovadas</h2>
     <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-400">
       Como na Zacarini, o valor é informado por subgrupo e competência. Células sem lançamento valem R$ 0,00.
       O lançamento só pode ser feito pelo Master e fica auditado; ele altera o saldo calculado, mas não emite pedidos.
     </p>
    </div>
    {sales.state==="conectado"&&<div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3">
       <p className="text-[11px] text-slate-400">Lançamentos nas 3 competências</p>
       <p className="mt-1 font-bold tabular-nums text-cyan-200">{fmt.format(sales.total)}</p>
       <p className="mt-1 text-[11px] text-slate-500">{sales.entries} registro(s)</p>
     </div>}
   </div>
   {sales.state==="indisponivel"?<p role="alert" className="p-5 text-xs text-amber-200">{sales.reason} Nenhum valor foi presumido.</p>:
   <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1.1fr]">
    <form onSubmit={save} className="space-y-3 rounded-xl border border-slate-700 bg-[#0c1b2d] p-4">
      <label className="block text-xs font-semibold text-slate-300">Subgrupo
       <select className="mt-2 w-full rounded-lg border border-slate-600 bg-[#13263b] p-3 text-xs text-white" value={group} onChange={e=>setGroup(e.target.value)} required>
        <option value="">Selecione um subgrupo</option>{subgroups.map(s=><option key={s} value={s}>{s}</option>)}
       </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
       <label className="text-xs font-semibold text-slate-300">Competência
        <select className="mt-2 w-full rounded-lg border border-slate-600 bg-[#13263b] p-3 text-xs text-white" value={month} onChange={e=>setMonth(e.target.value)} required>
         {months.map(m=><option key={m} value={m}>{label(m)}</option>)}
        </select>
       </label>
       <label className="text-xs font-semibold text-slate-300">Valor aprovado (R$)
        <input className="mt-2 w-full rounded-lg border border-slate-600 bg-[#13263b] p-3 text-xs text-white"
         type="number" min="0" max="1000000000000" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} required placeholder="0,00"/>
       </label>
      </div>
      <label className="block text-xs font-semibold text-slate-300">Motivo / evidência da venda casada
       <textarea className="mt-2 w-full rounded-lg border border-slate-600 bg-[#13263b] p-3 text-xs text-white"
        value={reason} onChange={e=>setReason(e.target.value)} minLength={8} maxLength={500} rows={2}
        required placeholder="Número da venda e aprovação pelo responsável"/>
      </label>
      <button type="submit" disabled={!canSave||busy||subgroups.length===0}
       className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-xs font-bold text-slate-950 disabled:opacity-40">
       {busy?<Loader2 size={16} className="animate-spin"/>:<PlusCircle size={16}/>} Salvar venda casada
      </button>
      {message&&<p role="status" className="text-xs text-cyan-200">{message}</p>}
    </form>
    <div className="rounded-xl border border-slate-700 bg-[#0c1b2d] p-4">
      <p className="mb-3 text-xs font-bold text-slate-100">Lançamentos vigentes · histórico preservado</p>
      {entries.length===0?<p className="text-xs leading-6 text-slate-400">Nenhuma venda casada registrada. Valor atual: R$ 0,00 nos três meses, assim como na planilha de referência.</p>:
       <div className="max-h-72 space-y-2 overflow-y-auto">{entries.map(row=><div key={row.name+row.month} className="rounded-lg border border-white/10 p-3 text-xs">
         <p className="font-semibold text-cyan-300">{row.name}</p>
         <div className="mt-1 flex flex-wrap justify-between gap-2"><span className="text-slate-400">{label(row.month)}</span><strong>{fmt.format(row.amount)}</strong></div>
         <p className="mt-2 text-slate-500">{row.reason}</p>
       </div>)}</div>}
    </div>
   </div>}
 </section>
}
