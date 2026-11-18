"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { AlertTriangle, Calculator, CheckCircle2, CircleHelp, PackageSearch } from "lucide-react"
import { negotiatedPurchase, suggestedPurchaseQuantity } from "@/domains/compras/domain/purchase-zacarini-237"
import { forecastPurchasePayments } from "@/domains/compras/domain/purchase-payment-forecast"

export type AttendanceProduct = {
  produto_cod: string; descricao: string | null; marca: string | null; fornecedor: string | null
  grupo_subgrupo: string | null; linha: number | null
  estoque_qtde: number | string | null; pedido_pendente_qtde: number | string | null
  venda_qtde_90d: number | string | null; venda_valor_90d: number | string | null
  cmv_90d: number | string | null; ultimo_custo: number | string | null
  preco_venda_medio: number | string | null
}
export type PurchaseDraft = { id: number; filial: string; total: number | string; itens_count: number; observacao: string | null; criado_em: string }
type Props = { products: AttendanceProduct[]; branch: string; baseDate: string; drafts: PurchaseDraft[] }
const money = new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"})
const qtyFmt = new Intl.NumberFormat("pt-BR",{maximumFractionDigits:1})
const ddeDefaults: Record<number, number> = { 1:45, 2:60, 3:60, 4:50 }
function num(x: number | string | null | undefined): number | null {
  if (x === null || x === undefined || x === "") return null
  const n=Number(x)
  return Number.isFinite(n) ? n : null
}
const safe=(x: number | string | null | undefined)=>num(x)??0

