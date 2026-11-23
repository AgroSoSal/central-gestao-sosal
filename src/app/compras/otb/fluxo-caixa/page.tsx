import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"
import { AlertTriangle, ArrowLeft, Banknote, CalendarRange, ClipboardCheck } from "lucide-react"
import { ComprasLogin, ComprasSair } from "@/components/compras/compras-auth"
import { LoadingState } from "@/components/shared/mascot-loader"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { assessBankPosition, summarizeContractedSchedule, type BankPositionRow, type ContractedMonth } from "@/domains/compras/domain/otb-bank-readiness"

const money = new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"})
const integer = new Intl.NumberFormat("pt-BR")
type OperationalCashAccount = {
  referencia_tecnica: string
  numero_conta: string
  tipo_conta: string
  filial: string | null
  empresa_auxiliar: string | null
  data_ultimo_saldo: string | null
  situacao_operacional: string
}
type OperationalCashSummary = {
  data_base: string
  contas_cadastradas: number
  contas_com_saldo: number
  contas_sem_extrato: number
  contas_com_saldo_defasado: number
  contas_conciliadas: number
  saldo_parcial_conhecido_siscom: number | string | null
  situacao_consolidado: string
  caixa_oficial_conciliado: boolean
}
type OperationalCashSnapshot = {
  resumo: OperationalCashSummary
  contas: OperationalCashAccount[]
}

function br(value:string|null){return value?value.slice(8,10)+"/"+value.slice(5,7)+"/"+value.slice(0,4):"—"}
function monthName(value:string){return new Intl.DateTimeFormat("pt-BR",{timeZone:"UTC",month:"short",year:"numeric"}).format(new Date(value+"T12:00:00Z"))}
function todayBrazil() { const parts=new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"America/Campo_Grande"}).formatToParts(new Date()); const part=(name:string)=>parts.find(p=>p.type===name)?.value??"";return `${part("year")}-${part("month")}-${part("day")}` }

export default function Page(){return <Suspense fallback={<LoadingState label="Conciliando os extratos..."/>}><Content/></Suspense>}

