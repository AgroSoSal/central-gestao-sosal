"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Save, ShieldAlert } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

export type LiquidationAction238 = {
 id:number;filial:string;produto_codigo:string
 tipo_acao:"transferencia"|"liquidacao"|"revisao"
 filial_destino:string|null
 meta_quantidade:number|string
 responsavel:string
 data_limite:string
 situacao:"Planejada"|"Em andamento"|"Concluída informada"|"Cancelada"
 observacao:string|null
 atualizado_em:string
}
const branches=["BDS","CG","RIO","CX","PG","AN"]
const types=[{id:"transferencia",label:"Planejar transferência"},{id:"liquidacao",label:"Planejar liquidação"},{id:"revisao",label:"Revisar necessidade"}]
const statuses=["Planejada","Em andamento","Concluída informada","Cancelada"]
const number=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:3})

export function LiquidationActionManager238({selectedSku="",selectedBranch="",rows}:{
 selectedSku?:string;selectedBranch?:string;rows:LiquidationAction238[]
}){
 const router=useRouter()
 const [sku,setSku]=useState(selectedSku)
 const [branch,setBranch]=useState(branches.includes(selectedBranch)?selectedBranch:"BDS")
 const [type,setType]=useState("transferencia")
 const [destination,setDestination]=useState("CG")
 const [quantity,setQuantity]=useState("")
 const [person,setPerson]=useState("")
 const [deadline,setDeadline]=useState("")
 const [status,setStatus]=useState("Planejada")
 const [notes,setNotes]=useState("")
 const [saving,setSaving]=useState(false)
 const [message,setMessage]=useState("")
 const qty=Number(quantity)
 const valid=sku.trim().length>0&&sku.trim().length<=150&&
   person.trim().length>0&&person.trim().length<=120&&
   quantity.trim()!==""&&Number.isFinite(qty)&&qty>0&&qty<=1000000000&&
   Math.abs(Math.round(qty*1000)-qty*1000)<0.000001&&
   /^20\d\d-(0[1-9]|1[0-2])-[0-3]\d$/.test(deadline)&&
   (type!=="transferencia"||(destination!==branch&&branches.includes(destination)))&&
   (type!=="transferencia"||destination!=="") && notes.length<=500

 async function save(){
  if(!valid||saving)return
  const client=createSupabaseBrowserClient()
  if(!client){setMessage("Supabase indisponível. Nada foi gravado.");return}
  setSaving(true);setMessage("")
  try{
   const {data,error}=await client.rpc("fn_compras_liquidacao_acao_salvar_238",{
    p_filial:branch,p_produto_codigo:sku.trim(),
    p_tipo_acao:type,p_filial_destino:type==="transferencia"?destination:null,
    p_meta_quantidade:qty,p_responsavel:person.trim(),
    p_data_limite:deadline,p_situacao:status,
    p_observacao:notes.trim()||null,
   })
   if(error){setMessage(error.code==="42501"?"Somente Master ativo pode registrar planos.":
      error.code==="22023"?"Revise SKU cadastrado no SISCOM, filial, metas e destino.":
      "Não foi possível gravar a ação. Confira o histórico antes de repetir.");return}
   setMessage("Ação #"+String(data)+" salva como planejamento. Nenhuma transferência SISCOM foi executada.")
   router.refresh()
  }catch{setMessage("Falha de rede. Confira o histórico antes de repetir a gravação.")}
  finally{setSaving(false)}
 }
 return <div className="space-y-6">
  <section className="erp-surface rounded-2xl border border-cyan-300/20 p-5 sm:p-7">
   <h2 className="text-lg font-bold text-white">Planejar ação por filial e SKU</h2>
   <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-300">Preencha apenas dados conhecidos. Uma nova gravação para a mesma filial e SKU atualiza o plano e cria evento auditável. Ações informadas como concluídas não confirmam baixa, transferência ou entrega fiscal.</p>
   <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <label className="text-xs font-semibold text-slate-300">Produto SISCOM (SKU)
      <input aria-label="SKU da ação" value={sku} onChange={e=>setSku(e.target.value)} maxLength={150} className="erp-field mt-2 w-full px-3"/>
    </label>
    <label className="text-xs font-semibold text-slate-300">Filial de origem
      <select aria-label="Filial de origem" value={branch} onChange={e=>setBranch(e.target.value)} className="erp-field mt-2 w-full px-3">{branches.map(b=><option key={b}>{b}</option>)}</select>
    </label>
    <label className="text-xs font-semibold text-slate-300">Tipo de ação
      <select aria-label="Tipo da ação" value={type} onChange={e=>setType(e.target.value)} className="erp-field mt-2 w-full px-3">{types.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select>
    </label>
    {type==="transferencia"&&<label className="text-xs font-semibold text-slate-300">Filial de destino
      <select aria-label="Filial de destino" value={destination} onChange={e=>setDestination(e.target.value)} className="erp-field mt-2 w-full px-3">{branches.map(b=><option key={b}>{b}</option>)}</select>
    </label>}
    <label className="text-xs font-semibold text-slate-300">Quantidade-meta
      <input aria-label="Quantidade-meta" type="number" step="0.001" min="0.001" value={quantity} onChange={e=>setQuantity(e.target.value)} className="erp-field mt-2 w-full px-3"/>
    </label>
    <label className="text-xs font-semibold text-slate-300">Responsável
      <input aria-label="Responsável" maxLength={120} value={person} onChange={e=>setPerson(e.target.value)} className="erp-field mt-2 w-full px-3" placeholder="Nome do responsável"/>
    </label>
    <label className="text-xs font-semibold text-slate-300">Prazo previsto
      <input aria-label="Data limite" type="date" value={deadline} onChange={e=>setDeadline(e.target.value)} className="erp-field mt-2 w-full px-3"/>
    </label>
    <label className="text-xs font-semibold text-slate-300">Situação informada
      <select aria-label="Situação da ação" value={status} onChange={e=>setStatus(e.target.value)} className="erp-field mt-2 w-full px-3">{statuses.map(s=><option key={s}>{s}</option>)}</select>
    </label>
    <label className="text-xs font-semibold text-slate-300 sm:col-span-2">Observações
      <input aria-label="Observações da ação" value={notes} onChange={e=>setNotes(e.target.value)} maxLength={500} className="erp-field mt-2 w-full px-3"/>
    </label>
   </div>
   <div className="mt-5 flex flex-wrap items-center gap-3">
    <button type="button" disabled={!valid||saving} onClick={()=>void save()}
      className="inline-flex h-11 items-center gap-2 rounded-xl bg-cyan-500 px-5 text-xs font-bold text-slate-950 disabled:opacity-40"><Save size={16}/>{saving?"Salvando...":"Salvar planejamento"}</button>
    {message&&<p role="status" className="text-xs text-cyan-200">{message}</p>}
   </div>
  </section>
  <div className="rounded-xl border border-amber-300/25 bg-amber-400/5 p-4 text-xs leading-6 text-amber-100">
   <ShieldAlert size={17} className="mb-2"/> Este é um planejamento interno. Não movimenta o SISCOM, não emite NF, não registra recebimento e não altera qualquer indicador de estoque ou caixa.
  </div>
  <section className="erp-surface overflow-hidden rounded-2xl border border-slate-700/60">
   <header className="border-b border-slate-700/70 p-5">
    <h2 className="font-bold text-white">Ações registradas</h2>
    <p className="mt-2 text-xs text-slate-400">{rows.length} plano(s) nesta página, com histórico auditável de alterações.</p>
   </header>
   <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-xs">
    <thead className="bg-[#13253d] text-slate-300"><tr>
     <th className="p-3">Origem / SKU</th><th className="p-3">Ação / destino</th><th className="p-3 text-right">Meta</th>
     <th className="p-3">Responsável</th><th className="p-3">Prazo</th><th className="p-3">Situação informada</th>
    </tr></thead>
    <tbody className="divide-y divide-slate-800">{rows.map(row=><tr key={row.id}>
     <td className="p-3 font-bold text-cyan-200">{row.filial} · {row.produto_codigo}</td>
     <td className="p-3 text-slate-300">{row.tipo_acao}{row.filial_destino?" → "+row.filial_destino:""}</td>
     <td className="p-3 text-right tabular-nums">{number.format(Number(row.meta_quantidade))}</td>
     <td className="p-3 text-slate-300">{row.responsavel}</td>
     <td className="p-3 text-slate-300">{row.data_limite}</td>
     <td className="p-3 text-amber-200">{row.situacao}</td>
    </tr>)}</tbody>
   </table></div>
   {rows.length===0&&<p className="p-6 text-xs text-slate-400">Ainda não há planos para este filtro. Nenhuma ação foi presumida.</p>}
  </section>
 </div>
}
