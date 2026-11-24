import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"
import { ArrowLeft, ShieldAlert, Database } from "lucide-react"
import { ComprasLogin } from "@/components/compras/compras-auth"
import { LoadingState } from "@/components/shared/mascot-loader"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { validateOtb12mDraftRows, type Otb12mDraftMonth } from "@/domains/compras/domain/otb-projection-draft-12m"

type StoredSnapshot = {
  id:number
  data_base:string
  competencia_inicio:string
  criado_em:string
  linhas:Otb12mDraftMonth[]
  premissas: {situacao?:string;referencias?:number;homologadas?:number;advertencia?:string}
  caixa_parcial:number|string|null
  contas:number
  conciliadas:number
  hash:string
  estado:string
  observacao:string
}
const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"})
const fmt=(value:number|string|null)=>value===null?"—":money.format(Number(value))

export default function OtbDraftDetailPage({params}:{params:Promise<{id:string}>}) {
  return <Suspense fallback={<LoadingState label="Consultando versão do planejamento..." />}>
    <OtbDraftDetailContent params={params}/>
  </Suspense>
}

async function OtbDraftDetailContent({params}:{params:Promise<{id:string}>}) {
  await connection()
  const supabase=await createSupabaseServerClient()
  if(!supabase) return <ComprasLogin configured={false}/>
  const {data:{user},error:authError}=await supabase.auth.getUser()
  if(authError||!user) return <ComprasLogin configured/>
  const {id}=await params
  if(!/^[1-9]\d{0,14}$/.test(id)) return <p className="p-8 text-amber-100">ID de versão inválido.</p>
  const {data,error}=await supabase.rpc("fn_otb_projecao_rascunho_detalhar",{p_id:Number(id)})
  if(error) return <main className="mx-auto max-w-4xl space-y-5 p-6 text-slate-100"><p role="alert" className="text-amber-200">{error.code==="42501"?"Acesso restrito ao Master ativo.":"Não foi possível consultar a versão protegida no Supabase."}</p><Link href="/compras/otb" className="text-cyan-300 underline">Voltar ao OTB</Link></main>
  const snapshot=data as StoredSnapshot | null
  if(!snapshot||!validateOtb12mDraftRows(snapshot.linhas,snapshot.data_base)){
    return <main className="mx-auto max-w-4xl space-y-5 p-6 text-slate-100"><p role="alert" className="text-amber-200">Versão inexistente ou com conteúdo inconsistente. Nenhuma verba foi exibida como autorizada.</p><Link href="/compras/otb" className="text-cyan-300 underline">Voltar ao OTB</Link></main>
  }
  return <main className="mx-auto max-w-[1450px] space-y-6 pb-16 text-slate-100">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <Link href="/compras/otb" className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-300 hover:text-cyan-100"><ArrowLeft size={16}/> Voltar ao OTB</Link>
      <span className="inline-flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-2 text-xs text-amber-200"><ShieldAlert size={16}/> Rascunho · não libera compras</span>
    </div>
    <section className="erp-surface rounded-[24px] p-6 sm:p-8">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300"><Database size={15}/> Histórico imutável do Supabase</p>
      <h1 className="mt-3 text-2xl font-bold">Projeção 12M · versão #{snapshot.id}</h1>
      <p className="mt-3 text-xs leading-6 text-slate-400">Criada em {new Date(snapshot.criado_em).toLocaleString("pt-BR",{timeZone:"America/Campo_Grande"})}. Esta fotografia do cálculo da Zacarini é apenas referência e não substitui conciliação bancária, documentação de premissas ou homologação do limite de compras.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-700 p-4"><p className="text-xs text-slate-400">Data-base</p><p className="mt-2 font-bold">{snapshot.data_base}</p></div>
        <div className="rounded-xl border border-slate-700 p-4"><p className="text-xs text-slate-400">Caixa Siscom parcial no registro</p><p className="mt-2 font-bold">{fmt(snapshot.caixa_parcial)}</p></div>
        <div className="rounded-xl border border-slate-700 p-4"><p className="text-xs text-slate-400">Contas conciliadas no registro</p><p className="mt-2 font-bold">{snapshot.conciliadas}/{snapshot.contas}</p></div>
        <div className="rounded-xl border border-slate-700 p-4"><p className="text-xs text-slate-400">Premissas da referência</p><p className="mt-2 font-bold">{snapshot.premissas?.homologadas??0} homologadas · {snapshot.premissas?.referencias??0} em referência</p></div>
      </div>
      {snapshot.observacao&&<p className="mt-4 text-xs text-slate-400">Observação do registro: {snapshot.observacao}</p>}
      <p className="mt-4 break-all text-[11px] text-slate-500">SHA-256: {snapshot.hash}</p>
    </section>
    <section className="erp-surface overflow-hidden rounded-[24px]">
      <h2 className="border-b border-slate-800 p-6 text-lg font-bold">Cenários financeiros registrados</h2>
      <div className="overflow-x-auto"><table className="erp-table w-full min-w-[920px] text-left text-xs">
        <thead className="bg-[#121e30] uppercase tracking-wider text-slate-400">
          <tr><th className="p-4">Competência</th><th className="p-4 text-right">90%</th><th className="p-4 text-right">Plano</th><th className="p-4 text-right">Histórico</th><th className="p-4 text-right">Pior caso</th><th className="p-4 text-right">Reposição de referência</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-800">{snapshot.linhas.map(row=><tr key={row.mes}>
          <td className="p-4 font-bold text-cyan-300">{row.mes.slice(0,7)}</td>
          <td className="p-4 text-right tabular-nums">{fmt(row.noventa)}</td>
          <td className="p-4 text-right tabular-nums">{fmt(row.plano)}</td>
          <td className="p-4 text-right tabular-nums">{fmt(row.historico)}</td>
          <td className="p-4 text-right tabular-nums">{fmt(row.pior)}</td>
          <td className="p-4 text-right tabular-nums">{fmt(row.reposicao)}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="p-5 text-xs leading-6 text-amber-200">Nenhum valor desta página representa verba financeira aprovada. O cenário foi submetido pelo Master e registrado com evidências de origem; o banco não homologou sua metodologia ou completude financeira.</p>
    </section>
  </main>
}
