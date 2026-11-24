"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { ClipboardCheck, Loader2 } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

/** Reutiliza as RPCs Master existentes; registra o motivo em auditoria.
 * A classificação NÃO autoriza compras e não altera os relatórios SISCOM.
 */
export function PurchaseSubgroupEditor({loja,pedido,produtoCodigo}:{
 loja:string;pedido:string;produtoCodigo:string
}) {
 const router=useRouter()
 const [groups,setGroups]=useState<string[]>([])
 const [selected,setSelected]=useState("")
 const [previous,setPrevious]=useState("")
 const [reason,setReason]=useState("")
 const [state,setState]=useState<"loading"|"ready"|"error">("loading")
 const [busy,setBusy]=useState(false)
 const [feedback,setFeedback]=useState("")
 useEffect(()=>{
   let active=true
   const client=createSupabaseBrowserClient()
   if(!client){setState("error");return}
   const date=new Intl.DateTimeFormat("sv-SE",{
     timeZone:"America/Campo_Grande",year:"numeric",month:"2-digit",day:"2-digit",
   }).format(new Date())
   Promise.all([
     client.rpc("fn_listar_classificacao_compras",{
       p_chaves:[{loja,pedido,produto_codigo:produtoCodigo}],
     }),
     client.rpc("fn_otb_posicao_subgrupos",{p_data_base:date}),
   ]).then(([classification,groupsResult])=>{
     if(!active)return
     if(classification.error||groupsResult.error||!Array.isArray(groupsResult.data)){
       setState("error");return
     }
     const rows=(groupsResult.data??[]) as {grupo_subgrupo?:string}[]
     const options=[...new Set(rows.map(r=>r.grupo_subgrupo).filter((name):name is string=>
       typeof name==="string"&&/^[1-6]\..{2,197}$/.test(name)))].sort((a,b)=>a.localeCompare(b,"pt-BR"))
     const cls=(classification.data??[]) as {grupo_subgrupo?:string|null}[]
     const saved=cls[0]?.grupo_subgrupo??""
     setGroups(saved&&!options.includes(saved)?[...options,saved]:options)
     setPrevious(saved);setSelected(saved);setState("ready")
   }).catch(()=>{if(active)setState("error")})
   return ()=>{active=false}
 },[loja,pedido,produtoCodigo])
 async function save(event:FormEvent<HTMLFormElement>){
   event.preventDefault()
   if(busy||!selected||reason.trim().length<8||reason.trim().length>500)return
   const client=createSupabaseBrowserClient()
   if(!client){setFeedback("Supabase indisponível.");return}
   setBusy(true);setFeedback("")
   try{
     const {error}=await client.rpc("fn_registrar_classificacao_compra",{
       p_loja:loja,p_pedido:pedido,p_produto_codigo:produtoCodigo,
       p_grupo_subgrupo:selected,p_motivo:reason.trim(),
     })
     if(error){setFeedback(error.code==="42501"?"Somente Master pode classificar.":"A gravação falhou. Confira o cadastro do item e o subgrupo.");return}
     setPrevious(selected);setReason("")
     setFeedback("Subgrupo atualizado e registrado na auditoria. O OTB usará a classificação na próxima leitura.")
     router.refresh()
   }catch{setFeedback("Falha de conexão. Verifique a classificação antes de repetir.")}
   finally{setBusy(false)}
 }
 return <section className="rounded-2xl border border-cyan-300/20 bg-[#081625] p-4 sm:p-5" aria-label="Classificação do item para OTB">
   <h3 className="flex items-center gap-2 text-sm font-bold text-white"><ClipboardCheck size={16} className="text-cyan-300"/> Classificação do subgrupo · OTB</h3>
   <p className="mt-2 text-xs leading-5 text-slate-400">Os pedidos sem subgrupo não entram na distribuição do orçamento. Escolha a classificação oficial de estoque para esse produto; essa ação não aprova o pedido.</p>
   {state==="loading"?<p className="mt-3 text-xs text-slate-300">Conferindo cadastro e categorias...</p>:
    state==="error"?<p role="alert" className="mt-3 text-xs text-amber-200">Não foi possível carregar a classificação. Nenhum dado foi alterado.</p>:
    <form onSubmit={save} className="mt-4 space-y-3">
      <div>
       <label htmlFor="subgroup-otb" className="mb-1 block text-xs text-slate-300">Subgrupo do item</label>
       <select id="subgroup-otb" value={selected} onChange={e=>setSelected(e.target.value)}
         className="w-full rounded-lg border border-slate-600 bg-[#14243a] px-3 py-2 text-sm text-white">
         <option value="">Sem classificação · selecione</option>
         {groups.map(group=><option value={group} key={group}>{group}</option>)}
       </select>
      </div>
      <div>
       <label htmlFor="subgroup-reason" className="mb-1 block text-xs text-slate-300">Motivo da classificação (mínimo 8 caracteres)</label>
       <textarea id="subgroup-reason" rows={2} maxLength={500} value={reason}
         onChange={e=>setReason(e.target.value)} placeholder="Conferido com cadastro do produto"
         className="w-full rounded-lg border border-slate-600 bg-[#14243a] px-3 py-2 text-sm text-white"/>
      </div>
      <button type="submit" disabled={busy||!selected||reason.trim().length<8||selected===previous}
       className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
        {busy?<Loader2 size={14} className="animate-spin"/>:<ClipboardCheck size={14}/>} Salvar subgrupo
      </button>
    </form>}
   {feedback&&<p role="status" className="mt-3 text-xs text-cyan-200">{feedback}</p>}
 </section>
}
