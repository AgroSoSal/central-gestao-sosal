import Link from "next/link"
import { Suspense } from "react"
import { connection } from "next/server"
import { ArrowLeft, GitCompareArrows, ShieldAlert, Database, Scale } from "lucide-react"
import { ComprasLogin, ComprasSair } from "@/components/compras/compras-auth"
import { LoadingState } from "@/components/shared/mascot-loader"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type Amount = number | string | null
type AuditSummary = {
  itens_planilha: number
  valor_total_planilha: Amount
  saldo_pendente_planilha: Amount
  itens_com_pareamento: number
  itens_sem_pareamento: number
  itens_contratos_conferem: number
  itens_divergencia_contratual: number
  itens_preco_divergente: number
  itens_quantidade_divergente: number
  itens_fornecedor_divergente: number
  itens_valor_divergente: number
}
type BranchSummary = {
  loja_planilha: string
  loja_rpa: string
  itens: number
  sem_pareamento: number
  divergentes: number
  contratos_conferem: number
}
type AuditDifference = {
  linha_excel: number
  loja_planilha: string
  loja_rpa: string
  pedido: string
  produto_codigo: string
  descricao: string
  comparacao: string
  fornecedor_excel: string | null
  fornecedor_rpa: string | null
  quantidade_excel: Amount
  quantidade_rpa: Amount
  custo_unitario_excel: Amount
  custo_unitario_rpa: Amount
  valor_total_excel: Amount
  valor_total_rpa: Amount
  diferenca_valor_total: Amount
}
type AuditReport = {
  source: string
  arquivo_sha256: string
  data_base_fluxo: string
  authorizesPurchases: false
  resumo: AuditSummary
  por_loja: BranchSummary[]
  divergencias: AuditDifference[]
  ressalva: string
}

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const count = new Intl.NumberFormat("pt-BR")
const qty = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 })

function amount(value: Amount): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function isAuditReport(value: unknown): value is AuditReport {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Partial<AuditReport>
  return candidate.source === "ZACARINI_238_ULTIMO_XLSX" &&
    candidate.authorizesPurchases === false &&
    !!candidate.resumo && Array.isArray(candidate.por_loja) &&
    Array.isArray(candidate.divergencias) &&
    typeof candidate.arquivo_sha256 === "string" &&
    /^([a-f0-9]{64})$/.test(candidate.arquivo_sha256)
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="erp-surface rounded-2xl border border-[#25405b] p-5">
    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
    <p className="mt-3 text-3xl font-bold tabular-nums text-white">{value}</p>
    <p className="mt-2 text-xs leading-5 text-slate-400">{sub}</p>
  </div>
}

export default function ZacariniComparisonPage() {
  return <Suspense fallback={<LoadingState label="Conferindo a carteira de pedidos..." />}>
    <ComparisonContent />
  </Suspense>
}

