import { AlertTriangle, ShieldCheck, ScanSearch } from "lucide-react"
import type { OtbApAudit239 } from "@/domains/compras/domain/otb-ap-reconciliation-239"

const currency=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"})
const number=new Intl.NumberFormat("pt-BR")
export function OtbApReconciliationPanel239({audit}:{audit:OtbApAudit239}){
 return <section className="erp-surface overflow-hidden rounded-[24px]" aria-label="Auditoria de pedidos versus contas a pagar">
   <div className="border-b border-slate-800 p-5 sm:p-7">
    <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-cyan-300"><ScanSearch size={15}/> Auditoria financeira · Supabase</p>
    <h2 className="mt-2 text-lg font-bold text-white">Pedidos x títulos a pagar — sem duplicar o caixa</h2>
    <p className="mt-2 max-w-4xl text-xs leading-6 text-slate-400">
      Cruza a carteira de pedidos com a última importação de fornecedores a pagar.
      Igualdade de fornecedor, valor e data é apenas uma possível correspondência:
      os títulos não contêm vínculo inequívoco com os pedidos.
    </p>
   </div>
   {audit.state==="indisponivel"?<p role="alert" className="p-6 text-xs text-amber-200">{audit.reason} Nenhum valor foi abatido ou considerado homologado.</p>:
   <>
     <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-xl border border-slate-700 p-4"><p className="text-[11px] text-slate-400">Títulos na última carga</p><p className="mt-2 text-xl font-bold tabular-nums">{number.format(audit.apRows)}</p><p className="text-[11px] text-slate-500">Importação #{audit.latestImport}</p></div>
      <div className="rounded-xl border border-slate-700 p-4"><p className="text-[11px] text-slate-400">Fornecedores a pagar · próximos 12 meses</p><p className="mt-2 text-xl font-bold tabular-nums">{currency.format(audit.apValue12m)}</p><p className="text-[11px] text-slate-500">Fonte contratada, não extrapolação</p></div>
      <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-4"><p className="text-[11px] text-slate-400">Correspondências potenciais únicas</p><p className="mt-2 text-xl font-bold text-amber-100 tabular-nums">{number.format(audit.uniqueCandidates)}</p><p className="text-[11px] text-slate-500">{currency.format(audit.uniqueCandidateValue)} sujeitos à conferência</p></div>
      <div className="rounded-xl border border-slate-700 p-4"><p className="text-[11px] text-slate-400">Chaves repetidas na última carga</p><p className="mt-2 text-xl font-bold tabular-nums">{number.format(audit.duplicateApKeys)}</p><p className="text-[11px] text-slate-500">{number.format(audit.duplicateApExtraRows)} linhas adicionais · sem exclusão automática</p></div>
     </div>
     <div className="mx-5 mb-5 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/5 p-4 text-xs leading-6 text-amber-100">
      <AlertTriangle size={16} className="mt-1 shrink-0"/>
      <p>
        <strong>Não somar o calendário estimado aos títulos.</strong> A Projeção 12M já utiliza a última carga de contas a pagar;
        somar os pedidos projetados pode repetir obrigações. Foram localizadas {audit.candidatePairs} combinações,
        mas nenhuma tem confirmação documental de vínculo. Nenhum ajuste foi feito no caixa ou nos pedidos.
      </p>
     </div>
     {audit.samples.length>0&&<div className="overflow-x-auto border-t border-slate-800">
      <div className="flex items-center gap-2 px-5 py-3 text-xs text-slate-400"><ShieldCheck size={15}/> Amostra de possíveis vínculos, não confirmados</div>
      <table className="erp-table w-full min-w-[760px] text-left text-xs">
       <thead><tr><th className="p-3">Filial</th><th className="p-3">Pedido</th><th className="p-3">Fornecedor</th><th className="p-3">Título/parcela</th><th className="p-3 text-right">Valor pendente</th><th className="p-3 text-right">Valor título</th></tr></thead>
       <tbody>{audit.samples.map(s=><tr key={s.loja+"-"+s.pedido+"-"+s.codigo+"-"+s.titulo+"-"+s.parcela}>
        <td className="p-3">{s.loja}</td><td className="p-3">{s.pedido}</td><td className="p-3">{s.codigo}</td>
        <td className="p-3">{s.titulo}/{s.parcela}</td>
        <td className="p-3 text-right tabular-nums">{currency.format(s.pendente)}</td>
        <td className="p-3 text-right tabular-nums">{currency.format(s.valor)}</td>
       </tr>)}</tbody>
      </table>
     </div>}
     <p className="p-5 text-[11px] leading-6 text-slate-400">Última importação de fornecedores a pagar: {new Date(audit.latestImportedAt).toLocaleString("pt-BR",{timeZone:"America/Campo_Grande"})}. Para eliminar a ambiguidade é necessário vincular o título à nota fiscal ou ao número do pedido na origem.</p>
   </>}
 </section>
}