async function Content(){
  await connection()
  const supabase=await createSupabaseServerClient()
  if(!supabase)return <ComprasLogin configured={false}/>
  const {data:{user},error:authError}=await supabase.auth.getUser()
  if(authError||!user)return <ComprasLogin configured/>
  const {error:permissionError}=await supabase.rpc("fn_listar_decisoes_compra",{p_chaves:[]})
  if(permissionError)return <main role="alert" className="mx-auto max-w-2xl rounded-2xl border border-amber-400/30 bg-amber-400/10 p-8 text-amber-100">Somente Master ativo pode acessar o fluxo de caixa de Compras.</main>

  const today=todayBrazil()
  const [bankResult,contractResult,operationalResult]=await Promise.all([
    supabase.rpc("fn_otb_extratos_posicao_237",{p_corte:today}),
    supabase.rpc("fn_otb_agenda_contratada_12m_237",{p_inicio:today.slice(0,7)+"-01"}),
    supabase.rpc("fn_otb_caixa_operacional_status"),
  ])
  const banks=bankResult.error?[]:(bankResult.data??[]) as BankPositionRow[]
  const contracts=contractResult.error?[]:(contractResult.data??[]) as ContractedMonth[]
  const operational=operationalResult.error?null:(operationalResult.data as OperationalCashSnapshot|null)
  const operationalSummary=operational?.resumo
  const operationalAccounts=new Map((operational?.contas??[]).map(a=>[a.referencia_tecnica,a]))
  const partialAmount=Number(operationalSummary?.saldo_parcial_conhecido_siscom)
  const hasPartialAmount=operationalSummary?.saldo_parcial_conhecido_siscom!=null && Number.isFinite(partialAmount)
  const position=assessBankPosition(banks,today)
  const contractTotals=summarizeContractedSchedule(contracts)
  const hasBankPosition=!bankResult.error&&position.state==="conferido_sem_homologacao"
  const hasAgenda=!contractResult.error&&contractTotals.valid

  return <main className="mx-auto max-w-[1480px] space-y-6 pb-16 text-slate-100">
    <header className="flex flex-wrap items-center justify-between gap-3"><Link href="/compras/otb" className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-300"><ArrowLeft size={15}/> Voltar à OTB</Link><ComprasSair/></header>
    <section className="erp-surface rounded-3xl p-7 sm:p-9">
      <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.15em] text-cyan-300"><Banknote size={17}/> Só Sal · Projeção 12M</p>
      <h1 className="mt-4 text-3xl font-bold">Caixa bancário e compromissos conhecidos</h1>
      <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">Conferência automática das contas do Grupo Só Sal, incluindo contas consolidadas, filiais e empresas auxiliares, e agenda de recebíveis e fornecedores cadastrados no Supabase. Segue a separação da Zacarini entre saldo de abertura, carteira já contratada e projeção de operações futuras. Esta etapa não é uma OTB aprovada.</p>
      <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-xs leading-6 text-amber-100"><strong>Trava preservada:</strong> a conferência dos arquivos não equivale à conciliação homologada. A agenda de fornecedores utiliza a última carga RPA, que pode ser D-15. Folha, tributos, dívidas, recebimentos de vendas novas, custos de matéria-prima e regras do pior caso ainda não estão integralmente incorporados. Nenhum número abaixo libera compras.</div>
    </section>
    {bankResult.error&&<section role="alert" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-5 text-xs text-amber-100">Não foi possível consultar a posição bancária protegida ({bankResult.error.code}). Nenhum caixa presumido.</section>}
    {operationalResult.error?<section role="alert" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-5 text-xs text-amber-100">A posição operacional das contas não está disponível ({operationalResult.error.code}). Não é possível validar o caixa atual.</section>:operationalSummary?<section className="erp-surface rounded-2xl p-6" aria-label="Posição operacional dos extratos Siscom">
      <header><p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">Posição operacional · {br(operationalSummary.data_base)}</p><h2 className="mt-2 text-xl font-bold text-white">Saldos informados pelo Siscom</h2><p className="mt-2 max-w-4xl text-xs leading-6 text-slate-400">Inclui contas consolidadas, contas individuais por filial e empresas auxiliares. Os valores são registrados em cada conta distinta, mas não representam caixa livre, conciliação bancária nem teto de compras aprovado.</p></header>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/5 p-4"><p className="text-xs text-slate-400">Saldo conhecido · parcial</p><p className="mt-2 text-xl font-bold text-cyan-200 tabular-nums">{hasPartialAmount?money.format(partialAmount):"—"}</p></div>
        <div className="rounded-xl border border-slate-700 p-4"><p className="text-xs text-slate-400">Contas com saldo</p><p className="mt-2 text-xl font-bold tabular-nums">{operationalSummary.contas_com_saldo}/{operationalSummary.contas_cadastradas}</p></div>
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4"><p className="text-xs text-slate-400">Saldos anteriores à data-base</p><p className="mt-2 text-xl font-bold text-amber-200 tabular-nums">{operationalSummary.contas_com_saldo_defasado}</p></div>
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4"><p className="text-xs text-slate-400">Contas sem extrato</p><p className="mt-2 text-xl font-bold text-amber-200 tabular-nums">{operationalSummary.contas_sem_extrato}</p></div>
      </div>
      <p className="mt-4 text-xs leading-6 text-amber-200">Situação: {operationalSummary.situacao_consolidado.replaceAll("_"," ").toLowerCase()}. Apenas {operationalSummary.contas_conciliadas} contas têm saldo conciliado com o banco. Esse saldo parcial não libera compras pela OTB.</p>
      {(operational?.contas??[]).some(c=>c.situacao_operacional==="SEM_EXTRATO")&&<p className="mt-2 text-xs text-slate-400">Sem extrato: {(operational?.contas??[]).filter(c=>c.situacao_operacional==="SEM_EXTRATO").map(c=>c.numero_conta).join(", ")}.</p>}
    </section>:<section role="alert" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-5 text-xs text-amber-100">O Supabase não retornou uma posição operacional válida. Nenhum saldo foi presumido.</section>}
    <div className="grid gap-4 md:grid-cols-3">
      <section className="erp-surface rounded-2xl p-6"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Caixa identificado · mesma data-base</p><p className="mt-3 text-2xl font-bold text-white tabular-nums">{hasBankPosition&&position.openingCash!==null?money.format(position.openingCash):"—"}</p><p className="mt-3 text-xs text-slate-400">Saldos transportados até {br(position.commonDate)}; não é saldo liberado para compras.</p></section>
      <section className="erp-surface rounded-2xl p-6"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Arquivos x saldos do Supabase</p><p className="mt-3 text-2xl font-bold text-cyan-200 tabular-nums">{bankResult.error?"—":`${position.matchedArchives}/${position.accountCount}`}</p><p className="mt-3 text-xs text-slate-400">Conferência aritmética com tolerância de R$ 0,01.</p></section>
      <section className="erp-surface rounded-2xl p-6"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Conciliações homologadas</p><p className="mt-3 text-2xl font-bold text-amber-200 tabular-nums">{bankResult.error?"—":`${position.reconciledAccounts}/${position.accountCount}`}</p><p className="mt-3 text-xs text-slate-400">{position.staleAccounts} contas sem atualização nos últimos dois dias.</p></section>
    </div>
    {position.warnings.length>0&&<div role="status" className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-5 text-xs text-amber-100"><p className="font-bold">Pendências de conciliação</p><ul className="mt-2 list-inside list-disc space-y-1">{position.warnings.map(w=><li key={w}>{w}</li>)}</ul></div>}
    <section className="erp-surface overflow-hidden rounded-2xl"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-5"><h2 className="font-bold">Conferência por conta</h2><span className="text-xs text-slate-400">As datas de saldo mais recente podem diferir entre contas.</span></div><div className="overflow-x-auto"><table className="erp-table w-full min-w-[930px] text-left text-xs"><thead className="bg-[#121e30] uppercase tracking-wider text-slate-400"><tr>{["Escopo","Conta","Banco","Saldo mais recente em","Base comum em","Saldo na base","Dif. com arquivo","Conciliação"].map(x=><th key={x} className="p-4">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{banks.map(r=><tr key={r.conta_ref}><td className="p-4 font-semibold text-white">{operationalAccounts.get(r.conta_ref)?.tipo_conta==="CONSOLIDADA"?"Consolidada":operationalAccounts.get(r.conta_ref)?.tipo_conta==="EMPRESA_AUXILIAR"?"Auxiliar · "+(operationalAccounts.get(r.conta_ref)?.empresa_auxiliar??"Grupo"):operationalAccounts.get(r.conta_ref)?.filial??r.filial}</td><td className="p-4 text-cyan-300">{operationalAccounts.get(r.conta_ref)?.numero_conta??r.conta_ref}</td><td className="p-4 text-slate-300">{r.banco==="PENDENTE_IDENTIFICACAO"?"A identificar":r.banco}</td><td className="p-4">{br(r.data_ultimo_saldo)}</td><td className="p-4">{br(r.data_saldo_base)}</td><td className="p-4 text-right tabular-nums">{r.saldo_base==null?"—":money.format(Number(r.saldo_base))}</td><td className="p-4 text-right tabular-nums">{r.diferenca_arquivo==null?"—":money.format(Number(r.diferenca_arquivo))}</td><td className="p-4">{r.conciliado?<span className="text-emerald-300">Homologado</span>:<span className="text-amber-200">Pendente</span>}</td></tr>)}{banks.length===0&&<tr><td colSpan={8} className="p-6 text-slate-400">Sem saldos consultáveis.</td></tr>}</tbody></table></div></section>
    <section className="erp-surface overflow-hidden rounded-2xl"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 p-6"><div><p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.15em] text-cyan-300"><CalendarRange size={15}/> 12 competências</p><h2 className="mt-2 text-xl font-bold">Agenda dos títulos identificados</h2><p className="mt-2 max-w-3xl text-xs leading-6 text-slate-400">Recebíveis de painel.receber e fornecedores presentes na última extração RPA, por vencimento. Valores já vencidos são tratados separadamente e não entram automaticamente no mês atual. Não inclui vendas e custos futuros ainda não contratados.</p></div><span className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[11px] font-bold text-amber-200">Cobertura parcial · não é teto OTB</span></div>
      {contractResult.error?<p role="alert" className="p-6 text-xs text-amber-200">A agenda protegida de contratos está indisponível ({contractResult.error.code}).</p>:!hasAgenda?<p role="alert" className="p-6 text-xs text-amber-200">A agenda não retornou 12 meses válidos. Nenhum total foi assumido.</p>:<><div className="grid gap-3 border-b border-slate-800 p-5 md:grid-cols-3"><div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4"><p className="text-xs text-slate-400">Recebíveis identificados</p><p className="mt-2 text-xl font-bold text-emerald-200">{money.format(contractTotals.receivables)}</p></div><div className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-4"><p className="text-xs text-slate-400">Fornecedores no último arquivo</p><p className="mt-2 text-xl font-bold text-rose-200">{money.format(contractTotals.payables)}</p></div><div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4"><p className="text-xs text-slate-400">Diferença entre títulos identificados</p><p className="mt-2 text-xl font-bold text-white">{money.format(contractTotals.net)}</p></div></div><div className="overflow-x-auto"><table className="erp-table w-full min-w-[760px] text-left text-xs"><thead className="bg-[#121e30] uppercase tracking-wider text-slate-400"><tr><th className="p-4">Competência</th><th className="p-4 text-right">A receber</th><th className="p-4 text-right">Títulos</th><th className="p-4 text-right">A pagar · RPA</th><th className="p-4 text-right">Títulos</th><th className="p-4 text-right">Diferença identificada</th></tr></thead><tbody className="divide-y divide-slate-800">{contracts.map(r=><tr key={r.mes}><td className="p-4 font-bold capitalize text-cyan-300">{monthName(r.mes)}</td><td className="p-4 text-right tabular-nums">{money.format(Number(r.receber_identificado))}</td><td className="p-4 text-right tabular-nums text-slate-400">{integer.format(Number(r.titulos_receber))}</td><td className="p-4 text-right tabular-nums">{money.format(Number(r.pagar_identificado))}</td><td className="p-4 text-right tabular-nums text-slate-400">{integer.format(Number(r.titulos_pagar))}</td><td className="p-4 text-right font-semibold tabular-nums">{money.format(Number(r.saldo_contratado_identificado))}</td></tr>)}</tbody></table></div><p className="p-5 text-[11px] text-slate-400">Última carga de fornecedores: {contracts[0]?.ultima_importacao_pagar?new Date(contracts[0].ultima_importacao_pagar).toLocaleString("pt-BR",{timeZone:"America/Campo_Grande"}):"Não identificada"}. Fonte parcial: um arquivo D-15 não representa necessariamente toda a carteira a pagar.</p></>}
    </section>
    <section className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-6"><h2 className="flex items-center gap-2 text-lg font-bold text-amber-100"><AlertTriangle size={19}/> Para transformar esta análise em OTB oficial</h2><p className="mt-3 text-sm leading-7 text-amber-100/80">Faltam consolidar toda a carteira CAP sem duplicatas, classificar pagamentos por categoria da Zacarini, aplicar projeção de vendas futuras e despesas, reservar matéria-prima e registrar a aprovação do pior cenário de caixa. O sistema não substituirá essas premissas por zero.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/compras/otb/premissas" className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-xs font-bold text-cyan-200"><ClipboardCheck size={15}/> Premissas de OTB</Link><Link href="/compras/otb" className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-xs font-bold text-white">Voltar à OTB</Link></div></section>
  </main>
}
