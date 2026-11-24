"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, CalendarClock, Check, History, Loader2, PackageCheck, Truck } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { getBranchDisplayName } from "@/domains/compras/domain/branches"
import { decisionKey } from "@/domains/compras/domain/purchase-decisions"
import type { ManagementPurchaseItem } from "./management-table"

export type FollowUpHistory = { quando: string; por: string; anterior: Record<string, unknown> | null; novo: Record<string, unknown> }
export type FollowUpRecord = {
  loja: string; pedido: string; produto_codigo: string
  previsao_entrega: string | null; proximo_contato: string | null
  retorno_fornecedor: string | null; posicionamento_comprador: string | null
  transportadora: string | null; codigo_rastreio: string | null
  status_entrega: string; atualizado_em: string; alteracoes: FollowUpHistory[]
}
export type FollowUpRow = { item: ManagementPurchaseItem; tracking: FollowUpRecord | null }

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const quantity = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 })
const steps = ["Aguardando fornecedor", "Previsão informada", "Em transporte", "Ocorrência de entrega", "Entrega parcial"] as const

function amount(value: number | string | null): number { return Number.isFinite(Number(value)) ? Number(value) : 0 }
function keyOf(row: FollowUpRow): string { return decisionKey(row.item.loja ?? "", row.item.pedido ?? "", row.item.produto_codigo ?? "") }
function dateOnly(value: string | null): string { return value?.slice(0, 10) ?? "" }
function dateBR(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return "—"
  const [year, month, day] = value.slice(0, 10).split("-")
  return `${day}/${month}/${year}`
}
function isOverdue(date: string | null): boolean {
  if (!date) return false
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Campo_Grande", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
  return date.slice(0, 10) < today
}

