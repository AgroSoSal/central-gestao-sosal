import Link from "next/link"
import { ArrowLeft, ArrowRight, AlertTriangle, Boxes, ChevronLeft, ChevronRight, Search, TrendingDown } from "lucide-react"
import { getBranchDisplayName } from "@/domains/compras/domain/branches"
import { findStockTransferCandidates } from "@/domains/compras/domain/stock-transfer-candidates"

export type StockLiquidationRow = {
  filial: string; produto_cod: string; descricao: string; grupo_subgrupo: string
  marca: string; linha: number | null; qtde_estoque: number | string | null
  valor_estoque: number | string | null; vendido_90d: number | string | null
  previsto_90d: number | string | null; fator_crescimento: number | string | null
  dde_previsto: number | string | null; situacao: string; valor_parado: number | string | null
  motivo_exclusao: string | null; base_previsao: string | null; data_historico: string | null
  total_itens: number | string; total_estoque: number | string | null
  total_parado: number | string | null; itens_sem_giro: number | string; itens_excesso: number | string
}

export type StockLiquidationFilters = {
  busca: string; filial: string; linha: string; situacao: string; dde: number; pagina: number
}

const branchNames: Record<string,string> = { BDS: "Bandeirantes", CG: "Campo Grande", RIO: "Rio Verde", CX: "Coxim", PG: "Pedro Gomes", AN: "Anastácio" }
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 })

function safe(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null
  const result = Number(value)
  return Number.isFinite(result) ? result : null
}

function formatted(value: number | string | null | undefined, format: "currency" | "number" = "number") {
  const x = safe(value)
  return x === null ? "—" : format === "currency" ? money.format(x) : number.format(x)
}

export function stockLiquidationHref(base: string, filters: StockLiquidationFilters, page: number): string {
  const params = new URLSearchParams()
  if (filters.busca) params.set("busca", filters.busca)
  if (filters.filial) params.set("filial", filters.filial)
  if (filters.linha) params.set("linha", filters.linha)
  if (filters.situacao && filters.situacao !== "todos") params.set("situacao", filters.situacao)
  if (filters.dde !== 60) params.set("dde", String(filters.dde))
  params.set("pagina", String(page))
  return base + "?" + params.toString()
}

const variants = {
  parado: {
    title: "Estoque parado", eyebrow: "Radar de capital imobilizado", subtitle: "Visão da rede por SKU. Acompanhe estoque sem giro e excesso de cobertura, usando o critério Liq_Rede da Zacarini 2.3.7.", base: "/compras/estoque-parado", escopo: "rede",
  },
  lojas: {
    title: "Liquidação por lojas", eyebrow: "Excesso e giro por filial", subtitle: "Situação por produto e unidade. Compare onde há excesso e onde há demanda antes de propor uma transferência.", base: "/compras/liquidacao-lojas", escopo: "lojas",
  },
  linhas: {
    title: "Liquidação por linhas", eyebrow: "Prioridades do comprador", subtitle: "Produtos da rede classificados nas linhas 1 a 4. Use a seleção de linha para priorizar ações e revisar o valor parado.", base: "/compras/liquidacao-linhas", escopo: "rede",
  },
} as const

