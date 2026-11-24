import Link from "next/link"
import { Suspense } from "react"
import { connection } from "next/server"
import { AlertTriangle, ArrowLeft, FileText, Search, ShieldCheck, Truck } from "lucide-react"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ComprasLogin, ComprasSair } from "@/components/compras/compras-auth"
import { BranchFilterSelect } from "@/components/compras/branch-filter-select"
import { FilterSubmitButton } from "@/components/compras/filter-submit-button"
import { LoadingState } from "@/components/shared/mascot-loader"

type SearchParams = Record<string,string | string[] | undefined>
type Props = { searchParams: Promise<SearchParams> }
type NfEntry = {
  data:string|null
  nf:string|null
  filial:string|null
  produto_cod:string|null
  fornecedor:string|null
  qtde:number|string|null
  valor:number|string|null
  operacao:string|null
  dev:boolean|null
}
type NfReport = {
  source:"SISCOM_NF_ENTRADAS_238"
  status:"disponivel"
  filial:string|null
  total:number
  pagina:number
  tamanho:number
  itens:NfEntry[]
}
const branches = ["CAMPO GRANDE","SO SAL","RIO VERDE","COXIM","PEDRO GOMES","ANASTACIO"] as const
const PAGE_SIZE = 50
const money = new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"})
const number = new Intl.NumberFormat("pt-BR",{maximumFractionDigits:4})
const int = new Intl.NumberFormat("pt-BR")

function first(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? "" : ""
}
function validDate(v:string):string {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return ""
  const ms=Date.parse(v+"T00:00:00Z")
  return Number.isFinite(ms)&&new Date(ms).toISOString().startsWith(v)?v:""
}
function br(value:string|null):string{
  return value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(8,10)+"/"+value.slice(5,7)+"/"+value.slice(0,4) : "—"
}
function amount(value:number|string|null,format:"money"|"quantity"):string{
  if(value===null||String(value).trim()===""||!Number.isFinite(Number(value)))return "—"
  return format==="money"?money.format(Number(value)):number.format(Number(value))
}
function isReport(value:unknown):value is NfReport{
  if(!value||typeof value!=="object"||Array.isArray(value))return false
  const v=value as Partial<NfReport>
  return v.source==="SISCOM_NF_ENTRADAS_238" && v.status==="disponivel"
    && typeof v.total==="number"&&Number.isInteger(v.total)&&v.total>=0
    && Array.isArray(v.itens)&&v.itens.length<=PAGE_SIZE
    && v.itens.every(row=>row&&typeof row==="object")
}
function url(filters:{busca:string;loja:string;inicio:string;fim:string},page:number){
  const qs=new URLSearchParams()
  for(const [k,v] of Object.entries(filters))if(v)qs.set(k,v)
  qs.set("pagina",String(page))
  return "/compras/recebimentos?"+qs.toString()
}

export default function Page({searchParams}:Props){
  return <Suspense fallback={<LoadingState label="Carregando notas fiscais de entrada…"/>}>
    <ReceiptsContent searchParams={searchParams}/>
  </Suspense>
}