function FollowUpEditor({ row, trackingAvailable }: { row: FollowUpRow; trackingAvailable: boolean }) {
  const router = useRouter()
  const { item, tracking } = row
  const [previsao, setPrevisao] = useState(dateOnly(tracking?.previsao_entrega ?? null))
  const [proximo, setProximo] = useState(dateOnly(tracking?.proximo_contato ?? null))
  const [fornecedor, setFornecedor] = useState(tracking?.retorno_fornecedor ?? "")
  const [comprador, setComprador] = useState(tracking?.posicionamento_comprador ?? "")
  const [transportadora, setTransportadora] = useState(tracking?.transportadora ?? "")
  const [rastreio, setRastreio] = useState(tracking?.codigo_rastreio ?? "")
  const [etapa, setEtapa] = useState(tracking?.status_entrega ?? "Aguardando fornecedor")
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState("")
  const dirty = previsao !== dateOnly(tracking?.previsao_entrega ?? null)
    || proximo !== dateOnly(tracking?.proximo_contato ?? null)
    || fornecedor.trim() !== (tracking?.retorno_fornecedor ?? "")
    || comprador.trim() !== (tracking?.posicionamento_comprador ?? "")
    || transportadora.trim() !== (tracking?.transportadora ?? "")
    || rastreio.trim() !== (tracking?.codigo_rastreio ?? "")
    || etapa !== (tracking?.status_entrega ?? "Aguardando fornecedor")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!trackingAvailable || !dirty || busy) return
    const client = createSupabaseBrowserClient()
    if (!client) { setFeedback("Conexão indisponível. Nenhuma informação foi salva."); return }
    setBusy(true)
    setFeedback("")
    try {
      const { error } = await client.rpc("fn_salvar_followup_compra", {
        p_loja: item.loja, p_pedido: item.pedido, p_produto_codigo: item.produto_codigo,
        p_previsao_entrega: previsao || null, p_proximo_contato: proximo || null,
        p_retorno_fornecedor: fornecedor.trim() || null,
        p_posicionamento_comprador: comprador.trim() || null,
        p_transportadora: transportadora.trim() || null,
        p_codigo_rastreio: rastreio.trim() || null,
        p_status_entrega: etapa,
      })
      if (error) { setFeedback(error.code === "42501" ? "Sua conta não tem permissão Master ativa. Nada foi salvo." : error.code === "22023" ? "O item saiu da fila de entregas, foi retido ou teve os dados alterados. Atualize a tela antes de salvar." : "Não foi possível salvar o acompanhamento. Confira a conexão e tente novamente."); return }
      setFeedback("Acompanhamento registrado. Recarregando histórico e previsões…")
      router.refresh()
    } catch {
      setFeedback("Falha de rede. Verifique o histórico antes de tentar novamente.")
    } finally { setBusy(false) }
  }

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,1fr)]">
    <div>
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.17em] text-cyan-300"><Truck size={15} /> Pendência de entrega registrada por produto</p>
      <h3 className="mt-3 text-xl font-bold text-white">Pedido #{item.pedido} · {getBranchDisplayName(item.loja ?? "")}</h3>
      <p className="mt-2 text-sm text-slate-200">{item.descricao}</p>
      <p className="mt-1 text-xs text-slate-400">Fornecedor: {item.fornecedor_nome}</p>
      <div className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-400/[.07] p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-100/70">Saldo pendente de entrega</p>
        <p className="mt-2 text-3xl font-black tracking-tight text-amber-200">{quantity.format(amount(item.quantidade_pendente))} unidades pendentes</p>
        <p className="mt-3 text-lg font-bold text-white">{item.valor_pendente === null ? "Valor ainda não conciliado" : money.format(amount(item.valor_pendente))}</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-700/70" role="progressbar" aria-label="Progresso da entrega" aria-valuemin={0} aria-valuemax={100} aria-valuenow={amount(item.quantidade) > 0 ? Math.min(100, Math.max(0, Math.round(amount(item.quantidade_recebida) / amount(item.quantidade) * 100))) : 0}><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400" style={{ width: `${amount(item.quantidade) > 0 ? Math.min(100, Math.max(0, amount(item.quantidade_recebida) / amount(item.quantidade) * 100)) : 0}%` }} /></div>
        <p className="mt-2 text-xs text-slate-400">Recebidas {quantity.format(amount(item.quantidade_recebida))} de {quantity.format(amount(item.quantidade))} pedidas · {item.situacao_recebimento}</p>
      </div>
      {isOverdue(previsao) && <p className="mt-4 flex items-center gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-xs font-semibold text-rose-200"><AlertTriangle size={15} /> Previsão de entrega vencida: {dateBR(previsao)}</p>}
      {!!tracking?.alteracoes?.length && <div className="mt-5 rounded-xl border border-white/10 p-4"><h4 className="flex items-center gap-2 text-xs font-bold text-slate-200"><History size={14} /> Histórico auditado ({tracking.alteracoes.length})</h4><ol className="mt-3 max-h-64 space-y-3 overflow-auto">{tracking.alteracoes.map((entry, index) => <li key={`${entry.quando}-${index}`} className="border-l border-cyan-400/25 pl-3 text-xs text-slate-400"><span className="text-slate-200">{new Date(entry.quando).toLocaleString("pt-BR", { timeZone: "America/Campo_Grande" })}</span> · {entry.por}<p className="mt-1 font-semibold text-cyan-200">{String(entry.novo.status_entrega ?? "Acompanhamento atualizado")} · Previsão {dateBR(typeof entry.novo.previsao_entrega === "string" ? entry.novo.previsao_entrega : null)}</p>{!!entry.novo.retorno_fornecedor && <p className="mt-1 break-words text-[11px]">Fornecedor: {String(entry.novo.retorno_fornecedor)}</p>}{!!entry.novo.posicionamento_comprador && <p className="mt-1 break-words text-[11px]">Comprador: {String(entry.novo.posicionamento_comprador)}</p>}</li>)}</ol></div>}
    </div>
    <div className="rounded-2xl border border-cyan-400/15 bg-[#081625] p-5 sm:p-6">
      <h4 className="mb-1 flex items-center gap-2 text-sm font-bold text-white"><CalendarClock size={17} className="text-cyan-300" /> Atualização de Follow-up</h4>
      <p className="mb-5 text-xs leading-5 text-slate-400">O comprador registra a resposta do fornecedor e a próxima previsão. Nenhuma mudança é enviada ao SISCOM.</p>
      {!trackingAvailable && <p role="alert" className="mb-4 rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">O registro de Follow-up ainda não foi habilitado no banco. É possível consultar o saldo, mas os campos não podem ser salvos.</p>}
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-slate-300">Previsão de entrega<input aria-label="Previsão de entrega" type="date" className="erp-field mt-2 px-3" value={previsao} disabled={!trackingAvailable || busy} onChange={(event) => setPrevisao(event.target.value)} /></label>
          <label className="block text-xs font-semibold text-slate-300">Próxima cobrança<input aria-label="Próxima cobrança" type="date" className="erp-field mt-2 px-3" value={proximo} disabled={!trackingAvailable || busy} onChange={(event) => setProximo(event.target.value)} /></label>
        </div>
        <label className="block text-xs font-semibold text-slate-300">Situação logística<select className="erp-field mt-2 px-3" value={etapa} disabled={!trackingAvailable || busy} onChange={(event) => setEtapa(event.target.value)}>{steps.map((step) => <option key={step}>{step}</option>)}</select></label>
        <label className="block text-xs font-semibold text-slate-300">Resposta do fornecedor<textarea className="erp-field mt-2 resize-y px-3 py-2" rows={3} maxLength={1000} value={fornecedor} disabled={!trackingAvailable || busy} onChange={(event) => setFornecedor(event.target.value)} placeholder="Data do retorno, condições e justificativa informada…" /></label>
        <label className="block text-xs font-semibold text-slate-300">Posicionamento do comprador<textarea className="erp-field mt-2 resize-y px-3 py-2" rows={3} maxLength={1000} value={comprador} disabled={!trackingAvailable || busy} onChange={(event) => setComprador(event.target.value)} placeholder="Cobrança realizada, ações e próximos passos…" /></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="block text-xs font-semibold text-slate-300">Transportadora<input className="erp-field mt-2 px-3" maxLength={150} value={transportadora} disabled={!trackingAvailable || busy} onChange={(event) => setTransportadora(event.target.value)} placeholder="Se informada" /></label><label className="block text-xs font-semibold text-slate-300">Código de rastreio<input className="erp-field mt-2 px-3" maxLength={150} value={rastreio} disabled={!trackingAvailable || busy} onChange={(event) => setRastreio(event.target.value)} placeholder="Rastreio / conhecimento" /></label></div>
        <button type="submit" disabled={!trackingAvailable || !dirty || busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35">{busy ? <><Loader2 size={16} className="animate-spin" /> Salvando…</> : <><Check size={16} /> Salvar acompanhamento</>}</button>
        {feedback && <p role="status" className="text-xs text-cyan-200">{feedback}</p>}
      </form>
    </div>
  </div>
}

