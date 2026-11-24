import Link from "next/link"
import { Suspense } from "react"
import { connection } from "next/server"
import { ArrowLeft, ChartNoAxesCombined, ShieldAlert } from "lucide-react"
import { ComprasLogin } from "@/components/compras/compras-auth"
import { LoadingState } from "@/components/shared/mascot-loader"
import { ExpenseBudgetManager238 } from "@/components/compras/expense-budget-manager-238"
import { parseExpenseBudget238 } from "@/domains/compras/domain/expense-budget-238"
import { createSupabaseServerClient } from "@/lib/supabase/server"

function currentMonth(){
  const parts=new Intl.DateTimeFormat("en-US",{
    year:"numeric",month:"2-digit",timeZone:"America/Campo_Grande",
  }).formatToParts(new Date())
  const year=parts.find(p=>p.type==="year")?.value??"2026"
  const month=parts.find(p=>p.type==="month")?.value??"11"
  return year+"-"+month
}
function validMonth(month:string){
  return /^20\d{2}-(0[1-9]|1[0-2])$/.test(month)&&
    Number(month.slice(0,4))>=2020&&Number(month.slice(0,4))<=2100
}

export default function Page({searchParams}:{searchParams:Promise<{mes?:string}>}){
  return <Suspense fallback={<LoadingState label="Preparando o orçamento replanejado..."/>}>
    <BudgetContent searchParams={searchParams}/>
  </Suspense>
}
export async function BudgetContent({searchParams}:{searchParams:Promise<{mes?:string}>}){
  await connection()
  const supabase=await createSupabaseServerClient()
  if(!supabase)return <ComprasLogin configured={false}/>
  const {data:{user},error:authError}=await supabase.auth.getUser()
  if(authError||!user)return <ComprasLogin configured/>
  const requested=(await searchParams).mes??""
  const mes=validMonth(requested)?requested:currentMonth()
  const competencia=mes+"-01"
  const {data,error}=await supabase.rpc("fn_compras_orcamento_replanejado_238",{p_competencia:competencia})
  const snapshot=error?null:parseExpenseBudget238(data,competencia)

  return <main className="mx-auto max-w-[1450px] space-y-6 pb-14 text-slate-100">
    <header className="flex flex-wrap items-center justify-between gap-3 pt-5">
      <Link href="/compras/atendimento" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200"><ArrowLeft size={16}/> Atendimento ao Fornecedor</Link>
      <span className="inline-flex items-center gap-2 text-xs text-amber-200"><ShieldAlert size={15}/> Não autoriza compras</span>
    </header>
    <section className="erp-surface rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-[#11283e] to-[#081626] p-7 sm:p-9">
      <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-cyan-300"><ChartNoAxesCombined size={17}/> Compras · Zacarini 2.3.8</span>
      <h1 className="mt-3 text-3xl font-bold text-white">Orçamento Replanejado por grupo</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
        Registro mensal da fonte <strong>Orc_Dados</strong> para o bloco ⑨ de despesas e investimentos. A regra é a mesma da coluna I51:I58 do Atendimento Fornecedor: filtrar ano, mês, grupo e Tipo = Replanejado, somar os itens e aplicar valor absoluto.
      </p>
      <p className="mt-2 text-xs text-slate-400">A planilha define a estrutura e a fórmula, mas não fornece dados em tempo de execução. Entradas de orçamento ficam versionadas no Supabase e não representam aprovação financeira.</p>
      <form action="/compras/atendimento/orcamento" method="get" role="search" className="mt-6 flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-slate-200">Competência mensal
          <input type="month" name="mes" defaultValue={mes} aria-label="Competência de orçamento"
            className="erp-field mt-2 block w-52 px-3"/>
        </label>
        <button type="submit" className="h-11 rounded-lg border border-cyan-400/40 bg-cyan-400/15 px-5 text-xs font-bold text-cyan-100">Consultar mês</button>
      </form>
    </section>
    {!snapshot?<section role="alert" className="erp-surface rounded-2xl border border-amber-300/30 p-6 text-xs leading-6 text-amber-200">
      {error?.code==="42501"?"Acesso restrito ao Master ativo.":"Fonte Replanejado indisponível ou incompatível. Nenhum valor será presumido."}
    </section>:<ExpenseBudgetManager238 key={competencia} month={competencia} snapshot={snapshot}/>}
  </main>
}