async function ComparisonContent() {
  await connection()
  const supabase = await createSupabaseServerClient()
  if (!supabase) return <ComprasLogin configured={false} />
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return <ComprasLogin configured />

  // A RPC checa o perfil Master ativo no banco e não publica a tabela privada.
  const { data, error } = await supabase.rpc("fn_zacarini238_confronto_pedidos_master", { p_limite: 100 })
  if (error || !isAuditReport(data)) {
    return <div className="mx-auto max-w-4xl space-y-5 py-10 text-slate-100">
      <div className="flex justify-end"><ComprasSair /></div>
      <section role="alert" className="erp-surface rounded-2xl border border-amber-400/30 p-7 text-amber-100">
        <ShieldAlert size={26} />
        <h1 className="mt-4 text-xl font-semibold">
          {error?.code === "42501" ? "Acesso exclusivo ao Master" : "Conferência Zacarini indisponível"}
        </h1>
        <p className="mt-2 text-sm leading-6">Não foi possível validar o confronto dos pedidos no Supabase. Nenhum saldo ou pedido foi presumido.</p>
        <Link href="/compras" className="mt-5 inline-flex items-center gap-2 text-sm text-cyan-300 underline">
          <ArrowLeft size={15} /> Voltar a Compras
        </Link>
      </section>
    </div>
  }

  const report = data
  const summary = report.resumo

  return <main className="mx-auto max-w-[1530px] space-y-6 pb-14 text-slate-100">
    <header className="flex flex-wrap items-center justify-between gap-4 pt-5">
      <Link href="/compras" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200">
        <ArrowLeft size={16}/> Voltar a Compras
      </Link>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-200">
          <Database size={14}/> Supabase · somente Master
        </span>
        <ComprasSair/>
      </div>
    </header>

    <section className="erp-surface rounded-[26px] border border-cyan-300/20 p-6 sm:p-9">
      <div className="flex items-start gap-4">
        <span className="rounded-xl bg-cyan-400/10 p-3 text-cyan-300"><GitCompareArrows size={27}/></span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Auditoria da referência oficial</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">Conferência de pedidos · Zacarini 2.3.8</h1>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">
            Compara cada item da última planilha com a carteira SISCOM/RPA usando loja, número do pedido e código do produto.
            Aplica o de-para: SO SAL da planilha corresponde a CAMPO GRANDE no robô, e BANDEIRANTES corresponde a SO SAL no robô.
            Os dados da referência permanecem separados e auditáveis.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Base do fluxo Excel: 18/11/2026 · Identificador SHA-256: {report.arquivo_sha256.slice(0, 16)}…
          </p>
        </div>
      </div>
      <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm leading-6 text-amber-100">
        <ShieldAlert className="mt-0.5 shrink-0" size={18}/>
        <span>Não é autorização de compra nem conciliação bancária. A fonte RPA pode ter recebido alterações após a fotografia do Excel; ausência de correspondência não significa perda de dados.</span>
      </div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo da conferência">
      <Metric label="Itens da planilha" value={count.format(summary.itens_planilha)} sub={"Total: " + money.format(amount(summary.valor_total_planilha))}/>
      <Metric label="Contratos conferem" value={count.format(summary.itens_contratos_conferem)} sub="Mesma loja, pedido, produto, fornecedor, quantidade e preços"/>
      <Metric label="Divergências" value={count.format(summary.itens_divergencia_contratual)} sub={count.format(summary.itens_valor_divergente) + " itens com diferença no valor contratual"}/>
      <Metric label="Sem pareamento" value={count.format(summary.itens_sem_pareamento)} sub="Exigem classificação da origem, chegada ou encerramento"/>
    </section>

    <section className="erp-surface overflow-hidden rounded-2xl border border-[#25405b]">
      <div className="flex items-center justify-between gap-3 border-b border-[#25405b] p-5 sm:p-6">
        <div>
          <h2 className="font-bold text-white">Cobertura por filial</h2>
          <p className="mt-1 text-xs text-slate-400">Saldo pendente na referência: {money.format(amount(summary.saldo_pendente_planilha))}</p>
        </div>
        <Scale size={22} className="text-cyan-300"/>
      </div>
      <div className="overflow-x-auto">
        <table className="erp-table w-full min-w-[760px] text-left text-sm">
          <thead><tr>
            <th className="p-4">Loja na planilha</th>
            <th className="p-4">Loja no SISCOM/RPA</th>
            <th className="p-4 text-right">Itens</th>
            <th className="p-4 text-right">Conferem</th>
            <th className="p-4 text-right">Divergentes</th>
            <th className="p-4 text-right">Sem pareamento</th>
          </tr></thead>
          <tbody>{report.por_loja.map(row => <tr key={row.loja_planilha} className="border-t border-slate-800">
            <td className="p-4 font-semibold text-slate-100">{row.loja_planilha}</td>
            <td className="p-4 text-slate-300">{row.loja_rpa}</td>
            <td className="p-4 text-right tabular-nums">{count.format(row.itens)}</td>
            <td className="p-4 text-right tabular-nums text-emerald-300">{count.format(row.contratos_conferem)}</td>
            <td className="p-4 text-right tabular-nums text-amber-300">{count.format(row.divergentes)}</td>
            <td className="p-4 text-right tabular-nums">{count.format(row.sem_pareamento)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>

    <section className="erp-surface overflow-hidden rounded-2xl border border-[#25405b]">
      <div className="border-b border-[#25405b] p-5 sm:p-6">
        <h2 className="font-bold text-white">Pedidos com divergência contratual</h2>
        <p className="mt-2 text-xs leading-6 text-slate-400">
          Valores do Excel e do RPA aparecem lado a lado. A ordem é pelo maior desvio absoluto, com limite de 100 itens.
          {summary.itens_divergencia_contratual < 101 ? " Todas as divergências contratuais da referência estão listadas." : ""}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="erp-table w-full min-w-[1300px] text-left text-xs">
          <thead><tr>
            <th className="p-3">Linha / loja</th>
            <th className="p-3">Pedido / produto</th>
            <th className="p-3">Fornecedor (Excel → RPA)</th>
            <th className="p-3 text-right">Quantidade</th>
            <th className="p-3 text-right">Custo unitário</th>
            <th className="p-3 text-right">Valor total (Excel → RPA)</th>
            <th className="p-3 text-right">Diferença</th>
          </tr></thead>
          <tbody>{report.divergencias.map(row => <tr key={row.linha_excel} className="border-t border-slate-800">
            <td className="p-3"><span className="font-semibold text-white">{row.loja_planilha}</span><p className="text-slate-500">Linha {row.linha_excel}</p></td>
            <td className="p-3"><Link href={"/compras?busca=" + encodeURIComponent(row.pedido)} className="font-bold text-cyan-300 underline">{row.pedido}</Link><p className="text-slate-400">{row.produto_codigo} · {row.descricao}</p></td>
            <td className="p-3 tabular-nums">{row.fornecedor_excel ?? "—"} <span className="text-slate-500">→</span> {row.fornecedor_rpa ?? "—"}</td>
            <td className="p-3 text-right tabular-nums">{qty.format(amount(row.quantidade_excel))} → {qty.format(amount(row.quantidade_rpa))}</td>
            <td className="p-3 text-right tabular-nums">{money.format(amount(row.custo_unitario_excel))} → {money.format(amount(row.custo_unitario_rpa))}</td>
            <td className="p-3 text-right tabular-nums">{money.format(amount(row.valor_total_excel))} → {money.format(amount(row.valor_total_rpa))}</td>
            <td className="p-3 text-right font-semibold tabular-nums text-amber-200">{money.format(amount(row.diferenca_valor_total))}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
    <p className="text-xs leading-6 text-slate-500">{report.ressalva}</p>
  </main>
}
