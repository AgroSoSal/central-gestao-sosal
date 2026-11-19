"use client"

import { useActionState, useState } from "react"
import { Calculator, ClipboardCopy, Save } from "lucide-react"
import { calculateOwnProductionCost } from "@/domains/compras/domain/stock-liquidation"
import type { OwnProductionReference237 } from "@/domains/compras/domain/own-production-reference-237"
import { saveOwnProductionDraft, type OwnProductionSaveState } from "@/app/compras/producao-propria/actions"

type Product = {produto_cod:string;descricao:string;grupo_subgrupo:string;marca:string;qtde_estoque:number|string|null;valor_estoque:number|string|null}
type Draft = {produto_cod:string;peso_kg:number|string;industrializacao_rs_t:number|string;frete_rs_t:number|string|null;observacao:string;status:string;atualizado_em:string}
const currency=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"})
const qty=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:2})
function number(input:string):number|null {if(input.trim()==="")return null;const n=Number(input.replace(",","."));return Number.isFinite(n)&&n>=0?n:null}

const idle:OwnProductionSaveState={status:"idle",message:""}
export function OwnProductionCalculator({products,drafts=[],references=[],savingEnabled=true}:{products:Product[];drafts?:Draft[];references?:OwnProductionReference237[];savingEnabled?:boolean}) {
  const initialDraft=drafts.find(x=>x.produto_cod===products[0]?.produto_cod)
  const [saveState,saveAction,isSaving]=useActionState(saveOwnProductionDraft,idle)
  const [productCode,setProductCode]=useState(products[0]?.produto_cod??"")
  const [weight,setWeight]=useState(initialDraft?String(initialDraft.peso_kg):"")
  const [industrial,setIndustrial]=useState(initialDraft?String(initialDraft.industrializacao_rs_t):"")
  const [freight,setFreight]=useState(initialDraft?.frete_rs_t==null?"":String(initialDraft.frete_rs_t))
  const [notes,setNotes]=useState(initialDraft?.observacao??"")
  const [qtyToProduce,setQtyToProduce]=useState("1")
  const [copied,setCopied]=useState(false)
  const product=products.find(p=>p.produto_cod===productCode)??products[0]
  const savedDraft=drafts.find(x=>x.produto_cod===product?.produto_cod)
  const reference=references.find(x=>x.produto_cod===product?.produto_cod)
  const unitIndustrial=calculateOwnProductionCost(number(weight),number(industrial))
  const unitFreight=freight.trim()?calculateOwnProductionCost(number(weight),number(freight)):0
  const extra=unitIndustrial!==null&&unitFreight!==null?unitIndustrial+unitFreight:null
  const quantity=number(qtyToProduce)
  const total=extra!==null&&quantity!==null?extra*quantity:null
  async function copy() {
    if(!product||extra===null||total===null)return
    const lines=["SIMULAÇÃO DE PRODUÇÃO PRÓPRIA — NÃO APROVADA",`SKU: ${product.produto_cod} · ${product.descricao}`,`Peso informado: ${weight} kg/un`, `Industrialização: ${industrial} R$/t`,`Frete: ${freight||"não informado"} R$/t`,`Custo adicional por unidade: ${currency.format(extra)}`,`Quantidade simulada: ${qtyToProduce}`,`Custo adicional total: ${currency.format(total)}`]
    try {await navigator.clipboard.writeText(lines.join("\n"));setCopied(true)}catch{setCopied(false)}
  }
  return <form action={saveAction} className="erp-surface rounded-2xl p-6 sm:p-8">
    <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.14em] text-cyan-300"><Calculator size={18}/> Simulador por SKU</p>
    <h2 className="mt-3 text-xl font-bold text-white">Custo adicional por unidade</h2>
    <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-400">Fórmula da planilha: peso unitário (kg) × custo de industrialização por tonelada ÷ 1.000. O frete, quando informado, usa a mesma conversão. Os parâmetros salvos continuam como rascunho e não alteram estoque, custo SISCOM ou OTB.</p>
    {products.length===0?<p role="status" className="mt-5 text-sm text-amber-200">Nenhum produto próprio encontrado. Limpe a busca e consulte o catálogo.</p>:<>
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-slate-300 md:col-span-2">Produto SO SAL
          <select name="produto_cod" value={product?.produto_cod??""} onChange={e=>{const code=e.target.value;const draft=drafts.find(x=>x.produto_cod===code);setProductCode(code);setWeight(draft?String(draft.peso_kg):"");setIndustrial(draft?String(draft.industrializacao_rs_t):"");setFreight(draft?.frete_rs_t==null?"":String(draft.frete_rs_t));setNotes(draft?.observacao??"");setCopied(false)}} className="erp-field mt-2 w-full px-3">{products.map(p=><option key={p.produto_cod} value={p.produto_cod}>{p.produto_cod} · {p.descricao}</option>)}</select>
        </label>
        <label className="text-xs font-semibold text-slate-300">Peso kg por unidade
          <input name="peso_kg" type="number" min="0.001" step="0.001" value={weight} onChange={e=>setWeight(e.target.value)} placeholder="Informar do cadastro técnico" className="erp-field mt-2 w-full px-3"/>
        </label>
        <label className="text-xs font-semibold text-slate-300">Custo industrialização R$/t
          <input name="industrializacao_rs_t" type="number" min="0" step="0.01" value={industrial} onChange={e=>setIndustrial(e.target.value)} placeholder="Valor negociado" className="erp-field mt-2 w-full px-3"/>
        </label>
        <label className="text-xs font-semibold text-slate-300">Frete R$/t (opcional)
          <input name="frete_rs_t" type="number" min="0" step="0.01" value={freight} onChange={e=>setFreight(e.target.value)} placeholder="Sem frete adicional" className="erp-field mt-2 w-full px-3"/>
        </label>
        <label className="text-xs font-semibold text-slate-300">Unidades a produzir
          <input type="number" min="0" step="1" value={qtyToProduce} onChange={e=>setQtyToProduce(e.target.value)} className="erp-field mt-2 w-full px-3"/>
        </label>
      </div>
      <label className="mt-4 block text-xs font-semibold text-slate-300">Observação técnica (opcional)
        <textarea name="observacao" maxLength={500} value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Fonte do peso, negociação, fornecedor e responsável pela conferência" className="erp-field mt-2 w-full p-3"/>
      </label>
      <p className="mt-3 text-xs text-slate-400">{savedDraft?`Rascunho cadastrado em ${new Date(savedDraft.atualizado_em).toLocaleString("pt-BR")}. Se alterar e salvar, será criada outra versão auditada.`:"Produto sem parâmetros técnicos cadastrados."}</p>
      {reference&&<div role="note" className="mt-4 rounded-xl border border-cyan-400/25 bg-cyan-400/5 p-4 text-xs leading-6 text-cyan-100"><strong>Referência do Alex · Gestão Zacarini 2.3.7:</strong> {qty.format(reference.peso_kg)} kg/unidade · custo adicional conjunto de industrialização e frete: <strong>{currency.format(reference.custo_extra_unidade)}/unidade</strong>. Origem: Produção Própria!{reference.origem_peso}/{reference.origem_custo}. <span className="text-amber-200">Valor histórico de referência, não homologado e não preenchido automaticamente como custo técnico.</span></div>}
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/5 p-5"><p className="text-[11px] uppercase tracking-wider text-slate-400">Industrialização/un</p><p className="mt-3 text-2xl font-bold text-cyan-200">{unitIndustrial===null?"—":currency.format(unitIndustrial)}</p></div>
        <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/5 p-5"><p className="text-[11px] uppercase tracking-wider text-slate-400">Custo extra total/un</p><p className="mt-3 text-2xl font-bold text-white">{extra===null?"—":currency.format(extra)}</p></div>
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-5"><p className="text-[11px] uppercase tracking-wider text-slate-400">Total do lote (adicional)</p><p className="mt-3 text-2xl font-bold text-amber-200">{total===null?"—":currency.format(total)}</p></div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" onClick={copy} disabled={extra===null||total===null} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-xs font-bold text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"><ClipboardCopy size={15}/>{copied?"Simulação copiada":"Copiar simulação"}</button><button type="submit" disabled={!savingEnabled||isSaving||extra===null} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Save size={15}/>{isSaving?"Salvando...":"Salvar rascunho técnico"}</button><span className="text-xs leading-5 text-slate-500">Não inclui custo de matéria-prima, tributos, margem ou preço final. Dados de entrada exigem conferência.</span></div>
      {saveState.status!=="idle"&&<p role={saveState.status==="error"?"alert":"status"} className={`mt-3 rounded-xl border px-4 py-3 text-xs ${saveState.status==="error"?"border-red-400/30 text-red-200":"border-emerald-400/30 text-emerald-200"}`}>{saveState.message}</p>}
      <div className="mt-6 rounded-xl border border-slate-700/60 bg-[#0d1726] p-4 text-xs leading-6 text-slate-400"><p className="font-semibold text-white">Estoque real do SKU selecionado</p><p>{product?.descricao} · Qtde: {product?.qtde_estoque==null?"Não cadastrada":qty.format(Number(product.qtde_estoque))} · Valor a custo: {product?.valor_estoque==null?"Não cadastrado":currency.format(Number(product.valor_estoque))}</p><p>Esse custo contábil de estoque não é usado como custo de fabricação, para não duplicar matéria-prima.</p></div>
    </>}
  </form>
}
