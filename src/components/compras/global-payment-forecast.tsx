"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, BarChart3, CheckCircle2, LoaderCircle, RefreshCw, X } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import {
  consolidatePurchaseForecast,
  type ConsolidatedPurchaseForecast,
  type ForecastDecision,
  type ForecastFollowUp,
  type ForecastKey,
  type ForecastSourceItem,
  type ForecastClassification,
  type ForecastTermsIssue,
} from "@/domains/compras/domain/purchase-forecast-consolidation"
import { PaymentForecastCalendar } from "./payment-forecast-table"

type Props = {
  filters: { busca: string; loja: string; inicio: string; fim: string }
  dataBase: string
  genericCodes: string[]
  expectedTotal: number
  viewerId: string
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const CACHE_DURATION_MS = 3 * 60 * 1000
const consolidationCache = new Map<string, { value: ConsolidatedPurchaseForecast; expiresAt: number }>()
const CLASSIFICATION_SUGGESTIONS = [
  "5.DESPESAS / USO E CONSUMO", "5.DESPESAS / SERVIÇOS", "5.DESPESAS / LOGISTICA / FRETE",
  "5.DESPESAS / ADMINISTRATIVO / MANUT PREDIAL", "5.DESPESAS / LOGISTICA / MANUT FROTA",
  "5.DESPESAS / ADMINISTRATIVO / MANUT EQUIPAMENTOS", "5.DESPESAS / ADMINISTRATIVO / MAT COPA E COZINHA",
  "5.DESPESAS / ADMINISTRATIVO / SISTEMAS SOFTWARE", "5.DESPESAS / ADMINISTRATIVO / MAT LIMPEZA",
  "5.DESPESAS / PESSOAL / VIAGENS", "5.DESPESAS / INDUSTRIAL / MANUT MAQUINAS",
  "5.DESPESAS / LOGISTICA / PNEUS", "5.DESPESAS / LOGISTICA / COMBUSTIVEL TROC OLEO",
  "6.INVESTIMENTO / ATIVOS (INFORMATICA, ELETRO, GONDOLAS)",
]

const MAX_RPC_KEYS = 50
const splitKeys = (keys: ForecastKey[], batchSize = MAX_RPC_KEYS) =>
  Array.from({ length: Math.ceil(keys.length / batchSize) }, (_, index) => keys.slice(index * batchSize, (index + 1) * batchSize))

export function GlobalPaymentForecast({ filters, dataBase, genericCodes, expectedTotal, viewerId }: Props) {
  const [round, setRound] = useState(0)
  const [progress, setProgress] = useState({ processed: 0, total: expectedTotal })
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [result, setResult] = useState<ConsolidatedPurchaseForecast | null>(null)
  const [error, setError] = useState("")
  const [classificationItem, setClassificationItem] = useState<ForecastTermsIssue | null>(null)
  const [classificationValue, setClassificationValue] = useState("")
  const [classificationReason, setClassificationReason] = useState("")
  const [classificationSaving, setClassificationSaving] = useState(false)
  const [classificationError, setClassificationError] = useState("")
  const genericCodesKey = genericCodes.join(",")
  const cacheKey = JSON.stringify([viewerId, filters.busca, filters.loja, filters.inicio, filters.fim, dataBase, genericCodesKey, expectedTotal])

  const recalculate = () => {
    setStatus("loading")
    setResult(null)
    setError("")
    setProgress({ processed: 0, total: expectedTotal })
    setRound((n) => n + 1)
  }

  const openClassification = (item: ForecastTermsIssue) => {
    setClassificationItem(item)
    setClassificationValue("")
    setClassificationReason("")
    setClassificationError("")
  }

  const saveClassification = async () => {
    if (!classificationItem || classificationSaving) return
    const group = classificationValue.trim()
    const reason = classificationReason.trim()
    if (!/^[1-6]\.[^\r\n]{2,197}$/.test(group) || reason.length < 8 || reason.length > 500) {
      setClassificationError("Informe um grupo/subgrupo válido (ex.: 5.DESPESAS / SERVIÇOS) e um motivo com pelo menos 8 caracteres.")
      return
    }
    const supabase = createSupabaseBrowserClient()
    if (!supabase) { setClassificationError("Conexão autenticada indisponível."); return }
    setClassificationSaving(true)
    setClassificationError("")
    const { error: rpcError } = await supabase.rpc("fn_registrar_classificacao_compra", {
      p_loja: classificationItem.loja,
      p_pedido: classificationItem.pedido,
      p_produto_codigo: classificationItem.produto_codigo,
      p_grupo_subgrupo: group,
      p_motivo: reason,
    })
    setClassificationSaving(false)
    if (rpcError) { setClassificationError("Não foi possível registrar a classificação. Verifique a sessão Master e tente novamente."); return }
    setClassificationItem(null)
    recalculate()
  }

  useEffect(() => {
    if (!classificationItem) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !classificationSaving) setClassificationItem(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [classificationItem, classificationSaving])

  useEffect(() => {
    let cancelled = false
    const cached = viewerId && round === 0 ? consolidationCache.get(cacheKey) : null
    if (cached && cached.expiresAt > Date.now()) {
      void Promise.resolve().then(() => {
        if (cancelled) return
        setResult(cached.value)
        setProgress({ processed: cached.value.processedItems, total: cached.value.totalItems })
        setStatus("ready")
      })
      return () => { cancelled = true }
    }
    const supabase = createSupabaseBrowserClient()
    if (!supabase) {
      void Promise.resolve().then(() => {
        if (cancelled) return
        setError("A conexão autenticada ao Supabase não está configurada neste navegador.")
        setStatus("error")
      })
      return () => { cancelled = true }
    }

    const keys = (rows: ForecastKey[]) => rows.map((row) => ({ loja: row.loja, pedido: row.pedido, produto_codigo: row.produto_codigo }))
    void consolidatePurchaseForecast({
      loadPage: async (page, size) => {
        const { data, error: rpcError } = await supabase.rpc("fn_listar_pedidos_compra_conciliados", {
          p_busca: filters.busca || null,
          p_loja: filters.loja || null,
          p_inicio: filters.inicio || null,
          p_fim: filters.fim || null,
          p_pagina: page,
          p_tamanho: size,
          p_codigos_genericos: genericCodesKey ? genericCodesKey.split(",") : [],
        })
        if (rpcError) throw new Error(`Não foi possível conciliar o lote ${page} de compras.`)
        const records = (data ?? []) as (ForecastSourceItem & { total_itens: number | string | null; ultima_importacao: string | null })[]
        const total = Number(records[0]?.total_itens ?? (page === 1 ? Number.NaN : -1))
        const rows = records.filter((record) => record.loja && record.pedido && record.produto_codigo)
        return { rows, total, sourceVersion: records[0]?.ultima_importacao ?? null }
      },
      loadDecisions: async (rows) => {
        const batches = await Promise.all(splitKeys(rows).map(async (part) => {
          const { data, error: rpcError } = await supabase.rpc("fn_listar_decisoes_compra", { p_chaves: keys(part) })
          if (rpcError) throw new Error("As decisões de compra não puderam ser consultadas integralmente.")
          return (data ?? []) as ForecastDecision[]
        }))
        return batches.flat()
      },
      loadFollowUps: async (rows) => {
        const batches = await Promise.all(splitKeys(rows).map(async (part) => {
          const { data, error: rpcError } = await supabase.rpc("fn_listar_followup_compras", { p_chaves: keys(part) })
          if (rpcError) throw new Error("As previsões registradas no Follow-up não puderam ser consultadas integralmente.")
          return (data ?? []) as ForecastFollowUp[]
        }))
        return batches.flat()
      },
      loadClassifications: async (rows) => {
        const { data, error: rpcError } = await supabase.rpc("fn_listar_classificacao_compras", { p_chaves: keys(rows) })
        if (rpcError) throw new Error("A classificação financeira não pôde ser consultada; os totais foram bloqueados.")
        return (data ?? []) as ForecastClassification[]
      },
    }, dataBase, {
      onProgress: (processed, total) => { if (!cancelled) setProgress({ processed, total }) },
      isCancelled: () => cancelled,
    }).then((forecast) => {
      if (cancelled) return
      if (forecast.totalItems !== expectedTotal) throw new Error("A carteira mudou desde a abertura da página. Atualize os pedidos e recalcule.")
      if (viewerId) {
        if (consolidationCache.size > 24) consolidationCache.clear()
        consolidationCache.set(cacheKey, { value: forecast, expiresAt: Date.now() + CACHE_DURATION_MS })
      }
      setResult(forecast)
      setStatus("ready")
    }).catch((reason: unknown) => {
      if (cancelled) return
      setResult(null)
      setError(reason instanceof Error ? reason.message : "Erro inesperado durante a consolidação.")
      setStatus("error")
    })
    return () => { cancelled = true }
  }, [filters.busca, filters.loja, filters.inicio, filters.fim, dataBase, genericCodesKey, expectedTotal, viewerId, cacheKey, round])

  return <div className="space-y-4" aria-label="Consolidação de pagamentos">
    <section className="erp-surface rounded-2xl border border-cyan-400/20 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-cyan-300"><BarChart3 size={16} /> Consolidado financeiro</p>
          <h2 className="mt-2 text-lg font-bold text-white">Carteira completa dos filtros</h2>
          <p className="mt-1 max-w-3xl text-xs leading-6 text-slate-400">Cálculo de leitura sobre todos os itens da consulta, independentemente da página da tabela. NFs, decisões, Follow-up e grupo/subgrupo são consultados em cada lote.</p>
        </div>
        {status === "ready" && <button type="button" onClick={recalculate} className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-xs font-bold text-cyan-100 hover:bg-cyan-400/20"><RefreshCw size={15} /> Recalcular carteira</button>}
      </div>

      {status === "loading" && <div role="status" aria-live="polite" className="mt-5 rounded-xl border border-cyan-400/15 bg-[#08192b] p-5">
        <div className="flex items-center gap-3 text-sm font-semibold text-cyan-100"><LoaderCircle size={18} className="animate-spin" /> Consolidando carteira de compras…</div>
        <p className="mt-2 text-xs text-slate-400">{progress.processed.toLocaleString("pt-BR")} de {progress.total.toLocaleString("pt-BR")} itens verificados. Nenhum valor parcial é apresentado como total.</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-700" aria-label="Progresso da consolidação"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-[width] duration-300" style={{ width: `${progress.total > 0 ? Math.min(100, 100 * progress.processed / progress.total) : 0}%` }} /></div>
      </div>}
      {status === "error" && <div role="alert" className="mt-5 rounded-xl border border-amber-300/25 bg-amber-400/10 p-5 text-sm text-amber-100">
        <p className="flex items-center gap-2 font-bold"><AlertTriangle size={18} /> Não foi possível consolidar a carteira</p>
        <p className="mt-2 text-xs leading-6">{error} Os valores dos lotes já lidos não foram publicados como totais globais.</p>
        <button type="button" onClick={recalculate} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-amber-300/25 px-3 py-2 text-xs font-semibold hover:bg-amber-300/10"><RefreshCw size={14} /> Tentar novamente</button>
      </div>}
      {status === "ready" && result && <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-emerald-200"><CheckCircle2 size={16} /> <span>{result.processedItems} de {result.totalItems} itens conciliados</span><span className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 font-semibold">Carteira completa · sem lote omitido</span></div>}
    </section>

    {status === "ready" && result && <>
      <section className="erp-surface rounded-2xl border border-cyan-400/20 p-5">
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-300">Simulação de compras com classificação</p>
        <p className="mt-2 text-xs leading-6 text-slate-400">A linha de compras da Zacarini desconsidera despesas do grupo 5. Itens sem grupo/subgrupo não são presumidos como compras. A projeção abaixo não gera títulos a pagar nem lança no caixa.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[{ label: "Compras elegíveis nas 26 semanas", amount: result.eligibleInHorizonAmount, color: "text-cyan-200" }, { label: "Compras elegíveis vencidas", amount: result.eligibleOverdueAmount, color: "text-rose-200" }, { label: "Despesas do grupo 5", amount: result.excludedByGroup5Amount, color: "text-blue-200" }, { label: "Aguardando classificação", amount: result.unclassifiedAmount, color: "text-amber-200" }].map((item) => <div key={item.label} className="rounded-xl border border-white/10 bg-[#08192b] p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{item.label}</p><p className={`mt-3 text-xl font-black tabular-nums ${item.color}`}>{currency.format(item.amount)}</p></div>)}
        </div>
        <p className="mt-3 text-xs text-slate-400">Elegível depois das 26 semanas: {currency.format(result.eligibleAfterHorizonAmount)} · Condições elegíveis a conferir: {currency.format(result.eligibleUnscheduledAmount)}</p>
        {result.unclassifiedCount > 0 && <p role="note" className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/10 p-3 text-xs font-semibold text-amber-100">{result.unclassifiedCount} item(ns) sem classificação. O valor elegível é parcial até a conferência desses itens.</p>}
      </section>
      <section role="group" aria-label="Indicadores financeiros globais" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[{ label: "Bruto · Vence em 26 semanas", amount: result.inHorizonAmount, color: "text-cyan-200" }, { label: "Bruto · Já vencido", amount: result.overdueAmount, color: "text-rose-200" }, { label: "Bruto · Vence depois", amount: result.afterHorizonAmount, color: "text-blue-200" }, { label: "Bruto · Condição a conferir", amount: result.unscheduledAmount, color: "text-amber-200" }, { label: "Fora por Segurar/Cancelar", amount: result.excludedByDecision, color: "text-slate-300" }].map((card) => <div key={card.label} className="erp-surface rounded-xl p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{card.label}</p><p className={`mt-3 text-xl font-black tabular-nums ${card.color}`}>{currency.format(card.amount)}</p><p className="mt-2 text-[10px] text-emerald-300/90">Todos os {result.totalItems.toLocaleString("pt-BR")} itens dos filtros</p></div>)}
      </section>
      {(result.needsReview > 0 || result.unreconciled > 0) && <p role="note" className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs text-amber-100">Exceções: {result.needsReview} item(ns) com condição de pagamento a conferir; {result.unreconciled} item(ns) sem conciliação suficiente. Esses itens não geram vencimentos fictícios.</p>}
      {result.defaultsApplied > 0 && <p role="note" className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-xs text-cyan-100">{result.defaultsApplied} item(ns) com prazo padrão de 30 dias — condição vazia ou pagamento no cartão, conforme premissa B7 da Zacarini. Confira se o fornecedor confirmou esse prazo.</p>}
      <p className="text-xs font-bold uppercase tracking-wider text-cyan-200">Calendário de compras elegíveis · sem grupo 5 nem classificação pendente</p>
      <PaymentForecastCalendar weeks={result.eligibleWeeks} />
      {result.unclassifiedCount > 0 && <section role="region" aria-label="Itens pendentes de classificação" className="erp-surface overflow-hidden rounded-2xl border border-amber-400/25">
        <div className="border-b border-white/10 p-5"><h3 className="text-sm font-bold text-amber-100">Revisar classificação financeira</h3><p className="mt-1 text-xs text-slate-400">Escolha a classificação do item no cadastro complementar; a alteração ficará auditada e não modifica a importação RPA.</p></div>
        <div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left text-xs"><thead className="bg-[#0b1b2e] text-[10px] uppercase text-slate-400"><tr><th className="px-5 py-3">Pedido / filial</th><th className="px-4 py-3">Fornecedor</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3 text-right">Saldo pendente</th><th className="px-5 py-3 text-right">Ação</th></tr></thead>
          <tbody className="divide-y divide-white/10">{result.classificationIssues.map((item, index) => <tr key={`${item.loja}-${item.pedido}-${item.produto_codigo}-${index}`} className="hover:bg-cyan-400/5"><td className="px-5 py-3"><p className="font-bold text-cyan-300">#{item.pedido}</p><p className="text-slate-400">{item.loja}</p></td><td className="px-4 py-3 text-slate-300">{item.fornecedor_nome ?? "Não informado"}</td><td className="px-4 py-3 text-slate-200">{item.produto_codigo}</td><td className="px-4 py-3 text-right font-bold text-amber-200">{currency.format(item.valor_pendente)}</td><td className="px-5 py-3 text-right"><button type="button" onClick={() => openClassification(item)} aria-label={`Classificar pedido #${item.pedido}`} className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 font-semibold text-cyan-100 hover:bg-cyan-400/20">Classificar</button></td></tr>)}</tbody>
        </table></div>
        {result.unclassifiedCount > result.classificationIssues.length && <p className="border-t border-white/10 px-5 py-3 text-xs text-slate-400">Exibindo os primeiros {result.classificationIssues.length} de {result.unclassifiedCount.toLocaleString("pt-BR")} itens. Filtre por filial/período para localizar os demais.</p>}
      </section>}
      {result.needsReview > 0 && <section role="region" aria-label="Condições de pagamento a conferir" className="erp-surface overflow-hidden rounded-2xl border border-amber-400/20">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 p-5">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-amber-100"><AlertTriangle size={17} /> Condições de pagamento a conferir</h3>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">Pedidos com condição ambígua não recebem datas estimadas automaticamente. Confirme as parcelas no SISCOM antes de considerar esses valores no planejamento.</p>
          </div>
          <span className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-xs font-bold tabular-nums text-amber-100">{result.needsReview.toLocaleString("pt-BR")} item(ns) · {currency.format(result.unscheduledAmount)} sem programação</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-xs">
            <thead className="bg-[#0b1b2e] text-[10px] font-bold uppercase tracking-wider text-slate-400"><tr>
              <th className="px-5 py-3">Pedido / filial</th><th className="px-4 py-3">Fornecedor</th><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Condição recebida</th><th className="px-5 py-3 text-right">Saldo não programado</th>
            </tr></thead>
            <tbody className="divide-y divide-white/10">
              {result.termsToReview.map((item, index) => <tr key={`${item.loja}-${item.pedido}-${item.produto_codigo}-${index}`} className="transition-colors hover:bg-cyan-400/5">
                <td className="px-5 py-3"><p className="font-bold text-cyan-300">#{item.pedido}</p><p className="mt-1 text-[10px] text-slate-400">{item.loja}</p></td>
                <td className="max-w-56 px-4 py-3 text-slate-200">{item.fornecedor_nome ?? "Fornecedor não informado"}</td>
                <td className="px-4 py-3 text-slate-200">{item.produto_codigo}</td>
                <td className="px-4 py-3"><span className="rounded-md border border-amber-400/25 bg-amber-400/10 px-2 py-1 font-semibold text-amber-100">{item.condicao_pagamento ?? "Não informada"}</span></td>
                <td className="px-5 py-3 text-right font-bold tabular-nums text-amber-200">{currency.format(item.valor_pendente)}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        {result.needsReview > result.termsToReview.length && <p className="border-t border-white/10 px-5 py-3 text-xs text-slate-400">Exibindo os primeiros {result.termsToReview.length} de {result.needsReview.toLocaleString("pt-BR")} itens dos filtros. Refine por filial ou período para conferir os demais.</p>}
      </section>}
    </>}
    <p className="flex items-start gap-2 rounded-xl border border-amber-300/15 bg-amber-300/5 px-4 py-3 text-xs leading-5 text-amber-100"><AlertTriangle size={15} className="mt-0.5 shrink-0" /> Simulação não contabilizada: os totais brutos não deduplicam outras contas financeiras e os elegíveis exigem classificação integral para comparação com a linha de compras do caixa. Nenhum valor foi lançado em Caixa, OTB ou Contas a Pagar.</p>
    {classificationItem && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#020713]/85 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !classificationSaving) setClassificationItem(null) }}>
      <div role="dialog" aria-modal="true" aria-label="Classificação financeira do pedido" className="w-full max-w-xl rounded-2xl border border-cyan-400/30 bg-[#0d1b2f] p-6 shadow-[0_20px_90px_rgba(0,0,0,.65)]">
        <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-cyan-300">Cadastro complementar · Compras</p><h3 className="mt-1 text-lg font-bold text-white">Classificar pedido #{classificationItem.pedido}</h3><p className="mt-1 text-xs text-slate-400">{classificationItem.loja} · SKU {classificationItem.produto_codigo} · Saldo {currency.format(classificationItem.valor_pendente)}</p></div><button type="button" aria-label="Fechar classificação" onClick={() => setClassificationItem(null)} disabled={classificationSaving} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X size={19}/></button></div>
        <div className="mt-6 space-y-4"><div><label htmlFor="classification-group" className="mb-2 block text-xs font-bold text-slate-200">Grupo/subgrupo</label><input id="classification-group" list="classification-suggestions" value={classificationValue} onChange={(event) => setClassificationValue(event.target.value)} placeholder="Ex.: 5.DESPESAS / LOGISTICA / FRETE" maxLength={200} autoFocus className="w-full rounded-lg border border-white/20 bg-[#081525] px-3 py-3 text-sm text-white outline-none focus:border-cyan-400"/><datalist id="classification-suggestions">{CLASSIFICATION_SUGGESTIONS.map((category) => <option key={category} value={category}/>)}</datalist><p className="mt-2 text-xs text-slate-400">Sugestões da Zacarini; você pode informar outro grupo/subgrupo do cadastro. Prefixo 5. indica despesa.</p></div><div><label htmlFor="classification-reason" className="mb-2 block text-xs font-bold text-slate-200">Motivo / evidência</label><textarea id="classification-reason" value={classificationReason} onChange={(event) => setClassificationReason(event.target.value)} maxLength={500} rows={3} placeholder="Justifique a classificação confirmada pelo comprador" className="w-full resize-y rounded-lg border border-white/20 bg-[#081525] px-3 py-3 text-sm text-white outline-none focus:border-cyan-400"/></div></div>
        {classificationError && <p role="alert" className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-xs text-rose-200">{classificationError}</p>}
        <div className="mt-5 flex justify-end gap-3"><button type="button" disabled={classificationSaving} onClick={() => setClassificationItem(null)} className="rounded-lg border border-white/15 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/5">Voltar</button><button type="button" disabled={classificationSaving} onClick={() => void saveClassification()} className="rounded-lg bg-cyan-400 px-4 py-2.5 text-xs font-black text-[#052035] hover:bg-cyan-300 disabled:opacity-50">{classificationSaving ? "Salvando…" : "Salvar classificação"}</button></div>
      </div>
    </div>}
  </div>
}
