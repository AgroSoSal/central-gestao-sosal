import Link from "next/link"
import { Suspense } from "react"
import { connection } from "next/server"
import { ArrowLeft, ListTodo, ShieldAlert } from "lucide-react"
import { ComprasLogin } from "@/components/compras/compras-auth"
import { LoadingState } from "@/components/shared/mascot-loader"
import { LiquidationActionManager238,type LiquidationAction238 } from "@/components/compras/liquidation-action-manager-238"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type SearchParams=Record<string,string|string[]|undefined>
const branches=["BDS","CG","RIO","CX","PG","AN"]
const first=(value:string|string[]|undefined)=>typeof value==="string"?value:Array.isArray(value)?value[0]??"":""
function isPayload(value:unknown):value is {source:string;status:string;authorizesTransfers:false;total:number;pagina:number;itens:LiquidationAction238[]} {
 if(!value||typeof value!=="object"||Array.isArray(value))return false
 const row=value as {source?:string;status?:string;authorizesTransfers?:boolean;total?:number;pagina?:number;itens?:unknown[]}
 return row.source==="LIQUIDACAO_ACOES_238"&&row.status==="planejamento_nao_executado"&&
  row.authorizesTransfers===false&&typeof row.total==="number"&&Number.isSafeInteger(row.total)&&row.total>=0&&
  typeof row.pagina==="number"&&Array.isArray(row.itens)&&row.itens.length<=30 &&
  row.itens.every(item=>!!item&&typeof item==="object"&&typeof (item as LiquidationAction238).produto_codigo==="string")
}
function href(branch:string,sku:string,page:number){
 const p=new URLSearchParams()
 if(branch)p.set("filial",branch)
 if(sku)p.set("sku",sku)
 p.set("pagina",String(page))
 return "/compras/liquidacao-acoes?"+p.toString()
}
export default function Page({searchParams}:{searchParams:Promise<SearchParams>}){
 return <Suspense fallback={<LoadingState label="Consultando planos de liquidação..."/>}>
   <ActionsContent searchParams={searchParams}/>
 </Suspense>
}
export async function ActionsContent({searchParams}:{searchParams:Promise<SearchParams>}){
 await connection()
 const supabase=await createSupabaseServerClient()
 if(!supabase)return <ComprasLogin configured={false}/>
 const {data:{user},error:authError}=await supabase.auth.getUser()
 if(authError||!user)return <ComprasLogin configured/>
 const params=await searchParams
 const sku=first(params.sku).trim().slice(0,150)
 const filial=branches.includes(first(params.filial))?first(params.filial):""
 const page=Math.min(1000,Math.max(1,parseInt(first(params.pagina),10)||1))
 const {data,error}=await supabase.rpc("fn_compras_liquidacao_acoes_listar_238",{
  p_filial:filial||null,p_produto_codigo:sku||null,p_pagina:page,p_tamanho:30,
 })
 const payload=!error&&isPayload(data)?data:null
 const pages=Math.max(1,Math.ceil((payload?.total??0)/30))
 return <main className="mx-auto max-w-[1450px] space-y-6 pb-14 text-slate-100">
  <header className="flex flex-wrap items-center justify-between gap-3 pt-5">
   <Link href="/compras/liquidacao-lojas" className="inline-flex items-center gap-2 text-sm font-bold text-cyan-200"><ArrowLeft size={16}/> Liquidação por lojas</Link>
   <span className="inline-flex items-center gap-2 text-xs text-amber-200"><ShieldAlert size={16}/> Planejamento · sem transferência SISCOM</span>
  </header>
  <section className="erp-surface rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-[#13283d] to-[#071624] p-7 sm:p-9">
   <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-cyan-300"><ListTodo size={17}/> Compras · Liquidação da Zacarini 2.3.8</p>
   <h1 className="mt-3 text-3xl font-bold">Plano operacional de liquidação</h1>
   <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
    Registre responsável, prazo, quantidade-meta e destino de ações propostas de estoque parado, excesso e liquidação.
    Os indicadores continuam calculados a partir do Supabase, e as ações ficam preparadas para integração futura com o SISCOM.
   </p>
   <form action="/compras/liquidacao-acoes" role="search" className="mt-6 flex flex-wrap items-end gap-3">
    <label className="text-xs font-semibold text-slate-300">Filial
     <select name="filial" defaultValue={filial} className="erp-field mt-2 block w-44 px-3"><option value="">Todas</option>{branches.map(b=><option key={b} value={b}>{b}</option>)}</select>
    </label>
    <label className="text-xs font-semibold text-slate-300">SKU
     <input name="sku" defaultValue={sku} maxLength={150} className="erp-field mt-2 block w-56 px-3"/>
    </label>
    <button type="submit" className="h-11 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-5 text-xs font-bold text-cyan-200">Filtrar planos</button>
   </form>
  </section>
  {!payload?<section role="alert" className="erp-surface rounded-xl border border-amber-400/25 p-6 text-sm text-amber-100">
   {error?.code==="42501"?"Acesso restrito ao Master ativo.":"A carteira de ações não está disponível. Nenhum registro foi presumido."}
  </section>:<>
   <LiquidationActionManager238 selectedSku={sku} selectedBranch={filial} rows={payload.itens}/>
   {pages>1&&<nav className="flex items-center justify-end gap-3 text-xs text-slate-400">
    {page>1&&<Link href={href(filial,sku,page-1)} className="rounded-lg border border-slate-700 px-3 py-2 text-cyan-200">Anterior</Link>}
    Página {page} de {pages} · {payload.total} ações
    {page<pages&&<Link href={href(filial,sku,page+1)} className="rounded-lg border border-cyan-400/30 px-3 py-2 text-cyan-200">Próxima</Link>}
   </nav>}
  </>}
 </main>
}
