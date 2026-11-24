"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { budgetForExpense238,budgetGroupForArea238,type ExpenseBudgetSnapshot238 } from "@/domains/compras/domain/expense-budget-238"
import Link from "next/link"
import { ClipboardCopy, ReceiptText, Save } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { formatSupplierOrder } from "@/domains/compras/domain/purchase-order-messages"

export type ExpenseCatalogEntry = {
  codigo: string; descricao: string; tipo: "MAT"|"SERV"
  grupo: "5.DESPESAS"|"6.INVESTIMENTO"; area: string; conta: string
}
type ExpenseLine = { codigo: string; quantidade: string; valorUnitario: string }
export type ExpenseDraft238 = {
  id: number; filial: string; total: number | string; itens_count: number
  observacao: string | null; criado_em: string
}
type Props = { branch: string; catalog: ExpenseCatalogEntry[]; unavailable?: boolean
  drafts?: readonly ExpenseDraft238[]; draftsUnavailable?: boolean; budget?:ExpenseBudgetSnapshot238|null; budgetUnavailable?:boolean }
const currency = new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"})
const empty:ExpenseLine = {codigo:"",quantidade:"",valorUnitario:""}
const ref = (i:number):ExpenseLine=>({...empty,codigo:"",quantidade:"",valorUnitario:""})