export function AtendimentoFornecedor({products,branch,baseDate,drafts}:Props) {
  const router = useRouter()
  const [saving,setSaving] = useState(false)
  const [notice,setNotice] = useState("")
  const [notes,setNotes] = useState("")
  const [quantities,setQuantities]=useState<Record<string,string>>({})
  const [costs,setCosts]=useState<Record<string,string>>({})
  const [discount,setDiscount]=useState("0")
  const [paymentTerms,setPaymentTerms]=useState("30/60")
  const [deliveryDate,setDeliveryDate]=useState("")
  const pct = Number(discount)
  const validDiscount=Number.isFinite(pct)&&pct>=0&&pct<=100
  const entries = useMemo(()=>products.map(p=>{
    const target=p.linha==null?null:ddeDefaults[p.linha]??null
    const sales=safe(p.venda_qtde_90d)/90
    const stock=safe(p.estoque_qtde), pending=safe(p.pedido_pendente_qtde)
    const suggest=target===null?null:suggestedPurchaseQuantity(Math.max(0,sales),target,Math.max(0,stock),Math.max(0,pending))
    const qty=Number(quantities[p.produto_cod]??"0")
    const cost=num(costs[p.produto_cod]??p.ultimo_custo)
    const validQty=Number.isInteger(qty)&&qty>=0&&qty<=100000000
    const canCalculate=validQty&&cost!==null&&cost>=0&&validDiscount
    const quote=canCalculate?negotiatedPurchase(qty,cost,pct,num(p.preco_venda_medio)):null
    const isMerchandise=!!p.grupo_subgrupo && /^[1-4]\./.test(p.grupo_subgrupo)
    return { p,target,sales,stock,pending,suggest,qty,cost,quote,isMerchandise,validQty }
  }),[products,quantities,costs,pct,validDiscount])
  const chosen=entries.filter(x=>x.qty>0)
  const invalid=chosen.some(x=>!x.quote||!x.isMerchandise)
  const amount=chosen.reduce((sum,x)=>sum+(x.quote?.total??0),0)
  const units=chosen.reduce((sum,x)=>sum+x.qty,0)
  const forecast=chosen.length&&!invalid?forecastPurchasePayments({
    orderDate:baseDate,paymentTerms,pendingQuantity:units,pendingValue:amount,
    decision:"Aprovado",followUpArrival:deliveryDate||null,baseDate,
  }):null
  async function saveDraft() {
    if (saving || invalid || chosen.length === 0) return
    const client=createSupabaseBrowserClient()
    if (!client) { setNotice("Conexão indisponível; nada foi salvo."); return }
    setSaving(true);setNotice("")
    try {
      const itens=chosen.map(({p,qty,cost})=>({
        produto_codigo:p.produto_cod,quantidade:qty,custo_unitario:cost,desconto_percentual:pct,
      }))
      const {data,error}=await client.rpc("fn_compras_salvar_cotacao_rascunho",{
        p_filial:branch,p_itens:itens,p_observacao:notes.trim()||null,
      })
      if (error) {setNotice(error.code==="42501"?"Seu perfil não é Master ativo.":"Não foi possível salvar; confira os valores e tente novamente.");return}
      setNotice("Rascunho #"+String(data)+" salvo no Supabase. Nenhum pedido foi enviado ao SISCOM.")
      router.refresh()
    } catch { setNotice("Falha na conexão. Confirme a lista de rascunhos antes de repetir.") }
    finally {setSaving(false)}
  }
  return <section className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="erp-surface rounded-2xl p-5"><p className="text-xs text-slate-400">Itens encontrados</p><p className="mt-2 text-2xl font-bold text-cyan-200">{products.length}</p><p className="mt-1 text-[11px] text-slate-500">Limite de consulta: 40 produtos</p></div>
      <div className="erp-surface rounded-2xl p-5"><p className="text-xs text-slate-400">Itens selecionados</p><p className="mt-2 text-2xl font-bold text-white">{chosen.length}</p><p className="mt-1 text-[11px] text-slate-500">Quantidade total: {qtyFmt.format(units)}</p></div>
      <div className="erp-surface rounded-2xl p-5"><p className="text-xs text-slate-400">Valor negociado</p><p className="mt-2 text-2xl font-bold text-cyan-200">{money.format(amount)}</p><p className="mt-1 text-[11px] text-slate-500">Não equivale a verba autorizada</p></div>
    </div>
    <div className="erp-surface rounded-2xl p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-300"><Calculator size={16} className="text-cyan-300"/> Premissas da simulação</div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="text-xs text-slate-300">Desconto negociado (%)
          <input type="number" step="0.01" min="0" max="100" value={discount} onChange={e=>setDiscount(e.target.value)} className="erp-field mt-2 w-full px-3"/>
        </label>
        <label className="text-xs text-slate-300">Condição de pagamento
          <input value={paymentTerms} onChange={e=>setPaymentTerms(e.target.value)} maxLength={100} className="erp-field mt-2 w-full px-3" placeholder="Ex.: ent/30/60" />
        </label>
        <label className="text-xs text-slate-300">Chegada prevista (opcional)
          <input type="date" value={deliveryDate} onChange={e=>setDeliveryDate(e.target.value)} className="erp-field mt-2 w-full px-3"/>
        </label>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-slate-400">DDE de referência da Zacarini 2.3.7: Nutrição 45, Saúde 60, Outros 60 e Pastagem 50 dias. São sugestões operacionais, não metas homologadas no Supabase. Os saldos da caixa e da OTB permanecem independentes.</p>
    </div>
    <div className="erp-surface overflow-x-auto rounded-2xl">
      <table className="min-w-[1260px] w-full text-left text-xs">
        <thead className="bg-[#102036] text-[10px] uppercase text-slate-400"><tr>
          {["Produto / marca","Subgrupo","Estoque","Ped. pend.","Venda/dia","DDE alvo","Sugestão","Qtde negociada","Últ. custo","Custo negociado","Valor final","Margem"].map(t=><th key={t} className="p-3">{t}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-white/10">
          {entries.map(({p,target,sales,stock,pending,suggest,qty,cost,quote,isMerchandise})=><tr key={p.produto_cod} className="transition hover:bg-cyan-400/[.04]">
            <td className="max-w-64 p-3"><p className="font-bold text-cyan-200">{p.produto_cod}</p><p className="mt-1 font-semibold text-white">{p.descricao||"Sem descrição"}</p><p className="mt-1 text-[11px] text-slate-500">{p.marca||p.fornecedor||"Marca não informada"}</p></td>
            <td className="max-w-44 p-3"><p className={isMerchandise?"text-slate-200":"text-amber-200"}>{p.grupo_subgrupo||"Sem cadastro"}</p></td>
            <td className="p-3 tabular-nums">{qtyFmt.format(stock)}</td>
            <td className="p-3 tabular-nums">{qtyFmt.format(pending)}</td>
            <td className="p-3 tabular-nums">{qtyFmt.format(sales)}</td>
            <td className="p-3 tabular-nums">{target??"—"}</td>
            <td className="p-3"><span className="font-semibold text-emerald-300">{suggest??"—"}</span>{suggest!==null&&suggest>0&&<button type="button" onClick={()=>setQuantities(old=>({...old,[p.produto_cod]:String(suggest)}))} className="mt-2 block whitespace-nowrap text-[10px] font-bold text-cyan-300 underline">Usar sugestão</button>}</td>
            <td className="p-3"><input aria-label={"Quantidade "+p.produto_cod} type="number" min="0" max="100000000" step="1" value={quantities[p.produto_cod]??"0"} onChange={e=>setQuantities(old=>({...old,[p.produto_cod]:e.target.value}))} className="erp-field w-24 px-2 py-1.5"/></td>
            <td className="p-3 tabular-nums">{num(p.ultimo_custo)===null?"—":money.format(safe(p.ultimo_custo))}</td>
            <td className="p-3"><input aria-label={"Custo negociado "+p.produto_cod} type="number" min="0" step="0.01" placeholder="Informar" value={costs[p.produto_cod]??(p.ultimo_custo??"")} onChange={e=>setCosts(old=>({...old,[p.produto_cod]:e.target.value}))} className="erp-field w-28 px-2 py-1.5"/></td>
            <td className="p-3 font-bold tabular-nums text-cyan-100">{quote&&qty>0?money.format(quote.total):"—"}</td>
            <td className="p-3 tabular-nums">{quote?.margin===null||!quote?"—":new Intl.NumberFormat("pt-BR",{style:"percent",maximumFractionDigits:1}).format(quote.margin)}</td>
          </tr>)}
        </tbody>
      </table>
      {!products.length&&<div className="p-8 text-center text-sm text-slate-400"><PackageSearch className="mx-auto mb-3 text-cyan-400"/> Nenhum produto encontrado nesta busca.</div>}
    </div>
    <div className="erp-surface rounded-2xl p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-white"><CircleHelp className="text-cyan-300"/> Conferência do pedido</h2>
      {!chosen.length?<p className="mt-3 text-sm text-slate-400">Informe quantidades na grade para montar a simulação.</p>:<>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 p-4"><p className="text-[11px] text-slate-400">Quantidade</p><p className="mt-2 text-xl font-bold">{units}</p></div>
          <div className="rounded-xl border border-white/10 p-4"><p className="text-[11px] text-slate-400">Total a custo negociado</p><p className="mt-2 text-xl font-bold">{money.format(amount)}</p></div>
          <div className="rounded-xl border border-white/10 p-4"><p className="text-[11px] text-slate-400">Condição financeira</p><p className="mt-2 text-sm font-bold">{forecast?.status==="projetado"?"Parcelas simuladas":forecast?.status==="isento"?"Sem cobrança":"Conferir condições"}</p></div>
        </div>
        {forecast?.installments.length?<div className="mt-4 flex flex-wrap gap-2">{forecast.installments.map(p=><div key={p.number} className="rounded-lg border border-cyan-300/20 bg-cyan-400/5 p-3 text-xs"><p className="text-slate-400">Parcela {p.number} · {p.dueDate}</p><p className="mt-1 font-bold text-cyan-200">{money.format(p.amount)}</p></div>)}</div>:null}
        {invalid&&<div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-xs text-amber-100"><AlertTriangle size={16}/> Custo inválido ou item sem grupo de mercadorias 1–4. Revise antes de continuar.</div>}
        {forecast?.status==="conferir"&&<div role="alert" className="mt-4 text-xs text-amber-200">{forecast.issue}</div>}
        <div className="mt-5 space-y-3 rounded-xl border border-cyan-300/20 bg-cyan-400/5 p-4">
          <label className="block text-xs font-semibold text-slate-300">Observações da negociação
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={500} rows={2} placeholder="Fornecedor, frete, carga, descontos ou próximos contatos..." className="erp-field mt-2 w-full resize-y px-3 py-2"/>
          </label>
          <button type="button" onClick={saveDraft} disabled={saving||invalid||!validDiscount||chosen.length===0} className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{saving?"Salvando...":"Salvar rascunho no Supabase"}</button>
          {notice&&<p role="status" className="text-xs text-cyan-100">{notice}</p>}
          <p className="text-[11px] text-slate-400">Rascunho auditável de negociação. Não aprova verba, não grava pedido nem atualiza o SISCOM.</p>
        </div>
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-xs leading-6 text-amber-100"><AlertTriangle size={18} className="shrink-0"/> A Zacarini exige caixa disponível em cada vencimento, verba livre da linha e validação da Projeção 12M. Como essa homologação ainda está pendente no Supabase, esta simulação NÃO autoriza gravar pedidos no SISCOM.</div>
      </>}
      {drafts.length>0&&<div className="mt-5 border-t border-white/10 pt-4"><h3 className="text-xs font-bold text-slate-200">Últimos rascunhos salvos</h3><div className="mt-3 flex flex-wrap gap-2">{drafts.map(d=><div key={d.id} className="rounded-lg border border-white/10 bg-[#071625] p-3 text-xs"><p className="font-bold text-cyan-200">#{d.id} · {d.filial}</p><p className="mt-1">{money.format(Number(d.total))} · {d.itens_count} item(ns)</p><p className="mt-1 text-[11px] text-slate-400">{new Date(d.criado_em).toLocaleString("pt-BR",{timeZone:"America/Campo_Grande"})}</p></div>)}</div></div>}
      <p className="mt-4 flex items-center gap-2 text-[11px] text-slate-500"><CheckCircle2 size={14}/> Consulta limitada, somente Master, nenhuma gravação de pedidos ou alterações no SISCOM · {branch}.</p>
    </div>
  </section>
}
