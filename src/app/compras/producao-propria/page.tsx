import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"
import { ArrowLeft, ChevronLeft, ChevronRight, Factory } from "lucide-react"
import { ComprasLogin } from "@/components/compras/compras-auth"
import { OwnProductionCalculator } from "@/components/compras/own-production-calculator"
import { LoadingState } from "@/components/shared/mascot-loader"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type Params={busca?:string;pagina?:string}
type Product={produto_cod:string;descricao:string;grupo_subgrupo:string;marca:string;qtde_estoque:number|string|null;valor_estoque:number|string|null;total_itens:number|string}
function pageHref(busca:string,pagina:number){const p=new URLSearchParams();if(busca)p.set("busca",busca);p.set("pagina",String(pagina));return "/compras/producao-propria?"+p}
export default function Page({searchParams}:{searchParams:Promise<Params>}) {
  return <Suspense fallback={<LoadingState label="Carregando produção própria..."/>}><Content searchParams={searchParams}/></Suspense>
}
async function Content({searchParams}:{searchParams:Promise<Params>}) {
  await connection()
  const supabase=await createSupabaseServerClient()
  if(!supabase)return <ComprasLogin configured={false}/>
  const {data:{user},error:authError}=await supabase.auth.getUser()
  if(authError||!user)return <ComprasLogin configured/>
  const {error:authz}=await supabase.rpc("fn_listar_decisoes_compra",{p_chaves:[]})
  if(authz)return <main role="alert" className="mx-auto max-w-xl rounded-xl border border-amber-300/30 bg-amber-400/10 p-8 text-amber-100">Acesso restrito ao Master ativo.</main>
  const p=await searchParams
  const busca=(p.busca??"").trim().slice(0,80)
  const pagina=Number.isInteger(Number(p.pagina))&&Number(p.pagina)>=1&&Number(p.pagina)<=100?Number(p.pagina):1
  const {data,error}=await supabase.rpc("fn_compras_producao_catalogo_237",{p_busca:busca||null,p_pagina:pagina,p_tamanho:40})
  const products=error?[]:(data??[]) as Product[]
  const total=Number(products[0]?.total_itens??0)
  const pages=Math.max(1,Math.ceil(total/40))
  return <main className="mx-auto max-w-[1450px] space-y-6 pb-16 text-slate-100">
    <Link href="/compras" className="inline-flex items-center gap-2 text-xs font-bold text-cyan-300"><ArrowLeft size={16}/> Voltar a Compras</Link>
    <section className="erp-surface rounded-3xl p-7 sm:p-9"><p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.15em] text-cyan-300"><Factory size={17}/> Referência Gestão Zacarini 2.3.7</p><h1 className="mt-4 text-3xl font-bold">Produção Própria</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">Catálogo da marca SO SAL diretamente do SISCOM e simulação dos custos adicionais de fabricação por produto. A identificação da marca é operacional; peso de cada embalagem, custo por tonelada e frete dependem de confirmação técnica e comercial.</p><div className="mt-5 flex flex-wrap gap-4 text-xs"><Link href="/compras/estoque-parado" className="text-cyan-300 hover:underline">Estoque por SKU</Link><Link href="/compras/plano-estoque" className="text-cyan-300 hover:underline">Plano de estoque</Link></div></section>
    <div role="status" className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-5 text-xs leading-6 text-amber-100"><strong>Cálculo preparatório:</strong> valores de 200 R$/t e pesos exemplificados na planilha não foram importados como parâmetros autorizados. O campo <code>peso</code> da extração de estoque não representa, comprovadamente, kg por embalagem. Preencha os custos reais no simulador; nenhuma OTB ou requisição será emitida daqui.</div>
    <form action="/compras/producao-propria" method="get" role="search" className="erp-surface flex flex-wrap items-end gap-3 rounded-2xl p-5"><label className="min-w-64 flex-1 text-xs font-semibold text-slate-300">Buscar SKU ou descrição de marca própria<input name="busca" defaultValue={busca} maxLength={80} placeholder="Ex.: mineral, proteína, núcleo..." className="erp-field mt-2 w-full px-3"/></label><button type="submit" className="h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 text-xs font-bold text-white">Buscar</button><Link href="/compras/producao-propria" className="pb-3 text-xs text-slate-400 hover:text-cyan-300">Limpar</Link></form>
    {error?<div role="alert" className="rounded-xl border border-amber-300/30 bg-amber-400/10 p-6 text-amber-100">A consulta protegida do catálogo não está disponível. Nenhum dado substituído.</div>:<><OwnProductionCalculator key={busca+pagina} products={products}/><section className="erp-surface overflow-hidden rounded-2xl"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 p-5"><h2 className="font-semibold text-white">Produtos SO SAL</h2><span className="text-xs text-slate-400">{total} itens · página {pagina} de {pages}</span></div><div className="overflow-x-auto"><table className="erp-table w-full min-w-[750px] text-left text-xs"><thead className="bg-[#121e30] uppercase tracking-wider text-slate-400"><tr>{["SKU","Descrição","Grupo/subgrupo","Estoque / rede"].map(x=><th key={x} className="px-5 py-4">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{products.map(r=><tr key={r.produto_cod}><td className="px-5 py-3 font-bold text-cyan-300">{r.produto_cod}</td><td className="px-5 py-3">{r.descricao}</td><td className="px-5 py-3 text-slate-400">{r.grupo_subgrupo}</td><td className="px-5 py-3 tabular-nums">{r.qtde_estoque??"—"}</td></tr>)}</tbody></table></div><div className="flex justify-end gap-2 border-t border-slate-800 p-4">{pagina>1&&<Link href={pageHref(busca,pagina-1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs text-cyan-300"><ChevronLeft size={14}/>Anterior</Link>}{pagina<pages&&<Link href={pageHref(busca,pagina+1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs text-cyan-300">Próxima<ChevronRight size={14}/></Link>}</div></section></>}
  </main>
}
