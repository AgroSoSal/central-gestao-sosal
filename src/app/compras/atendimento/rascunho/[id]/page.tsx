// Rota de detalhe dinâmica: impede pré-renderização do shell com usePathname.
export const instant = false

import Link from "next/link"
import { Suspense } from "react"
import { connection } from "next/server"
import { ArrowLeft, ClipboardList, ShieldAlert, BadgeCheck } from "lucide-react"
import { ComprasLogin } from "@/components/compras/compras-auth"
import { LoadingState } from "@/components/shared/mascot-loader"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type StoredItem = {
  produto_codigo:string
  quantidade:number|string
  custo_unitario:number|string
  desconto_percentual:number|string
  descricao?:string|null
  marca?:string|null
  fornecedor?:string|null
  comprador?:string|null
  frete?:string|null
  condicao_pagamento?:string|null
  prazo_entrega_dias?:number|string|null
  chegada_prevista?:string|null
  rateio_filiais?:unknown
}
type StoredQuote = {
  source:"COTACAO_RASCUNHO_238"
  id:number
  filial:string
  itens:StoredItem[]
  total:number|string
  observacao:string|null
  status:string
  tipo_pedido:string
  criado_em:string
  estado_operacional:"RASCUNHO_NAO_AUTORIZADO"
  authorizesPurchases:false
}
const money = new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"})
const number = new Intl.NumberFormat("pt-BR",{maximumFractionDigits:4})
const formatMoney=(value:number|string)=>money.format(Number(value))

function isQuote(value:unknown,id:number):value is StoredQuote {
  if(!value||typeof value!=="object"||Array.isArray(value))return false
  const row=value as Partial<StoredQuote>
  if(row.source!=="COTACAO_RASCUNHO_238"||row.id!==id||
    row.estado_operacional!=="RASCUNHO_NAO_AUTORIZADO"||row.authorizesPurchases!==false||
    typeof row.filial!=="string"||typeof row.criado_em!=="string"||
    !Array.isArray(row.itens)||row.itens.length<1||row.itens.length>40||
    row.total===null||!Number.isFinite(Number(row.total))||Number(row.total)<0)return false
  return row.itens.every(item=>item&&typeof item==="object"&&
    typeof item.produto_codigo==="string"&&item.produto_codigo.length>0&&
    [item.quantidade,item.custo_unitario,item.desconto_percentual].every(v=>
      v!==null&&String(v).trim()!==""&&Number.isFinite(Number(v))&&Number(v)>=0) &&
    Number(item.quantidade)>0&&Number(item.desconto_percentual)<=100)
}

export default function SavedQuotePage({params}:{params:Promise<{id:string}>}) {
  return <Suspense fallback={<LoadingState label="Conferindo cotação do fornecedor..."/>}>
    <QuoteContent params={params}/>
  </Suspense>
}

