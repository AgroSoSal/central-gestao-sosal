"use client"

import { useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { CircleCheck, ClipboardPenLine, PackageOpen, X } from "lucide-react"
import { getBranchDisplayName } from "@/domains/compras/domain/branches"
import { decisionKey, operationalDecision, type PurchaseDecisionRecord } from "@/domains/compras/domain/purchase-decisions"
import { PurchaseDecisionEditor } from "./purchase-decision-editor"
import { PurchaseSubgroupEditor } from "./purchase-subgroup-editor"

export type ManagementPurchaseItem = {
  loja: string | null; pedido: string | null; produto_codigo: string | null
  descricao: string | null; fornecedor_nome: string | null; fornecedor_codigo: string | null
  data_pedido: string | null; quantidade: number | string | null
  quantidade_recebida: number | string | null; quantidade_pendente: number | string | null
  valor_total: number | string | null; valor_pendente: number | string | null
  situacao_recebimento: string | null
}

export type ManagementTableRow = { item: ManagementPurchaseItem; record: PurchaseDecisionRecord | null }

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const quantity = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 })
type Tab = "pendentes" | "aprovados" | "retidos"

const tabs: { id: Tab; text: string }[] = [
  { id: "pendentes", text: "Aguardando aprovação" },
  { id: "aprovados", text: "Aprovados" },
  { id: "retidos", text: "Segurados / cancelados" },
]

function toNumber(value: number | string | null): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function dateBR(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return "—"
  const [year, month, day] = value.slice(0, 10).split("-")
  return `${day}/${month}/${year}`
}

function tabFor(record: PurchaseDecisionRecord | null): Tab {
  if (!record) return "pendentes"
  return record.decisao === "Aprovado" || record.decisao === "Já pago" ? "aprovados" : "retidos"
}

function rowId(row: ManagementTableRow): string {
  return decisionKey(row.item.loja ?? "", row.item.pedido ?? "", row.item.produto_codigo ?? "")
}