export async function ReceiptsContent({searchParams}:Props){
  await connection()
  const supabase=await createSupabaseServerClient()
  if(!supabase)return <ComprasLogin configured={false}/>
  const {data:{user},error:authError}=await supabase.auth.getUser()
  if(authError||!user)return <ComprasLogin configured/>
  const params=await searchParams
  const busca=first(params.busca).trim().slice(0,90)
  const loja=branches.find(x=>x===first(params.loja))??""
  const inicio=validDate(first(params.inicio))
  const fim=validDate(first(params.fim))
  const pagina=Math.min(1000,Math.max(1,Number.parseInt(first(params.pagina),10)||1))
  const filters={busca,loja,inicio,fim}
  const {data,error}=await supabase.rpc("fn_compras_listar_nfs_entrada_238",{
    p_loja:loja||null,p_inicio:inicio||null,p_fim:fim||null,
    p_busca:busca||null,p_pagina:pagina,p_tamanho:PAGE_SIZE,
  })
  const report=isReport(data)?data:null
  const paginas=report?Math.max(1,Math.ceil(report.total/PAGE_SIZE)):1

  return <main className="mx-auto max-w-[1500px] space-y-6 pb-14 text-slate-100">
    <header className="flex flex-wrap items-center justify-between gap-3 pt-5">
      <nav className="flex flex-wrap items-center gap-4 text-sm font-semibold">
        <Link href="/compras" className="inline-flex items-center gap-2 text-cyan-200 hover:text-cyan-100"><ArrowLeft size={16}/> Compras</Link>
        <Link href="/compras/gerenciar" className="text-slate-300 hover:text-white">Gerenciar</Link>
        <Link href="/compras/follow-up" className="inline-flex items-center gap-1 text-slate-300 hover:text-white"><Truck size={14}/> Follow-up</Link>
      </nav>
      <div className="flex items-center gap-3 text-xs text-slate-400"><ShieldCheck size={15} className="text-emerald-300"/>{user.email}<ComprasSair/></div>
    </header>
    <section className="erp-surface rounded-[26px] border border-cyan-300/20 bg-gradient-to-br from-[#102a43] to-[#091423] p-7 sm:p-9">
      <div className="flex flex-wrap gap-4">
        <FileText size={31} className="text-cyan-300"/>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.19em] text-cyan-300">Compras · entrada de mercadorias</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Consulta de NFs de entrada</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
            Linhas de notas fiscais de entrada extraídas do SISCOM, consultadas diretamente no Supabase.
            Filtros por filial, período, número da NF, código de produto ou fornecedor. Sem alterações no estoque ou no ERP de origem.
          </p>
        </div>
      </div>
      <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-400/[.05] p-4 text-xs leading-6 text-amber-100">
        A planilha Zacarini 2.3.8 utiliza as entradas fiscais para calcular quantidades recebidas, com rateio entre pedidos históricos.
        Esta consulta mostra as <strong>linhas reais das NFs</strong>, não vincula automaticamente cada NF a um pedido, nem homologa os valores da importação.
      </div>
    </section>

    <section className="erp-surface rounded-2xl border border-slate-700/60 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300"><Search size={15}/> Filtrar notas</h2>
      <form method="get" action="/compras/recebimentos" role="search" className="mt-4 grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_185px_150px_150px_auto]">
        <div><label htmlFor="nf-busca" className="mb-2 block text-xs font-semibold text-slate-300">NF, produto ou fornecedor</label><input id="nf-busca" name="busca" type="search" maxLength={90} defaultValue={busca} placeholder="NF, SKU ou fornecedor" className="erp-field px-3 text-xs"/></div>
        <div><label htmlFor="loja" className="mb-2 block text-xs font-semibold text-slate-300">Filial</label><BranchFilterSelect branches={branches} selectedBranch={loja}/></div>
        <div><label htmlFor="nf-inicio" className="mb-2 block text-xs font-semibold text-slate-300">Início</label><input id="nf-inicio" name="inicio" type="date" defaultValue={inicio} className="erp-field px-3 text-xs"/></div>
        <div><label htmlFor="nf-fim" className="mb-2 block text-xs font-semibold text-slate-300">Fim</label><input id="nf-fim" name="fim" type="date" defaultValue={fim} className="erp-field px-3 text-xs"/></div>
        <FilterSubmitButton/>
      </form>
    </section>

    {(error||!report)&&<section role="alert" className="rounded-xl border border-amber-300/25 bg-amber-400/10 p-6 text-sm text-amber-100">
      <AlertTriangle size={19}/>
      <h2 className="mt-3 font-bold">{error?.code==="42501"?"Acesso exclusivo ao Master":"Consulta de notas indisponível"}</h2>
      <p className="mt-2">Não foi possível consultar a origem do SISCOM. Nenhum documento ou valor foi presumido.</p>
    </section>}

    {report&&<section className="erp-surface overflow-hidden rounded-2xl border border-slate-700/60">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/60 px-5 py-4">
        <div>
          <h2 className="font-semibold text-white">Documentos de entrada · por linha da NF</h2>
          <p className="mt-1 text-xs text-slate-400">{int.format(report.total)} linhas encontradas · página {pagina} de {paginas}</p>
        </div>
        <span className="text-xs text-slate-400">Filial fiscal: {report.filial??"Todas"}</span>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1030px] text-left text-xs">
        <thead className="bg-[#111e30] uppercase tracking-wider text-slate-400"><tr>
          <th className="px-4 py-3">Data</th><th className="px-4 py-3">Filial</th>
          <th className="px-4 py-3">NF</th><th className="px-4 py-3">Fornecedor</th>
          <th className="px-4 py-3">SKU</th><th className="px-4 py-3 text-right">Qtd.</th>
          <th className="px-4 py-3 text-right">Valor da linha</th><th className="px-4 py-3">Operação</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-800">{report.itens.map((n,i)=><tr key={String(n.nf)+"|"+String(n.produto_cod)+"|"+String(n.data)+"|"+i} className="text-slate-200 hover:bg-cyan-400/5">
          <td className="whitespace-nowrap px-4 py-3">{br(n.data)}</td>
          <td className="px-4 py-3 font-semibold">{n.filial??"—"}</td>
          <td className="px-4 py-3 font-bold text-cyan-300">{n.nf??"—"}</td>
          <td className="max-w-64 px-4 py-3"><span className="block truncate" title={n.fornecedor??""}>{n.fornecedor??"—"}</span></td>
          <td className="px-4 py-3 font-medium">{n.produto_cod??"—"}</td>
          <td className="px-4 py-3 text-right tabular-nums">{amount(n.qtde,"quantity")}</td>
          <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{amount(n.valor,"money")}</td>
          <td className="max-w-52 px-4 py-3"><span className="block truncate" title={n.operacao??""}>{n.operacao??"—"}</span>{n.dev===true&&<span className="text-amber-200"> · marcador dev</span>}</td>
        </tr>)}</tbody>
      </table></div>
      {report.itens.length===0&&<p className="p-8 text-center text-sm text-slate-400">Nenhuma linha de NF localizada para os filtros informados.</p>}
      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-700/60 p-5 text-xs text-slate-400">
        <span>Paginação por linhas de nota, sem consolidação ou baixa de pedidos</span>
        <div className="flex items-center gap-3">
          {pagina>1&&<Link href={url(filters,pagina-1)} className="rounded-lg border border-white/15 px-3 py-2 text-slate-200">Anterior</Link>}
          {pagina} / {paginas}
          {pagina<paginas&&<Link href={url(filters,pagina+1)} className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-cyan-200">Próxima</Link>}
        </div>
      </footer>
    </section>}
  </main>
}
