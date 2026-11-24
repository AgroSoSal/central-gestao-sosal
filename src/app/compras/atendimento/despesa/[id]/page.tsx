// Rota dinâmica Master: não pré-renderizar o shell com hooks de navegação.
export const instant = false

import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"
import { ArrowLeft, ReceiptText, ShieldAlert } from "lucide-react"
import { ComprasLogin } from "@/components/compras/compras-auth"
import { LoadingState } from "@/components/shared/mascot-loader"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type ExpenseItem = {
  codigo:string
  quantidade:number|string
  valor_unitario:number|string
  descricao:string|null
  grupo:string|null
  area:string|null
  conta:string|null
  tipo:string|null
}
type ExpenseDraft = {
  source:"DESPESA_RASCUNHO_238"
  id:number
  filial:string
  total:number|string
  observacao:string|null
  criado_em:string
  tipo_pedido:"Despesa/Investimento"
  authorizesPurchases:false
  itens:ExpenseItem[]
}
const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"})
const quantity=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:4})

function isExpenseDraft(value:unknown,id:number):value is ExpenseDraft {
  if(!value||typeof value!=="object"||Array.isArray(value))return false
  const x=value as Partial<ExpenseDraft>
  return x.source==="DESPESA_RASCUNHO_238" && x.id===id &&
    x.tipo_pedido==="Despesa/Investimento" && x.authorizesPurchases===false &&
    typeof x.filial==="string" && typeof x.criado_em==="string" &&
    x.total!=null&&String(x.total).trim()!==""&&Number.isFinite(Number(x.total))&&Number(x.total)>=0 &&
    Array.isArray(x.itens)&&x.itens.length>0&&x.itens.length<=8 &&
    x.itens.every(item=>item&&typeof item==="object"&&
      typeof item.codigo==="string"&&item.codigo.length>0 &&
      item.quantidade!=null&&String(item.quantidade).trim()!==""&&
      item.valor_unitario!=null&&String(item.valor_unitario).trim()!==""&&
      Number.isFinite(Number(item.quantidade))&&Number(item.quantidade)>0 &&
      Number.isFinite(Number(item.valor_unitario))&&Number(item.valor_unitario)>=0)
}
export default function Page({params}:{params:Promise<{id:string}>}){
  return <Suspense fallback={<LoadingState label="Conferindo rascunho de despesas..."/>}>
    <ExpenseContent params={params}/>
  </Suspense>
}
export async function ExpenseContent({params}:{params:Promise<{id:string}>}){
  await connection()
  const supabase=await createSupabaseServerClient()
  if(!supabase)return <ComprasLogin configured={false}/>
  const {data:{user},error:authError}=await supabase.auth.getUser()
  if(authError||!user)return <ComprasLogin configured/>
  const {id}=await params
  if(!/^[1-9]\d{0,14}$/.test(id)){
    return <p role="alert" className="mx-auto max-w-xl p-8 text-sm text-amber-200">Número de rascunho inválido.</p>
  }
  const {data,error}=await supabase.rpc("fn_compras_despesa_rascunho_detalhar_238",{p_id:Number(id)})
  const draft=!error&&isExpenseDraft(data,Number(id))?data:null
  return <main className="mx-auto max-w-[1280px] space-y-6 pb-14 text-slate-100">
    <header className="flex flex-wrap items-center justify-between gap-4 pt-5">
      <Link href="/compras/atendimento" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 hover:text-cyan-100"><ArrowLeft size={16}/> Atendimento ao Fornecedor</Link>
      <span className="inline-flex items-center gap-2 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200"><ShieldAlert size={16}/> Somente rascunho · não aprovado</span>
    </header>
    {!draft?<section role="alert" className="erp-surface rounded-2xl border border-amber-400/25 p-7">
      <h1 className="text-lg font-bold text-amber-100">{error?.code==="42501"?"Acesso restrito ao Master ativo":"Rascunho não encontrado ou indisponível"}</h1>
      <p className="mt-3 text-xs leading-6 text-slate-300">Não é possível exibir itens sem um rascunho válido e uma autorização do Supabase. Nenhum valor foi presumido.</p>
    </section>:<>
      <section className="erp-surface rounded-[26px] border border-cyan-300/20 p-7 sm:p-9">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-cyan-300"><ReceiptText size={16}/> Compras · Cad_Despesas</p>
        <h1 className="mt-3 text-3xl font-bold text-white">Despesa / investimento #{draft.id}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Registro preservado no Supabase com os itens originais e suas classificações do catálogo. Não é lançamento contábil, reserva de orçamento ou emissão de pedido.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-700/70 p-4"><p className="text-xs text-slate-400">Filial</p><p className="mt-2 font-bold">{draft.filial}</p></div>
          <div className="rounded-xl border border-slate-700/70 p-4"><p className="text-xs text-slate-400">Itens</p><p className="mt-2 font-bold">{draft.itens.length}</p></div>
          <div className="rounded-xl border border-slate-700/70 p-4"><p className="text-xs text-slate-400">Total salvo</p><p className="mt-2 font-bold tabular-nums text-cyan-200">{money.format(Number(draft.total))}</p></div>
          <div className="rounded-xl border border-slate-700/70 p-4"><p className="text-xs text-slate-400">Gravado em</p><p className="mt-2 font-semibold">{new Date(draft.criado_em).toLocaleString("pt-BR",{timeZone:"America/Campo_Grande"})}</p></div>
        </div>
        {draft.observacao&&<p className="mt-4 text-sm text-slate-300"><strong>Observações:</strong> {draft.observacao}</p>}
      </section>
      <section className="erp-surface overflow-hidden rounded-2xl border border-slate-700/70">
        <div className="border-b border-slate-700/70 p-5"><h2 className="font-bold text-white">Itens originais de despesa/investimento</h2><p className="mt-2 text-xs text-slate-400">Valor de cada linha = quantidade × valor unitário, com arredondamento monetário no PostgreSQL.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[940px] text-left text-xs">
          <thead className="bg-[#14243b] text-slate-300"><tr><th className="p-3">Código e descrição</th><th className="p-3">Grupo / área / conta</th><th className="p-3 text-right">Quantidade</th><th className="p-3 text-right">Valor unitário</th><th className="p-3 text-right">Total da linha</th></tr></thead>
          <tbody className="divide-y divide-slate-800">{draft.itens.map((item,i)=><tr key={item.codigo+"|"+i}>
            <td className="p-3 font-semibold text-slate-100">{item.codigo}<p className="mt-1 font-normal text-slate-400">{item.descricao??"Descrição não cadastrada"}</p></td>
            <td className="p-3 text-slate-300">{item.grupo??"—"}<p className="mt-1 text-slate-500">{item.area??"—"} / {item.conta??"—"}</p></td>
            <td className="p-3 text-right tabular-nums">{quantity.format(Number(item.quantidade))}</td>
            <td className="p-3 text-right tabular-nums">{money.format(Number(item.valor_unitario))}</td>
            <td className="p-3 text-right font-semibold tabular-nums text-amber-200">{money.format(Math.round(Number(item.quantidade)*Number(item.valor_unitario)*100)/100)}</td>
          </tr>)}</tbody>
        </table></div>
      </section>
      <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs leading-6 text-amber-100">
        Este histórico não altera gastos efetivos, estoque, saldos financeiros ou títulos do SISCOM. A alçada de orçamento/OTB continua bloqueada até homologação financeira.
      </div>
    </>}
  </main>
}