export function ManagementTable({ rows }: { rows: ManagementTableRow[] }) {
  const [tab, setTab] = useState<Tab>("pendentes")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const visible = rows.filter((row) => tabFor(row.record) === tab)
  const selected = visible.find((row) => rowId(row) === selectedId)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar aprovação operacional">
        {tabs.map(({ id, text }) => {
          const count = rows.filter((row) => tabFor(row.record) === id).length
          return <button key={id} type="button" aria-pressed={tab === id} onClick={() => { setTab(id); setSelectedId(null) }} className={`rounded-xl border px-4 py-2.5 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-cyan-300 ${tab === id ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-100 shadow-[0_0_20px_-12px_#22d3ee]" : "border-white/10 bg-white/[.035] text-slate-400 hover:text-white"}`}>{text} <span className="ml-1 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px]">{count}</span></button>
        })}
      </div>

      <div className="erp-surface overflow-hidden rounded-2xl border border-[#2b4058]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0d2034] px-5 py-4">
          <h3 className="text-sm font-bold text-slate-100">{tabs.find((item) => item.id === tab)?.text}</h3>
          <span className="text-xs text-slate-400">{visible.length} item(ns) neste lote · Selecione uma linha para gerenciar</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-left text-[12px]">
            <thead className="bg-[#111d30] text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <tr><th className="px-5 py-4">Pedido</th><th className="px-5 py-4">Filial / Data</th><th className="px-5 py-4">Fornecedor</th><th className="px-5 py-4">Produto</th><th className="px-5 py-4 text-right">Pedida</th><th className="px-5 py-4 text-right">Recebida</th><th className="px-5 py-4 text-right">Pendente</th><th className="px-5 py-4 text-right">Valor pendente</th><th className="px-5 py-4">Decisão</th></tr>
            </thead>
            <tbody className="divide-y divide-white/[.07]">
              {visible.map((row) => {
                const { item, record } = row
                const id = rowId(row)
                const selectedRow = selectedId === id
                const decision = operationalDecision(record?.decisao)
                return <tr key={id} tabIndex={0} aria-selected={selectedRow} onClick={() => setSelectedId(id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(id) } }} className={`cursor-pointer text-slate-200 outline-none transition hover:bg-cyan-400/[.08] focus-visible:bg-cyan-400/10 ${selectedRow ? "bg-cyan-400/[.13] ring-1 ring-inset ring-cyan-300/30" : ""}`}>
                  <td className="px-5 py-4 font-bold text-cyan-300">#{item.pedido}</td>
                  <td className="whitespace-nowrap px-5 py-4"><span className="font-semibold">{getBranchDisplayName(item.loja ?? "")}</span><span className="mt-1 block text-[11px] text-slate-500">{dateBR(item.data_pedido)}</span></td>
                  <td className="max-w-[200px] px-5 py-4 font-medium"><span className="block truncate" title={item.fornecedor_nome ?? ""}>{item.fornecedor_nome ?? "—"}</span></td>
                  <td className="max-w-[220px] px-5 py-4"><span className="block truncate" title={item.descricao ?? ""}>{item.descricao ?? "—"}</span><span className="text-[11px] text-slate-500">SKU {item.produto_codigo}</span></td>
                  <td className="px-5 py-4 text-right tabular-nums">{quantity.format(toNumber(item.quantidade))}</td>
                  <td className="px-5 py-4 text-right tabular-nums text-cyan-200">{quantity.format(toNumber(item.quantidade_recebida))}</td>
                  <td className="px-5 py-4 text-right font-bold tabular-nums text-amber-200">{quantity.format(toNumber(item.quantidade_pendente))}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-bold text-amber-200">{item.valor_pendente === null ? "—" : money.format(toNumber(item.valor_pendente))}</td>
                  <td className="px-5 py-4"><span className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${record?.decisao === "Aprovado" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : record?.decisao === "Já pago" ? "border-violet-400/20 bg-violet-400/10 text-violet-200" : record ? "border-rose-400/20 bg-rose-400/10 text-rose-200" : "border-amber-400/20 bg-amber-400/10 text-amber-200"}`}>{decision}</span></td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
        {visible.length === 0 && <div className="px-6 py-12 text-center text-slate-400"><CircleCheck size={26} className="mx-auto mb-3 text-cyan-300" />Nenhum pedido nesta situação neste lote. Os próximos lotes podem conter outros itens.</div>}
      </div>

      <Dialog.Root open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelectedId(null) }}>
        {selected && <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-[#010711]/80 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[110] flex max-h-[92dvh] w-[calc(100vw-2rem)] max-w-[760px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-cyan-300/20 bg-[#091524] text-slate-100 shadow-[0_34px_100px_-30px_rgba(0,0,0,.95)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-cyan-300/15 bg-gradient-to-br from-[#112a40] via-[#0d2034] to-[#091524] px-5 py-5 sm:px-7">
              <div className="min-w-0">
                <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.17em] text-cyan-300"><PackageOpen size={15} /> Gestão de compras</p>
                <Dialog.Title className="text-xl font-bold tracking-tight text-white">Gerenciar pedido #{selected.item.pedido}</Dialog.Title>
                <Dialog.Description className="mt-1.5 text-xs text-slate-400">{getBranchDisplayName(selected.item.loja ?? "")} · {dateBR(selected.item.data_pedido)} · SKU {selected.item.produto_codigo}</Dialog.Description>
              </div>
              <Dialog.Close aria-label="Fechar painel" className="shrink-0 rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 transition hover:border-cyan-400/30 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300"><X size={18} /></Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-6 sm:px-7">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Produto</p>
                <p className="mt-1 text-sm font-semibold text-white">{selected.item.descricao ?? "—"}</p>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Fornecedor</p>
                <p className="mt-1 text-sm text-slate-200">{selected.item.fornecedor_nome ?? "—"}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-amber-300/15 bg-amber-400/[.07] p-4"><p className="text-[10px] uppercase tracking-wider text-slate-400">Saldo da entrega</p><p className="mt-2 text-lg font-bold text-amber-200">{quantity.format(toNumber(selected.item.quantidade_pendente))} unidades pendentes</p><p className="mt-1 text-xs text-slate-400">Recebidas: {quantity.format(toNumber(selected.item.quantidade_recebida))} de {quantity.format(toNumber(selected.item.quantidade))}</p></div>
                <div className="rounded-xl border border-amber-300/15 bg-amber-400/[.07] p-4"><p className="text-[10px] uppercase tracking-wider text-slate-400">Valor ainda pendente</p><p className="mt-2 text-lg font-bold text-amber-200">{selected.item.valor_pendente === null ? "Não conciliado" : money.format(toNumber(selected.item.valor_pendente))}</p></div>
              </div>
              <div className="rounded-2xl border border-cyan-400/20 bg-[#081625] p-4 sm:p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white"><ClipboardPenLine size={16} className="text-cyan-300" /> Decisão do comprador</h3>
                <PurchaseDecisionEditor key={rowId(selected)} loja={selected.item.loja!} pedido={selected.item.pedido!} produtoCodigo={selected.item.produto_codigo!} record={selected.record} available expanded />
              </div>
              <PurchaseSubgroupEditor key={"otb-"+rowId(selected)} loja={selected.item.loja!} pedido={selected.item.pedido!} produtoCodigo={selected.item.produto_codigo!}/>
            </div>
          </Dialog.Content>
        </Dialog.Portal>}
      </Dialog.Root>
    </div>
  )
}
