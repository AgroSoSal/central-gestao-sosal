"use client"

import { useState } from "react"
import { compareSupplierQuotes } from "@/domains/compras/domain/supplier-quote-comparison"

export type ComparableSupplierItem={code:string;description:string;quantity:number;unitCost:number|null;discountPercent:number|null}
type Props={items:ComparableSupplierItem[];baseSupplier:string;singleSupplier:boolean}
const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"})

export function SupplierQuoteComparison({items,baseSupplier,singleSupplier}:Props){
  const [alternativeSupplier,setAlternativeSupplier]=useState("")
  const [alternativeCosts,setAlternativeCosts]=useState<Record<string,string>>({})
  const [alternativeDiscount,setAlternativeDiscount]=useState("0")
  const [alternativeTerms,setAlternativeTerms]=useState("")
  const discount=alternativeDiscount.trim()?Number(alternativeDiscount):null
  const quote=singleSupplier&&alternativeSupplier.trim()?compareSupplierQuotes(
    items.map(x=>({code:x.code,quantity:x.quantity,unitCost:x.unitCost,discountPercent:x.discountPercent})),
    items.map(x=>({code:x.code,quantity:x.quantity,
      unitCost:alternativeCosts[x.code]?.trim()?Number(alternativeCosts[x.code]):null,
      discountPercent:discount})),
  ):null

  return <section className="erp-surface rounded-2xl p-5 sm:p-6" aria-label="Comparativo de cotações">
    <h2 className="text-lg font-bold text-white">Comparar cotações</h2>
    <p className="mt-2 max-w-4xl text-xs leading-6 text-slate-400">Compare a negociação de {baseSupplier} com uma segunda oferta para os mesmos produtos e quantidades. Este comparativo é auxiliar, não é uma fórmula de classificação de fornecedores da Zacarini, não salva os valores no banco e não autoriza pedidos.</p>
    {!singleSupplier?<p role="alert" className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-xs text-amber-100">Para comparar, selecione produtos de um único fornecedor por vez ou confirme o fornecedor principal no Atendimento.</p>:<>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs text-slate-200">Fornecedor concorrente
          <input value={alternativeSupplier} onChange={e=>setAlternativeSupplier(e.target.value)} maxLength={150} placeholder="Nome da segunda proposta" className="erp-field mt-2 w-full px-3"/>
        </label>
        <label className="text-xs text-slate-200">Desconto concorrente (%)
          <input type="number" min="0" max="100" step="0.01" value={alternativeDiscount} onChange={e=>setAlternativeDiscount(e.target.value)} className="erp-field mt-2 w-full px-3"/>
        </label>
        <label className="text-xs text-slate-200">Condição de pagamento concorrente (informativa)
          <input value={alternativeTerms} onChange={e=>setAlternativeTerms(e.target.value)} maxLength={100} placeholder="Ex.: 30/60 dias" className="erp-field mt-2 w-full px-3"/>
        </label>
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-[670px] w-full text-left text-xs">
          <thead className="bg-[#102036] text-[10px] uppercase text-slate-400"><tr>
            {["SKU / descrição","Quantidade igual","Custo unitário base","Custo unitário concorrente"].map(label=><th key={label} className="p-3">{label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-white/10">{items.map(item=><tr key={item.code}>
            <td className="p-3"><span className="font-bold text-cyan-200">{item.code}</span><span className="ml-2 text-slate-300">{item.description}</span></td>
            <td className="p-3 tabular-nums">{item.quantity}</td>
            <td className="p-3 tabular-nums">{item.unitCost===null?"Indisponível":money.format(item.unitCost)}</td>
            <td className="p-3"><input aria-label={"Custo concorrente "+item.code} type="number" min="0" step="0.01" value={alternativeCosts[item.code]??""} onChange={e=>setAlternativeCosts(old=>({...old,[item.code]:e.target.value}))} placeholder="Informar custo" className="erp-field w-44 px-3 py-1.5"/></td>
          </tr>)}</tbody>
        </table>
      </div>
      {quote?.state==="calculado"?<div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 p-4"><p className="text-[11px] text-slate-400">Produtos · negociação base</p><p className="mt-1 text-xl font-bold text-white">{money.format(quote.baseSubtotal)}</p></div>
        <div className="rounded-xl border border-white/10 p-4"><p className="text-[11px] text-slate-400">Produtos · proposta concorrente</p><p className="mt-1 text-xl font-bold text-white">{money.format(quote.alternativeSubtotal)}</p></div>
        <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/[.06] p-4"><p className="text-[11px] text-slate-400">Diferença concorrente − base</p><p className="mt-1 text-xl font-bold text-cyan-200">{money.format(quote.difference)}</p></div>
      </div>:<p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[.07] p-4 text-xs text-amber-100">Sem comparação completa: informe o fornecedor concorrente e todos os custos unitários; descontos devem ser válidos. Nenhum custo ausente será tratado como zero.</p>}
      <p className="mt-3 text-[11px] leading-5 text-amber-100/90">Valores apenas dos produtos, com desconto, arredondados por SKU. Diferença negativa significa menor custo dos produtos na oferta concorrente, não melhor proposta total: frete, impostos, prazos, limites de caixa e aprovação financeira não estão comparados. Não salva cotação nem emite pedido.</p>
    </>}
  </section>
}