export async function QuoteContent({params}:{params:Promise<{id:string}>}) {
  await connection()
  const supabase=await createSupabaseServerClient()
  if(!supabase)return <ComprasLogin configured={false}/>
  const {data:{user},error:authError}=await supabase.auth.getUser()
  if(authError||!user)return <ComprasLogin configured/>

  const {id}=await params
  if(!/^[1-9]\d{0,14}$/.test(id))return <p role="alert" className="p-8 text-amber-200">Número da cotação inválido.</p>
  const {data,error}=await supabase.rpc("fn_compras_cotacao_rascunho_detalhar_238",{p_id:Number(id)})
  const quote=!error&&isQuote(data,Number(id))?data:null

  return <main className="mx-auto max-w-[1300px] space-y-6 pb-16 text-slate-100">
    <header className="flex flex-wrap items-center justify-between gap-3 pt-5">
      <Link href="/compras/atendimento" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200"><ArrowLeft size={16}/> Atendimento ao Fornecedor</Link>
      <span className="inline-flex items-center gap-2 rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-100"><ShieldAlert size={16}/> Não autoriza compras</span>
    </header>

    {!quote?<section role="alert" className="erp-surface rounded-2xl border border-amber-300/25 p-7">
      <h1 className="text-lg font-bold text-amber-100">{error?.code==="42501"?"Acesso restrito ao Master ativo":"Rascunho não encontrado ou indisponível"}</h1>
      <p className="mt-2 text-xs leading-6 text-slate-300">Nenhum valor foi presumido e nenhuma operação foi realizada. A consulta exige sessão Master e um identificador de cotação válido.</p>
    </section>:<>
      <section className="erp-surface rounded-3xl border border-cyan-300/20 p-6 sm:p-9">
        <div className="flex items-start gap-4">
          <span className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 p-3 text-cyan-200"><ClipboardList size={24}/></span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.17em] text-cyan-300">Atendimento ao Fornecedor · Supabase</p>
            <h1 className="mt-2 text-2xl font-bold text-white">Cotação registrada #{quote.id}</h1>
            <p className="mt-2 text-sm text-slate-400">Histórico consultável da negociação. O registro conserva as quantidades, preços e descontos enviados; não representa pedido enviado ou aprovado.</p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-700/70 p-4"><p className="text-xs text-slate-400">Filial</p><p className="mt-2 font-bold">{quote.filial}</p></div>
          <div className="rounded-xl border border-slate-700/70 p-4"><p className="text-xs text-slate-400">Itens</p><p className="mt-2 font-bold">{quote.itens.length}</p></div>
          <div className="rounded-xl border border-slate-700/70 p-4"><p className="text-xs text-slate-400">Total registrado</p><p className="mt-2 font-bold text-cyan-200">{formatMoney(quote.total)}</p></div>
          <div className="rounded-xl border border-slate-700/70 p-4"><p className="text-xs text-slate-400">Registrada em</p><p className="mt-2 text-sm font-bold">{new Date(quote.criado_em).toLocaleString("pt-BR",{timeZone:"America/Campo_Grande"})}</p></div>
        </div>
        {quote.observacao&&<p className="mt-4 text-sm text-slate-300"><strong>Observação:</strong> {quote.observacao}</p>}
      </section>

      <section className="erp-surface overflow-hidden rounded-2xl border border-[#25405b]">
        <div className="flex items-center justify-between gap-3 border-b border-[#25405b] p-5 sm:p-6">
          <div><h2 className="font-bold text-white">Itens preservados na cotação</h2><p className="mt-2 text-xs text-slate-400">O total vem do valor calculado no PostgreSQL ao salvar o rascunho.</p></div>
          <BadgeCheck size={21} className="text-cyan-200"/>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-xs">
          <thead className="bg-[#122136] text-slate-300"><tr>
            <th className="p-3">Produto</th><th className="p-3">Fornecedor / marca</th><th className="p-3 text-right">Quantidade</th>
            <th className="p-3 text-right">Custo unitário</th><th className="p-3 text-right">Desconto</th>
            <th className="p-3">Condições registradas</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-800">{quote.itens.map((item,i)=><tr key={item.produto_codigo+"|"+i} className="hover:bg-cyan-400/[.04]">
            <td className="p-3 font-semibold text-slate-100">{item.produto_codigo}{item.descricao&&<p className="mt-1 max-w-[260px] text-slate-400">{item.descricao}</p>}</td>
            <td className="p-3 text-slate-300">{item.fornecedor??"Não informado"}{item.marca&&<p className="mt-1 text-slate-500">{item.marca}</p>}</td>
            <td className="p-3 text-right tabular-nums">{number.format(Number(item.quantidade))}</td>
            <td className="p-3 text-right tabular-nums">{formatMoney(item.custo_unitario)}</td>
            <td className="p-3 text-right tabular-nums">{Number(item.desconto_percentual).toLocaleString("pt-BR",{maximumFractionDigits:2})}%</td>
            <td className="p-3 text-slate-300">{item.condicao_pagamento??"Não registrada"}{item.frete&&<p className="mt-1 text-slate-500">Frete {item.frete}</p>}{item.chegada_prevista&&<p className="mt-1 text-slate-500">Chegada {item.chegada_prevista}</p>}</td>
          </tr>)}</tbody>
        </table></div>
      </section>
      <p className="rounded-xl border border-amber-300/20 bg-amber-400/5 p-4 text-xs leading-6 text-amber-100">Rascunho histórico: não verifica caixa, teto OTB, chegada fiscal nem decisão no SISCOM. Cotação salva não é autorização, emissão ou compra confirmada.</p>
    </>}
  </main>
}