export function StockLiquidationDashboard({ variant, rows, error, filters }: {
  variant: keyof typeof variants; rows: StockLiquidationRow[]; error: string | null; filters: StockLiquidationFilters
}) {
  const view = variants[variant]
  const total = safe(rows[0]?.total_itens) ?? 0
  const totalPages = Math.max(1, Math.ceil(total / 40))
  const start = total === 0 ? 0 : (filters.pagina - 1) * 40 + 1
  const end = Math.min(total, filters.pagina * 40)
  const transferCandidates = variant === "lojas" && !filters.filial && filters.situacao === "todos" && rows.length === total &&
    rows.length>0 && rows.every(row=>row.produto_cod===filters.busca)
      ? findStockTransferCandidates(rows) : []
  return <main className="mx-auto max-w-[1600px] space-y-6 pb-16 text-slate-100">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/compras" className="inline-flex items-center gap-2 text-xs font-bold text-cyan-300"><ArrowLeft size={16}/> Voltar a Compras</Link>
      <Link href="/compras/cobertura" className="text-xs text-slate-400 underline-offset-4 hover:text-cyan-300 hover:underline">Conferência Zacarini 2.3.7</Link>
    </div>
    <section className="erp-surface relative overflow-hidden rounded-3xl p-6 sm:p-9">
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl"/>
      <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.2em] text-cyan-300"><Boxes size={16}/> {view.eyebrow}</p>
      <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{view.title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">{view.subtitle}</p>
      <nav aria-label="Navegação de liquidação" className="mt-6 flex flex-wrap gap-2">
        {Object.entries(variants).map(([key, item]) => <Link key={key} href={item.base} aria-current={variant === key ? "page" : undefined} className={`rounded-xl border px-4 py-2.5 text-xs font-bold transition ${variant === key ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-200" : "border-slate-700 text-slate-300 hover:border-cyan-500"}`}>{item.title}</Link>)}
        <Link href="/compras/plano-estoque" className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-300 hover:border-cyan-500">Plano de estoque</Link>
        <Link href="/compras/producao-propria" className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-300 hover:border-cyan-500">Produção própria</Link>
      </nav>
    </section>
    <div role="status" className="rounded-2xl border border-amber-400/25 bg-amber-400/5 px-5 py-4 text-xs leading-6 text-amber-100">
      <strong>Indicador gerencial, não autorização financeira.</strong> O limite de {filters.dde} dias vem da referência Zacarini (60 dias originais, sinalizados para confirmar). A projeção compara 90 dias recentes à sazonalidade do ano anterior quando houver séries comparáveis. O Supabase ainda não disponibiliza os marcadores internos exatos <code>_Base</code>/<code>_Comparavel</code> da planilha; portanto a estimativa não é uma reprodução integral certificada. Estoque e vendas vêm das cargas RPA, e transferências não são executadas automaticamente.
    </div>
    <section className="erp-surface rounded-2xl p-5 sm:p-6">
      <form action={view.base} method="get" role="search" className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_170px_130px_170px_110px_auto]">
        <label className="text-xs font-semibold text-slate-300">SKU, produto ou subgrupo
          <span className="relative mt-2 block"><Search size={16} className="absolute left-3 top-3 text-cyan-400"/><input name="busca" defaultValue={filters.busca} maxLength={80} className="erp-field w-full pl-9 pr-3" placeholder="Produto, código..."/></span>
        </label>
        {variant === "lojas" ? <label className="text-xs font-semibold text-slate-300">Filial
          <select name="filial" defaultValue={filters.filial} className="erp-field mt-2 w-full px-3"><option value="">Todas as filiais</option>{Object.entries(branchNames).map(([code,name])=><option key={code} value={code}>{name}</option>)}</select>
        </label> : <div className="text-xs text-slate-400">Escopo:<div className="erp-field mt-2 flex items-center px-3">Rede consolidada</div></div>}
        <label className="text-xs font-semibold text-slate-300">Linha
          <select name="linha" defaultValue={filters.linha} className="erp-field mt-2 w-full px-3"><option value="">Todas</option>{[1,2,3,4].map(line=><option key={line} value={line}>Linha {line}</option>)}<option value="0">Sem linha</option></select>
        </label>
        <label className="text-xs font-semibold text-slate-300">Situação
          <select name="situacao" defaultValue={filters.situacao} className="erp-field mt-2 w-full px-3"><option value="todos">Todas</option><option value="sem_giro">Sem giro</option><option value="excesso">Excesso</option><option value="regular">Regular</option><option value="excluido">Excluídos</option></select>
        </label>
        <label className="text-xs font-semibold text-slate-300">DDE-limite
          <input type="number" name="dde" min={1} max={365} defaultValue={filters.dde} className="erp-field mt-2 w-full px-3"/>
        </label>
        <button type="submit" className="h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 text-xs font-bold text-white">Aplicar filtros</button>
      </form>
    </section>
    {error ? <div role="alert" className="rounded-2xl border border-amber-400/35 bg-amber-400/10 p-6 text-sm text-amber-100"><AlertTriangle size={20} className="mb-2"/><strong>Consulta indisponível</strong><p className="mt-2">A posição de estoque não pôde ser consultada com segurança. Os valores não foram estimados nem substituídos por zero. {error === "42501" ? "Confirme a autorização Master ativo." : "Verifique a RPC protegida e a atualização do histórico ABC."}</p></div>
      : <>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo do filtro">
          {[
            {label:"SKUs / posições",value:number.format(total),sub:"Registros do filtro completo"},
            {label:"Estoque a custo",value:formatted(rows[0]?.total_estoque,"currency"),sub:"Sem inventário externo"},
            {label:"Valor potencial parado",value:formatted(rows[0]?.total_parado,"currency"),sub:"Estimativa, não orçamento"},
            {label:"Sem giro / excesso",value:`${formatted(rows[0]?.itens_sem_giro)} / ${formatted(rows[0]?.itens_excesso)}`,sub:"Conforme DDE-limite selecionado"},
          ].map(metric=><div key={metric.label} className="erp-surface rounded-2xl p-5"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{metric.label}</p><p className="mt-4 break-all text-2xl font-bold tabular-nums text-white">{metric.value}</p><p className="mt-2 text-xs text-slate-500">{metric.sub}</p></div>)}
        </section>
        {transferCandidates.length>0&&<section className="rounded-2xl border border-cyan-300/20 bg-cyan-400/5 p-5"><h2 className="text-sm font-bold text-cyan-100">Possíveis destinos para avaliação de remanejamento</h2><p className="mt-2 text-xs leading-6 text-slate-400">O mesmo SKU apresenta estoque excedente em uma filial e demanda projetada com cobertura inferior a 30 dias em outra. É apenas uma indicação para conferência de frete, custo, reserva e autorização; nenhuma quantidade ou transferência é lançada no SISCOM.</p><div className="mt-3 flex flex-wrap gap-2">{transferCandidates.map((c,i)=><span key={`${c.origem}-${c.destino}-${i}`} className="rounded-lg border border-cyan-400/20 px-3 py-2 text-xs font-semibold text-cyan-200">{branchNames[c.origem]??c.origem} → {branchNames[c.destino]??c.destino}</span>)}</div></section>}
        <section className="erp-surface overflow-hidden rounded-2xl">
          <div className="flex flex-wrap justify-between gap-3 border-b border-slate-700/50 p-5"><div><h2 className="flex items-center gap-2 font-bold text-white"><TrendingDown size={19} className="text-cyan-400"/> Posições de estoque</h2><p className="mt-1 text-xs text-slate-400">Ordenadas pelo valor parado estimado, com valores completos do filtro.</p></div><p className="self-center text-xs text-slate-400">Exibindo {number.format(start)}–{number.format(end)} de {number.format(total)}</p></div>
          <div className="overflow-x-auto"><table className="erp-table w-full min-w-[1450px] text-left text-xs"><thead className="bg-[#121e30] text-[10px] uppercase tracking-wider text-slate-400"><tr>{["Código / produto","Filial","Grupo / linha","Estoque qtde","Estoque R$","Vendas 90d","Previsão 90d","DDE dias","Situação","Valor parado","Origem"].map(h=><th key={h} className="px-4 py-4">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">
            {rows.map((row,i)=><tr key={`${row.filial}-${row.produto_cod}-${i}`} className="align-top text-slate-200"><td className="max-w-72 px-4 py-4"><p className="font-semibold text-cyan-300">{row.produto_cod}</p><p className="mt-1 line-clamp-2" title={row.descricao}>{row.descricao}</p></td><td className="whitespace-nowrap px-4 py-4">{row.filial === "REDE" ? "Rede" : branchNames[row.filial] ?? getBranchDisplayName(row.filial)}</td><td className="max-w-56 px-4 py-4"><p className="line-clamp-2">{row.grupo_subgrupo}</p><span className="mt-1 block text-slate-500">Linha {row.linha ?? "?"}</span></td><td className="px-4 py-4 text-right tabular-nums">{formatted(row.qtde_estoque)}</td><td className="px-4 py-4 text-right tabular-nums">{formatted(row.valor_estoque,"currency")}</td><td className="px-4 py-4 text-right tabular-nums">{formatted(row.vendido_90d)}</td><td className="px-4 py-4 text-right tabular-nums">{formatted(row.previsto_90d)}</td><td className="px-4 py-4 text-right tabular-nums">{formatted(row.dde_previsto)}</td><td className="px-4 py-4"><span className={`inline-block whitespace-nowrap rounded-lg border px-2 py-1 font-semibold ${row.situacao==="sem_giro"?"border-red-400/25 bg-red-400/10 text-red-200":row.situacao==="excesso"?"border-amber-400/25 bg-amber-400/10 text-amber-200": "border-slate-600 bg-slate-700/40 text-slate-300"}`}>{({sem_giro:"Sem giro",excesso:"Excesso",regular:"Regular",excluido:"Excluído",sem_estoque:"Sem estoque",indisponivel:"Indisponível"} as Record<string,string>)[row.situacao] ?? row.situacao}</span>{row.motivo_exclusao&&<p className="mt-2 text-[10px] text-slate-400">{row.motivo_exclusao}</p>}</td><td className="px-4 py-4 text-right font-bold tabular-nums text-amber-200">{formatted(row.valor_parado,"currency")}</td><td className="max-w-48 px-4 py-4 text-[10px] text-slate-400"><span>{row.base_previsao}</span><span className="mt-1 block">ABC até {row.data_historico ?? "sem série"}</span>{variant!=="lojas"&&<Link href={`/compras/liquidacao-lojas?busca=${encodeURIComponent(row.produto_cod)}`} className="mt-2 inline-flex items-center gap-1 font-semibold text-cyan-300">Ver por loja <ArrowRight size={12}/></Link>}</td></tr>)}
            {rows.length===0&&<tr><td colSpan={11} className="px-5 py-12 text-center text-sm text-slate-400">Nenhuma posição encontrada com estes filtros. Experimente exibir todas as situações ou limpar a busca.</td></tr>}
          </tbody></table></div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-5 py-4"><span className="text-xs text-slate-500">Página {filters.pagina} de {totalPages}</span><div className="flex gap-2">{filters.pagina > 1 && <Link href={stockLiquidationHref(view.base, filters, filters.pagina-1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-cyan-300"><ChevronLeft size={14}/> Anterior</Link>}{filters.pagina<totalPages&&<Link href={stockLiquidationHref(view.base, filters, filters.pagina+1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-cyan-300">Próxima <ChevronRight size={14}/></Link>}</div></div>
        </section>
      </>}
  </main>
}
