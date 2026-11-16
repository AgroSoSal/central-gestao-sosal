"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, BarChart3, CheckCircle2, LoaderCircle, RefreshCw } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import {
  consolidatePurchaseForecast,
  type ConsolidatedPurchaseForecast,
  type ForecastDecision,
  type ForecastFollowUp,
  type ForecastKey,
  type ForecastSourceItem,
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

export function GlobalPaymentForecast({ filters, dataBase, genericCodes, expectedTotal, viewerId }: Props) {
  const [round, setRound] = useState(0)
  const [progress, setProgress] = useState({ processed: 0, total: expectedTotal })
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [result, setResult] = useState<ConsolidatedPurchaseForecast | null>(null)
  const [error, setError] = useState("")
  const genericCodesKey = genericCodes.join(",")
  const cacheKey = JSON.stringify([viewerId, filters.busca, filters.loja, filters.inicio, filters.fim, dataBase, genericCodesKey, expectedTotal])

  const recalculate = () => {
    setStatus("loading")
    setResult(null)
    setError("")
    setProgress({ processed: 0, total: expectedTotal })
    setRound((n) => n + 1)
  }

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
        const { data, error: rpcError } = await supabase.rpc("fn_listar_decisoes_compra", { p_chaves: keys(rows) })
        if (rpcError) throw new Error("As decisões de compra não puderam ser consultadas integralmente.")
        return (data ?? []) as ForecastDecision[]
      },
      loadFollowUps: async (rows) => {
        const { data, error: rpcError } = await supabase.rpc("fn_listar_followup_compras", { p_chaves: keys(rows) })
        if (rpcError) throw new Error("As previsões registradas no Follow-up não puderam ser consultadas integralmente.")
        return (data ?? []) as ForecastFollowUp[]
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
          <p className="mt-1 max-w-3xl text-xs leading-6 text-slate-400">Cálculo de leitura sobre todos os itens da consulta, independentemente da página da tabela. As NFs, decisões e datas do Follow-up são consideradas em cada lote.</p>
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
      <section role="group" aria-label="Indicadores financeiros globais" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[{ label: "Vence nas 26 semanas", amount: result.inHorizonAmount, color: "text-cyan-200" }, { label: "Já vencido", amount: result.overdueAmount, color: "text-rose-200" }, { label: "Vence depois", amount: result.afterHorizonAmount, color: "text-blue-200" }, { label: "Condição a conferir", amount: result.unscheduledAmount, color: "text-amber-200" }, { label: "Fora por Segurar/Cancelar", amount: result.excludedByDecision, color: "text-slate-300" }].map((card) => <div key={card.label} className="erp-surface rounded-xl p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{card.label}</p><p className={`mt-3 text-xl font-black tabular-nums ${card.color}`}>{currency.format(card.amount)}</p><p className="mt-2 text-[10px] text-emerald-300/90">Todos os {result.totalItems.toLocaleString("pt-BR")} itens dos filtros</p></div>)}
      </section>
      {(result.needsReview > 0 || result.unreconciled > 0) && <p role="note" className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs text-amber-100">Exceções: {result.needsReview} item(ns) com condição de pagamento a conferir; {result.unreconciled} item(ns) sem conciliação suficiente. Esses itens não geram vencimentos fictícios.</p>}
      <PaymentForecastCalendar weeks={result.weeks} />
    </>}
    <p className="flex items-start gap-2 rounded-xl border border-amber-300/15 bg-amber-300/5 px-4 py-3 text-xs leading-5 text-amber-100"><AlertTriangle size={15} className="mt-0.5 shrink-0" /> Simulação bruta: a planilha Zacarini exclui despesas de subgrupos 5. da linha de compras do fluxo de caixa. A consulta atual não fornece a classificação de cada pedido; portanto, este total ainda não é um lançamento deduplicado do caixa/OTB.</p>
  </div>
}