export function FollowUpTable({ rows, trackingAvailable }: { rows: FollowUpRow[]; trackingAvailable: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = rows.find((row) => keyOf(row) === selectedId)

  return <div className="space-y-4">
    <section className="erp-surface overflow-hidden rounded-2xl border border-cyan-400/15">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0d2034] px-5 py-4"><h2 className="flex items-center gap-2 text-sm font-bold text-white"><Truck size={16} className="text-cyan-300" /> Aguardando entrega do fornecedor</h2><span className="text-xs text-slate-400">{rows.length} item(ns) deste lote · Clique para acompanhar</span></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1020px] text-left text-[12px]"><thead className="bg-[#111d30] text-[10px] uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-4">Pedido</th><th className="px-5 py-4">Filial</th><th className="px-5 py-4">Fornecedor</th><th className="px-5 py-4">Produto</th><th className="px-5 py-4 text-right">Recebida</th><th className="px-5 py-4 text-right">Saldo pendente</th><th className="px-5 py-4 text-right">Valor pendente</th><th className="px-5 py-4">Previsão</th><th className="px-5 py-4">Rastreabilidade</th></tr></thead><tbody className="divide-y divide-white/[.07]">
        {rows.map((row) => <tr key={keyOf(row)} tabIndex={0} aria-selected={selectedId === keyOf(row)} onClick={() => setSelectedId(keyOf(row))} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(keyOf(row)) } }} className={`cursor-pointer text-slate-200 outline-none transition hover:bg-cyan-400/[.08] focus-visible:bg-cyan-400/10 ${selectedId === keyOf(row) ? "bg-cyan-400/[.12]" : ""}`}>
          <td className="whitespace-nowrap px-5 py-4 font-bold text-cyan-300">#{row.item.pedido}</td><td className="px-5 py-4">{getBranchDisplayName(row.item.loja ?? "")}</td><td className="max-w-48 truncate px-5 py-4" title={row.item.fornecedor_nome ?? ""}>{row.item.fornecedor_nome}</td><td className="max-w-48 truncate px-5 py-4" title={row.item.descricao ?? ""}>{row.item.descricao}</td><td className="px-5 py-4 text-right tabular-nums text-cyan-200">{quantity.format(amount(row.item.quantidade_recebida))}</td><td className="px-5 py-4 text-right font-black tabular-nums text-amber-200">{quantity.format(amount(row.item.quantidade_pendente))}</td><td className="whitespace-nowrap px-5 py-4 text-right font-bold text-amber-200">{row.item.valor_pendente === null ? "—" : money.format(amount(row.item.valor_pendente))}</td><td className="whitespace-nowrap px-5 py-4">{!trackingAvailable ? <span className="text-slate-500">Indisponível</span> : row.tracking?.previsao_entrega ? <span className={isOverdue(row.tracking.previsao_entrega) ? "font-bold text-rose-300" : "text-slate-200"}>{dateBR(row.tracking.previsao_entrega)}{isOverdue(row.tracking.previsao_entrega) ? " · Atrasado" : ""}</span> : <span className="text-amber-200">Sem previsão</span>}</td><td className="px-5 py-4"><span className="whitespace-nowrap text-xs text-slate-300">{trackingAvailable ? (row.tracking?.status_entrega ?? "Aguardando fornecedor") : "Indisponível"}</span></td>
        </tr>)}
      </tbody></table></div>
      {rows.length === 0 && <div className="px-6 py-14 text-center"><PackageCheck className="mx-auto mb-4 text-emerald-400" size={30} /><h3 className="font-semibold text-white">Nenhum item aprovado com saldo pendente neste lote</h3><p className="mt-2 text-xs text-slate-400">A decisão vazia equivale a Aprovado pela regra da Zacarini. Confira outros lotes, filtros ou os itens já entregues.</p></div>}
    </section>
    <section className="erp-surface rounded-2xl border border-cyan-400/20 p-5 sm:p-7" aria-label="Detalhamento do follow-up">
      {selected ? <FollowUpEditor key={keyOf(selected)} row={selected} trackingAvailable={trackingAvailable} /> : <p className="flex items-center gap-3 text-sm text-slate-400"><Truck size={19} className="text-cyan-300" /> Selecione um pedido na tabela para ver o saldo e atualizar seu acompanhamento.</p>}
    </section>
  </div>
}
