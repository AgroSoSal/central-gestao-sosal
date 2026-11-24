"use client"

import { useState } from "react"
import { FileSearch, Loader2, ChevronLeft, ChevronRight, ShieldAlert } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

type Entry = {
  data: string | null
  nf: string | null
  filial: string | null
  produto_cod: string | null
  fornecedor: string | null
  operacao: string | null
  qtde: number | string | null
  valor: number | string | null
  dev: boolean | null
}
type Evidence = {
  source: "ZACARINI_238_NF_EVIDENCIAS"
  status: "disponivel" | "codigo_generico"
  criterio?: string
  descricao?: string
  pagina?: number
  tamanho?: number
  total: number
  itens: Entry[]
  pedido?: {
    quantidade: number | string | null
    quantidade_recebida: number | string | null
    quantidade_pendente: number | string | null
    filial_nf: string
    calculado_em: string | null
  }
}
type Props = { loja: string; pedido: string; produtoCodigo: string }
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 })
const PAGE_SIZE = 20

function isEvidence(value: unknown): value is Evidence {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const row = value as Partial<Evidence>
  return row.source === "ZACARINI_238_NF_EVIDENCIAS"
    && (row.status === "disponivel" || row.status === "codigo_generico")
    && typeof row.total === "number"
    && Number.isInteger(row.total) && row.total >= 0
    && Array.isArray(row.itens)
    && row.itens.length <= PAGE_SIZE
}
function decimal(value: number | string | null) {
  return value === null || !Number.isFinite(Number(value)) ? "—" : number.format(Number(value))
}
function currency(value: number | string | null) {
  return value === null || !Number.isFinite(Number(value)) ? "—" : money.format(Number(value))
}
function date(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(8,10)+"/"+value.slice(5,7)+"/"+value.slice(0,4) : "—"
}

/**
 * A planilha usa SUMIFS + MINIFS em Pedidos de Compra!L12.
 * A consulta mostra NFs candidatas, NÃO aponta a NF como recebimento deste pedido.
 * Nenhum clique grava recebimento ou modifica o SISCOM.
 */
export function PurchaseNfEvidence({ loja, pedido, produtoCodigo }: Props) {
  const [opened, setOpened] = useState(false)
  const [busy, setBusy] = useState(false)
  const [page, setPage] = useState(1)
  const [evidence, setEvidence] = useState<Evidence | null>(null)
  const [message, setMessage] = useState("")

  async function load(nextPage: number) {
    const client = createSupabaseBrowserClient()
    if (!client) { setMessage("Supabase indisponível. Nenhuma informação foi presumida."); return }
    setOpened(true)
    setBusy(true)
    setMessage("")
    try {
      const { data, error } = await client.rpc("fn_compras_evidencias_nf_238", {
        p_loja:loja, p_pedido:pedido, p_produto_codigo:produtoCodigo,
        p_pagina:nextPage, p_tamanho:PAGE_SIZE,
      })
      if (error) {
        setMessage(error.code === "42501" ? "Consulta exclusiva do perfil Master ativo." :
          error.code === "22023" ? "O item não foi localizado na carteira atual. Atualize a página." :
          "Não foi possível consultar as NFs de entrada. Nenhum recebimento foi presumido.")
        return
      }
      if (!isEvidence(data)) {
        setMessage("Formato de evidência inválido. Não é seguro exibir o resultado.")
        return
      }
      setEvidence(data)
      setPage(nextPage)
    } catch {
      setMessage("Falha de rede ao consultar as NFs. Nenhum registro foi modificado.")
    } finally { setBusy(false) }
  }

  return <section className="rounded-2xl border border-cyan-400/20 bg-[#081625] p-4 sm:p-5" aria-label="Evidências de entradas fiscais">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-bold text-white"><FileSearch size={17} className="text-cyan-300"/> Evidências de NFs de entrada</h3>
        <p className="mt-1 text-[11px] leading-5 text-slate-400">Critério L da última Zacarini 2.3.8 · somente leitura</p>
      </div>
      <button type="button" disabled={busy}
        onClick={() => opened ? (setOpened(false)) : load(page)}
        className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-200 transition hover:bg-cyan-400/15 disabled:opacity-50">
        {busy ? <Loader2 size={14} className="animate-spin"/> : <FileSearch size={14}/>}
        {opened ? "Ocultar evidências" : "Consultar NFs"}
      </button>
    </div>
    {opened && <>
      <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300/20 bg-amber-300/[.06] p-3 text-[11px] leading-5 text-amber-100">
        <ShieldAlert size={16} className="mt-0.5 shrink-0"/>
        <p>As NFs são candidatas pelo filtro de filial, SKU, data e fornecedor da planilha. <strong>Não comprovam vínculo exclusivo nem baixa do pedido.</strong> A quantidade recebida continua calculada separadamente considerando pedidos anteriores.</p>
      </div>
      {message && <p role="alert" className="mt-3 text-xs text-amber-200">{message}</p>}
      {busy && <p role="status" className="mt-3 text-xs text-cyan-200">Consultando registros fiscais no Supabase…</p>}
      {evidence?.status === "codigo_generico" && <p role="status" className="mt-3 text-xs text-slate-300">{evidence.descricao}</p>}
      {evidence?.status === "disponivel" && <>
        <div className="mt-4 flex flex-wrap justify-between gap-2 text-xs text-slate-300">
          <span>{number.format(evidence.total)} NF(s) candidatas · filial fiscal {evidence.pedido?.filial_nf ?? "—"}</span>
          <span>Recebida no cálculo: <strong className="text-cyan-200">{decimal(evidence.pedido?.quantidade_recebida ?? null)}</strong> · Pendente: <strong className="text-amber-200">{decimal(evidence.pedido?.quantidade_pendente ?? null)}</strong></span>
        </div>
        <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-slate-700/70">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="sticky top-0 bg-[#14243b] text-slate-300"><tr><th className="px-3 py-2">Data</th><th className="px-3 py-2">NF</th><th className="px-3 py-2">Fornecedor</th><th className="px-3 py-2 text-right">Qtde NF</th><th className="px-3 py-2 text-right">Valor NF</th></tr></thead>
            <tbody className="divide-y divide-slate-800">{evidence.itens.map((n,i)=><tr key={String(n.nf)+"|"+String(n.data)+"|"+i}>
              <td className="whitespace-nowrap px-3 py-2 text-slate-300">{date(n.data)}</td>
              <td className="px-3 py-2 font-semibold text-cyan-200">{n.nf ?? "—"}</td>
              <td className="px-3 py-2 text-slate-300">{n.fornecedor ?? "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{decimal(n.qtde)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{currency(n.valor)}</td>
            </tr>)}</tbody>
          </table>
          {evidence.itens.length===0 && <p className="p-4 text-xs text-slate-400">Nenhuma NF candidata localizada com os critérios do Excel.</p>}
        </div>
        {evidence.total > PAGE_SIZE && <div className="mt-3 flex items-center justify-end gap-3 text-xs text-slate-300">
          <button type="button" disabled={busy||page<=1} onClick={() => load(page-1)} aria-label="NFs anteriores" className="rounded-lg border border-white/15 p-2 disabled:opacity-30"><ChevronLeft size={14}/></button>
          Página {page} / {Math.ceil(evidence.total/PAGE_SIZE)}
          <button type="button" disabled={busy||page>=Math.ceil(evidence.total/PAGE_SIZE)} onClick={() => load(page+1)} aria-label="Próximas NFs" className="rounded-lg border border-white/15 p-2 disabled:opacity-30"><ChevronRight size={14}/></button>
        </div>}
      </>}
    </>}
  </section>
}
