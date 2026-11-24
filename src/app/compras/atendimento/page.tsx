import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"
import { AlertTriangle, ArrowLeft, Search, Store } from "lucide-react"
import { ComprasLogin, ComprasSair } from "@/components/compras/compras-auth"
import { LoadingState } from "@/components/shared/mascot-loader"
import { AtendimentoFornecedor, type AttendanceProduct, type PurchaseDraft, type AttendanceDdeMeta } from "@/components/compras/atendimento-fornecedor"
import { AtendimentoDespesas, type ExpenseCatalogEntry, type ExpenseDraft238 } from "@/components/compras/atendimento-despesas"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { interpretOtbStockPosition } from "@/domains/compras/domain/otb-position-source"

type Params = { busca?: string; filial?: string }
const filiais = ["REDE","BDS","CG","RIO","CX","PG","AN"] as const
const nomes = ["Rede consolidada","Bandeirantes","Campo Grande","Rio Verde","Coxim","Pedro Gomes","Anastácio"]

export default function AtendimentoPage({ searchParams }: { searchParams: Promise<Params> }) {
  return <Suspense fallback={<LoadingState label="Preparando atendimento ao fornecedor..." />}><Content searchParams={searchParams} /></Suspense>
}

async function Content({ searchParams }: { searchParams: Promise<Params> }) {
  await connection()
  const supabase = await createSupabaseServerClient()
  if (!supabase) return <ComprasLogin configured={false} />
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return <ComprasLogin configured />

  const { error: authz } = await supabase.rpc("fn_listar_decisoes_compra", { p_chaves: [] })
  if (authz) return <main className="mx-auto max-w-3xl p-8 text-slate-100"><div role="alert" className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-7"><AlertTriangle /> <h1 className="mt-4 text-xl font-bold">Acesso restrito ao Master ativo</h1><p className="mt-2 text-sm">Não foi possível validar suas permissões no banco.</p></div><Link href="/compras" className="mt-5 inline-block text-cyan-300 underline">Voltar a Compras</Link></main>

  const params = await searchParams
  const busca = (params.busca ?? "").trim().slice(0,60)
  const filial = filiais.find((f) => f === params.filial) ?? "REDE"
  const { data, error } = busca.length >= 2
    ? await supabase.rpc("fn_compras_atendimento_catalogo", { p_busca: busca, p_filial: filial, p_limite: 40 })
    : { data: [], error: null }
  const products = (data ?? []) as AttendanceProduct[]
  const expenseCatalogResult=await supabase.rpc("fn_compras_catalogo_despesas_237", {p_busca:null})
  const expenseCatalog=(expenseCatalogResult.data??[]) as ExpenseCatalogEntry[]
  const draftsResult = await supabase.rpc("fn_compras_listar_cotacoes_rascunho",{p_limite:10})
  const drafts = draftsResult.error ? [] : (draftsResult.data??[]) as PurchaseDraft[]
  const expenseDraftsResult = await supabase.rpc("fn_compras_listar_despesas_rascunho_238",{p_limite:10})
  const expenseDrafts = expenseDraftsResult.error ? [] : (expenseDraftsResult.data??[]) as ExpenseDraft238[]
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",month: "2-digit",day: "2-digit", timeZone: "America/Campo_Grande",
  }).formatToParts(new Date())
  const date = (key: string) => parts.find((p) => p.type === key)?.value ?? ""
  const baseDate = date("year")+"-"+date("month")+"-"+date("day")

  // A versão 2.3.7 seleciona a competência do primeiro mês da OTB.
  const mesPlano=new Date(baseDate+"T00:00:00Z")
  mesPlano.setUTCDate(1)
  mesPlano.setUTCMonth(mesPlano.getUTCMonth()+1)
  const competencia=mesPlano.toISOString().slice(0,7)+"-01"
  const metasResult=products.length>0?await supabase.rpc("fn_compras_dde_plano_237",{
    p_codigos:products.map(p=>p.produto_cod),p_mes:competencia,
  }):{data:[],error:null}
  const metas=(metasResult.data??[]) as AttendanceDdeMeta[]
  // Estoque/CMV oficiais já agregados por subgrupo no domínio OTB.
  // Não revarrer vendas nem recalcular a API completa a cada consulta.
  const posicaoResult=await supabase.rpc("fn_otb_posicao_subgrupos",{p_data_base:baseDate})
  const posicao=interpretOtbStockPosition(posicaoResult.data,posicaoResult.error)
  const ddeObservado=posicao.status==="conectado"
    ?posicao.subgroups.map(s=>({grupo_subgrupo:s.subgroup,dde_observado:s.observedDde})):[]

  return <main className="mx-auto max-w-[1600px] space-y-6 pb-12 text-slate-100">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <Link href="/compras" className="inline-flex items-center gap-2 text-xs font-bold text-cyan-300"><ArrowLeft size={16}/> Voltar a Compras</Link>
      <ComprasSair />
    </div>
    <section className="erp-surface erp-reveal rounded-3xl p-6 sm:p-9">
      <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-cyan-300"><Store size={16}/> Compras · Gestão Zacarini 2.3.8</span>
      <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Atendimento <span className="text-cyan-300">Fornecedor</span></h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">Consulta Master de produtos, estoque, pedidos pendentes, venda de 90 dias e último custo do Supabase. Simule quantidades, descontos e parcelas; a gravação no SISCOM permanece bloqueada até aprovação financeira oficial.</p>
      <form method="get" action="/compras/atendimento" className="mt-6 flex flex-wrap items-end gap-3">
        <label className="min-w-[240px] flex-1 text-xs font-semibold text-slate-300">Buscar código, produto, marca ou fornecedor
          <div className="relative mt-2"><Search size={17} className="absolute left-3 top-3 text-cyan-400"/><input name="busca" required minLength={2} maxLength={60} defaultValue={busca} placeholder="Ex.: MSD, 100101, semente..." className="erp-field w-full pl-10 pr-3"/></div>
        </label>
        <label className="text-xs font-semibold text-slate-300">Estoque / vendas
          <select name="filial" defaultValue={filial} className="erp-field mt-2 w-52 px-3">
            {filiais.map((f,i)=><option key={f} value={f}>{nomes[i]}</option>)}
          </select>
        </label>
        <button type="submit" className="h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 text-xs font-bold text-white">Buscar produtos</button>
      </form>
    </section>
    {error ? <div role="alert" className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-5 text-amber-100">Consulta indisponível. Confira a RPC de Atendimento Fornecedor e a permissão Master; não foram presumidos dados ausentes.</div>
      : busca.length < 2 ? <div className="erp-surface rounded-xl p-7 text-sm text-slate-300">Digite pelo menos dois caracteres para consultar o catálogo. Nenhuma busca integral é executada automaticamente.</div>
      : <><div className="erp-surface rounded-xl p-4 text-xs text-slate-300">
          Plano de Estoque Zacarini 2.3.7 · competência {competencia.slice(0,7)}.
          Metas combinadas por subgrupo são consultadas no Supabase; sem meta manual, o DDE da posição de estoque é aproximado da meta básica pelos fatores mensais 30%, 55%, 75%, 87%, 95% e 100% da planilha.
          {metasResult.error&&<p className="mt-2 text-amber-200">Não foi possível consultar as metas do plano: as sugestões não foram homologadas.</p>}
        </div>
        <AtendimentoFornecedor key={busca+"-"+filial} products={products} branch={filial} baseDate={baseDate} drafts={drafts} ddeMetas={metas} ddeObservado={ddeObservado} posicaoConectada={posicao.status==="conectado"} competencia={competencia} userId={user.id} />
        </>}
    <AtendimentoDespesas branch={filial} catalog={expenseCatalog} unavailable={!!expenseCatalogResult.error} drafts={expenseDrafts} draftsUnavailable={!!expenseDraftsResult.error} />
  </main>
}