export function AtendimentoDespesas({branch,catalog,unavailable=false,drafts=[],draftsUnavailable=false,budget=null,budgetUnavailable=false}:Props){
  const router=useRouter()
  const [rows,setRows]=useState<ExpenseLine[]>(Array.from({length:8},(_,i)=>ref(i)))
  const [notes,setNotes]=useState("")
  const [supplier,setSupplier]=useState("")
  const [saving,setSaving]=useState(false)
  const [status,setStatus]=useState("")
  const [active,setActive]=useState(false)
  const entries=useMemo(()=>rows.map(row=>{
    const item=catalog.find(c=>c.codigo===row.codigo)
    const qty=Number(row.quantidade),price=Number(row.valorUnitario)
    const filled=Boolean(row.codigo||row.quantidade||row.valorUnitario)
    const valid=item!==undefined&&row.quantidade.trim()!==""&&row.valorUnitario.trim()!==""&&
      Number.isFinite(qty)&&qty>0&&Number.isFinite(price)&&price>=0&&qty<=100000000&&price<=100000000
    return {row,item,qty,price,filled,valid,value:valid?Math.round(qty*price*100)/100:0}
  }),[rows,catalog])
  const selected=entries.filter(e=>e.filled)
  const hasErrors=selected.some(e=>!e.valid)
  const valid=selected.filter(e=>e.valid)
  const amount=valid.reduce((a,e)=>a+e.value,0)
  function setRow(index:number,field:keyof ExpenseLine,value:string){
    setRows(cur=>cur.map((e,i)=>i===index?{...e,[field]:value}:e))
    setStatus("")
  }
  const draftMessage=valid.length&& !hasErrors? formatSupplierOrder({
    kind:"Despesa",brand:"",supplier:supplier||"Fornecedor a confirmar",
    branch,deliveryDate:"",terms:"A negociar",installmentCount:1,freight:"A combinar",
    buyer:"Compras Só Sal",baseDate:new Date().toISOString().slice(0,10),
    authorized:false,items:valid.map(e=>({code:e.item!.codigo,description:e.item!.descricao,
      quantity:e.qty,unitPrice:e.price,discountPercent:0}))
  }):null
  async function save(){
    if(unavailable||saving||!valid.length||hasErrors||amount<=0)return
    const client=createSupabaseBrowserClient()
    if(!client){setStatus("Conexão indisponível. Nenhum registro criado.");return}
    setSaving(true);setStatus("")
    try{
      const {data,error}=await client.rpc("fn_compras_salvar_despesa_rascunho_237",{
        p_filial:branch,
        p_itens:valid.map(e=>({codigo:e.item!.codigo,quantidade:e.qty,valor_unitario:e.price})),
        p_observacao:[supplier.trim(),notes.trim()].filter(Boolean).join(" · ")||null
      })
      if(error){setStatus(error.code==="42501"?"Master ativo obrigatório.":"Falha na validação do cadastro ou das quantidades. Nenhum pedido emitido.");return}
      setStatus("Rascunho de despesa/investimento #"+String(data)+" gravado no Supabase. Nenhuma emissão realizada.")
      router.refresh()
    }catch{setStatus("Falha de conexão; consulte os rascunhos antes de tentar novamente.")}
    finally{setSaving(false)}
  }
  return <section className="erp-surface rounded-2xl border border-amber-300/15 p-5 sm:p-7" aria-label="Despesas e investimentos">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-amber-300">Bloco ⑨ · Atendimento Fornecedor</p>
        <h2 className="mt-2 flex items-center gap-2 text-xl font-bold text-slate-100"><ReceiptText size={20}/> Despesas, serviços e investimentos</h2>
        <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-400">Cad_Despesas!A5:H46 e Atendimento!A48:I58: cadastro complementar de 42 códigos, até oito linhas, valor = quantidade × custo unitário. Grupos 5 e 6 ficam fora da verba de mercadorias da OTB.</p>
      </div>
      <Link href="/compras/atendimento/orcamento" className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-xs font-bold text-cyan-200">Orçamento Replanejado</Link>
      <button type="button" onClick={()=>setActive(v=>!v)} className="rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-xs font-bold text-amber-100">{active?"Recolher bloco":"Abrir bloco ⑨"}</button>
    </div>
    {active&&<>
      {unavailable&&<p role="alert" className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-xs text-amber-200">Catálogo indisponível: simulação e gravação bloqueadas.</p>}
      {budgetUnavailable&&<p role="alert" className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-xs text-amber-200">Orçamento Replanejado indisponível no Supabase. Nenhum teto financeiro foi inferido.</p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-300">Fornecedor
          <input value={supplier} maxLength={100} onChange={e=>setSupplier(e.target.value)} className="erp-field mt-2 w-full px-3" placeholder="Identificação para a negociação"/>
        </label>
        <label className="text-xs font-semibold text-slate-300">Observações
          <input value={notes} maxLength={390} onChange={e=>setNotes(e.target.value)} className="erp-field mt-2 w-full px-3" placeholder="Entrega, condição, justificativa..."/>
        </label>
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="min-w-[900px] w-full text-left text-xs"><thead className="bg-[#102036] text-slate-400"><tr>
          <th className="p-3">Nº</th><th className="p-3">Produto / Serviço / Investimento</th><th className="p-3">Grupo / Área</th>
          <th className="p-3">Qtde</th><th className="p-3">Custo unitário</th><th className="p-3 text-right">Total</th>
        </tr></thead><tbody className="divide-y divide-white/10">
          {entries.map((e,index)=><tr key={index} className={e.filled&&!e.valid?"bg-rose-500/10":""}>
            <td className="p-3 text-slate-500">{index+1}</td>
            <td className="p-3"><select aria-label={"Produto despesa "+(index+1)} value={e.row.codigo} onChange={v=>setRow(index,"codigo",v.target.value)} disabled={unavailable} className="erp-field w-[320px] px-2 py-2">
              <option value="">Escolher item</option>
              {catalog.map(c=><option key={c.codigo} value={c.codigo}>{c.codigo} · {c.descricao}</option>)}
            </select></td>
            <td className="p-3 text-[11px] leading-5 text-slate-400">{e.item?<>{e.item.grupo}<span className="block text-slate-500">{e.item.area} / {e.item.conta}</span>
              <span className="mt-1 block font-semibold text-cyan-200">Orc_Dados · {budgetGroupForArea238(e.item.area)??"Não mapeado"}: {budgetForExpense238(budget,e.item.area)===null?"Fonte pendente":currency.format(budgetForExpense238(budget,e.item.area)!)}</span></>:"—"}</td>
            <td className="p-3"><input aria-label={"Quantidade despesa "+(index+1)} type="number" min="0" step="0.01" value={e.row.quantidade} onChange={v=>setRow(index,"quantidade",v.target.value)} className="erp-field w-24 px-2 py-2"/></td>
            <td className="p-3"><input aria-label={"Custo despesa "+(index+1)} type="number" min="0" step="0.01" value={e.row.valorUnitario} onChange={v=>setRow(index,"valorUnitario",v.target.value)} className="erp-field w-32 px-2 py-2"/></td>
            <td className="p-3 text-right font-semibold text-slate-100">{e.valid?currency.format(e.value):"—"}</td>
          </tr>)}
        </tbody></table>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
        <div><p className="text-xs text-slate-400">Total de despesa/investimento</p><p className="mt-1 text-2xl font-bold text-amber-200">{currency.format(amount)}</p></div>
        <button type="button" disabled={unavailable||saving||hasErrors||!valid.length||amount<=0} onClick={save}
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-5 py-3 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"><Save size={15}/>{saving?"Gravando...":"Salvar rascunho no Supabase"}</button>
      </div>
      {hasErrors&&<p className="mt-3 text-xs text-rose-200">Há linhas com código, quantidade ou custo incompletos.</p>}
      {status&&<p role="status" className="mt-3 text-xs text-cyan-200">{status}</p>}
      <p className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/5 p-4 text-xs leading-6 text-amber-100">Verba de despesas e investimentos de Orc_Dados/Projeção 12M indisponível como fonte homologada. O rascunho não reserva orçamento, não aprova compras e não gera títulos nem pedidos no SISCOM.</p>
      {draftMessage&&<div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={()=>navigator.clipboard.writeText(draftMessage.whatsapp).then(()=>setStatus("Mensagem copiada (rascunho).")).catch(()=>setStatus("Não foi possível copiar."))} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-xs text-slate-100"><ClipboardCopy size={14}/> Copiar mensagem de negociação</button>
        <button type="button" onClick={()=>navigator.clipboard.writeText(draftMessage.email).then(()=>setStatus("E-mail copiado (rascunho).")).catch(()=>setStatus("Não foi possível copiar."))} className="rounded-xl border border-white/15 px-4 py-2 text-xs text-slate-100">Copiar e-mail</button>
      </div>}
    </>}
    <div className="mt-5 border-t border-slate-700/60 pt-5">
      <h3 className="text-sm font-bold text-white">Despesas e investimentos salvos</h3>
      <p className="mt-1 text-xs leading-5 text-slate-400">Consulte os itens e valores dos rascunhos anteriores. Nenhum registro é pedido autorizado nem título financeiro.</p>
      {draftsUnavailable&&<p role="alert" className="mt-3 text-xs text-amber-200">Histórico de despesas indisponível no momento. Nenhum dado foi presumido.</p>}
      {!draftsUnavailable&&drafts.length===0&&<p className="mt-3 text-xs text-slate-500">Nenhum rascunho de despesa registrado nesta carteira.</p>}
      {!draftsUnavailable&&drafts.length>0&&<div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{drafts.map(d=><article key={d.id} className="rounded-xl border border-amber-300/15 bg-[#0b1b2e] p-4">
        <p className="font-semibold text-cyan-200">#{d.id} · {d.filial}</p>
        <p className="mt-2 text-sm font-bold tabular-nums text-white">{currency.format(Number(d.total))} · {d.itens_count} linha(s)</p>
        <p className="mt-1 text-[11px] text-slate-400">{new Date(d.criado_em).toLocaleString("pt-BR",{timeZone:"America/Campo_Grande"})}</p>
        <Link href={`/compras/atendimento/despesa/${d.id}`} className="mt-3 inline-block text-xs font-bold text-cyan-200 underline">Conferir despesa salva</Link>
      </article>)}</div>}
    </div>
  </section>
}