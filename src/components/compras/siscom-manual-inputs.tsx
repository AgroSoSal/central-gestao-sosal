"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ClipboardList, Database, FileDown, Trash2 } from "lucide-react"
import {
  MANUAL_INPUT_TYPES, parseManualInput, parseManualInputBackup, upsertManualInput,
  type ManualInput, type ManualInputType,
} from "@/domains/compras/domain/siscom-manual-inputs"
import { loadManualInputs, saveManualInputs } from "@/domains/compras/domain/siscom-manual-inputs-storage"
import { deleteRemoteManualInput, fetchRemoteManualInputs, saveRemoteManualInputs } from "@/app/compras/entradas-manuais/actions"

const branches = [
  ["REDE", "Rede consolidada"], ["BDS", "Bandeirantes"], ["CG", "Campo Grande"],
  ["RIO", "Rio Verde"], ["CX", "Coxim"], ["PG", "Pedro Gomes"], ["AN", "Anastácio"],
] as const
const typeOptions = Object.entries(MANUAL_INPUT_TYPES) as [ManualInputType, (typeof MANUAL_INPUT_TYPES)[ManualInputType]][]
const currentMonth = () => {
  const parts = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "2-digit", timeZone: "America/Campo_Grande" }).formatToParts(new Date())
  return `${parts.find(part => part.type === "year")?.value}-${parts.find(part => part.type === "month")?.value}`
}
const numberFormat = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const empty = { tipo: "custo_diario_previsto" as ManualInputType, filial: "REDE", linha: "1", sku: "", data: "", valor: "", observacao: "" }

export function ManualSiscomInputs({ userId, remote = false }: { userId: string; remote?: boolean }) {
  const [rows, setRows] = useState<ManualInput[]>([])
  const [ready, setReady] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [message, setMessage] = useState("")
  const [month, setMonth] = useState(currentMonth)
  const [form, setForm] = useState(empty)
  const [backupText, setBackupText] = useState("")
  const [showBackup, setShowBackup] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    if (remote) {
      void fetchRemoteManualInputs().then(result => {
        if (!active) return
        if (result.status === "success") setRows(result.records)
        else { setBlocked(true); setMessage(result.message) }
        setReady(true)
      }).catch(() => {
        if (active) { setBlocked(true); setReady(true); setMessage("Não foi possível consultar os lançamentos do Supabase.") }
      })
      return () => { active = false }
    }
    // A leitura de armazenamento é externa ao React; adiada para após o commit
    // para não provocar atualização síncrona em um effect ou hidratação divergente.
    queueMicrotask(() => {
      if (!active) return
      try { setRows(loadManualInputs(userId)) }
      catch { setBlocked(true); setMessage("Backup local inválido. Os dados não foram sobrescritos; recupere o arquivo antes de lançar novos valores.") }
      finally { setReady(true) }
    })
    return () => { active = false }
  }, [userId, remote])

  const option = MANUAL_INPUT_TYPES[form.tipo]
  const needsDate = option.dimension === "data" || option.dimension === "data-valor"
  const needsLine = option.dimension === "linha"
  const needsSku = option.dimension === "sku"
  const needsValue = option.dimension !== "data"
  const exportJson = useMemo(() => JSON.stringify({ versao: 1, registros: rows }, null, 2), [rows])

  function commit(records: ManualInput[], text: string) {
    try {
      saveManualInputs(userId, records)
      setRows(records); setDeleteId(null); setMessage(text)
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Não foi possível salvar no navegador.") }
  }

  async function refreshRemote(successMessage: string) {
    const fetched = await fetchRemoteManualInputs()
    if (fetched.status === "success") {
      setRows(fetched.records); setDeleteId(null); setMessage(successMessage)
    } else {
      setBlocked(true); setMessage("A operação foi recebida, mas a confirmação da lista falhou: " + fetched.message)
    }
  }

  async function persistRemote(records: ManualInput[]) {
    setSaving(true)
    try {
      const result = await saveRemoteManualInputs(records)
      if (result.status === "error") { setMessage(result.message); return }
      await refreshRemote(result.message)
    } catch { setMessage("Não foi possível confirmar a gravação no Supabase.") }
    finally { setSaving(false) }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (blocked || !ready) return
    try {
      const record = parseManualInput({ ...form, competencia: month })
      if (remote) void persistRemote([record])
      else commit(upsertManualInput(rows, record), "Entrada salva neste navegador. Pendente de integração com o SISCOM.")
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Entrada inválida.") }
  }

  function importBackup() {
    if (blocked) return
    try {
      const incoming = parseManualInputBackup(backupText)
      const conflicts = incoming.filter(record => rows.some(row => row.id === record.id && JSON.stringify(row) !== JSON.stringify(record)))
      if (conflicts.length) throw new RangeError(`${conflicts.length} chave(s) já cadastradas com valores diferentes. Resolva o conflito antes de importar.`)
      const merged = incoming.reduce((acc, record) => upsertManualInput(acc, record), rows)
      if (remote) void persistRemote(incoming)
      else commit(merged, `${incoming.length} lançamento(s) importado(s) para o navegador. Nenhuma integração foi realizada.`)
      setBackupText("")
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Não foi possível importar.") }
  }

  async function removeRecord(row: ManualInput) {
    if (remote) {
      setSaving(true)
      try {
        const result = await deleteRemoteManualInput(row)
        if (result.status === "error") { setMessage(result.message); return }
        await refreshRemote(result.message)
      } catch { setMessage("A exclusão não pôde ser confirmada no Supabase.") }
      finally { setSaving(false) }
    } else commit(rows.filter(item => item.id !== row.id), "Entrada excluída deste navegador.")
  }

  return <main className="mx-auto max-w-[1560px] space-y-5 pb-16 text-slate-100">
    <nav className="flex flex-wrap items-center justify-between gap-3 text-xs">
      <Link href="/compras" className="inline-flex items-center gap-2 font-semibold text-cyan-300"><ArrowLeft size={15} /> Voltar a Compras</Link>
      <Link href="/compras/atendimento" className="font-semibold text-cyan-300 underline">Atendimento Fornecedor</Link>
    </nav>
    <header className="erp-surface rounded-3xl p-6 sm:p-9">
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-cyan-300"><Database size={15} /> Compras · Integração SISCOM futura</p>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Entradas manuais <span className="text-cyan-300">para Compras</span></h1>
      <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">Cadastre os insumos faltantes por competência e filial: datas de liberação, caixa acumulado por vencimento, verba de cada linha, estoque, custo, vendas e pagamentos. São entradas provisórias para testar as fórmulas da Zacarini 2.3.7. Nenhum pedido é emitido, nenhum valor é enviado ao SISCOM e nenhum lançamento é considerado conciliado.</p>
      <div role="alert" className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-xs leading-6 text-amber-100">
        {remote?<><strong>Persistência compartilhada no Supabase:</strong> os lançamentos são visíveis aos usuários Master autorizados. São rascunhos não conciliados e não alimentam aprovação financeira oficial, pedidos emitidos ou SISCOM. Mantenha um backup JSON.</>:<><strong>Armazenamento temporário:</strong> os dados ficam apenas neste navegador, separados por usuário. Não aparecem em outro computador, podem ser apagados ao limpar os dados do navegador e não alimentam a contabilidade oficial. Use o backup JSON para preservá-los.</>}
      </div>
    </header>
    <section className="erp-surface rounded-2xl p-5 sm:p-7">
      <h2 className="flex items-center gap-2 text-lg font-bold"><ClipboardList size={19} className="text-cyan-300" /> Novo lançamento ou atualização</h2>
      <form onSubmit={submit} className="mt-5 grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-slate-300">Tipo de entrada
          <select aria-label="Tipo de entrada" className="erp-field mt-2 w-full px-3" value={form.tipo} onChange={event => setForm(previous => ({ ...previous, tipo: event.target.value as ManualInputType, data: "", valor: "", sku: "" }))}>
            {typeOptions.map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-300">Competência do cenário
          <input aria-label="Competência do cenário" type="month" required className="erp-field mt-2 w-full px-3" value={month} onChange={event => setMonth(event.target.value)} />
        </label>
        <label className="text-xs text-slate-300">Filial da entrada
          <select aria-label="Filial da entrada" className="erp-field mt-2 w-full px-3" value={form.filial} onChange={event => setForm(previous => ({ ...previous, filial: event.target.value }))}>
            {branches.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
          </select>
        </label>
        {needsLine && <label className="text-xs text-slate-300">Linha OTB
          <select aria-label="Linha OTB" className="erp-field mt-2 w-full px-3" value={form.linha} onChange={event => setForm(previous => ({ ...previous, linha: event.target.value }))}>{[1, 2, 3, 4].map(line => <option key={line} value={line}>Linha {line}</option>)}</select>
        </label>}
        {needsSku && <label className="text-xs text-slate-300">Código do produto no SISCOM
          <input aria-label="Código do produto no SISCOM" className="erp-field mt-2 w-full px-3" maxLength={40} required value={form.sku} onChange={event => setForm(previous => ({ ...previous, sku: event.target.value }))} />
        </label>}
        {needsDate && <label className="text-xs text-slate-300">Data de referência / vencimento
          <input aria-label="Data de referência ou vencimento" type="date" required className="erp-field mt-2 w-full px-3" value={form.data} onChange={event => setForm(previous => ({ ...previous, data: event.target.value }))} />
        </label>}
        {needsValue && <label className="text-xs text-slate-300">Valor informado ({option.unit})
          <input aria-label="Valor informado" type="number" inputMode="decimal" step={form.tipo === "peso_produto" ? "0.001" : "0.01"} required className="erp-field mt-2 w-full px-3" value={form.valor} onChange={event => setForm(previous => ({ ...previous, valor: event.target.value }))} placeholder="Ex.: 1500.00" />
        </label>}
        <label className="text-xs text-slate-300 lg:col-span-2">Observação / origem informada
          <input aria-label="Observação e origem" className="erp-field mt-2 w-full px-3" maxLength={500} value={form.observacao} onChange={event => setForm(previous => ({ ...previous, observacao: event.target.value }))} placeholder="Ex.: conferido com planilha; extrato pendente" />
        </label>
        <button type="submit" disabled={!ready || blocked || saving || rows.length >= 500} className="h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 text-xs font-bold text-white disabled:opacity-40">{saving?"Gravando...":"Registrar entrada"}</button>
      </form>
      {message && <p role="status" className="mt-4 text-xs text-amber-100">{message}</p>}
      <p className="mt-3 text-[11px] leading-5 text-slate-500">Repetir a mesma competência, filial, tipo e dimensão atualiza a entrada. Para limites de caixa, cada data representa um limite acumulado diferente. Para verba, informe as linhas 1 a 4 separadamente.</p>
    </section>
    <section className="erp-surface overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="text-lg font-bold text-white">Tabela de insumos pendentes</h2><p className="mt-1 text-xs text-slate-400">{rows.length} entrada(s) {remote?"no Supabase":"locais"} · Não conciliadas</p></div>
        <button type="button" onClick={() => setShowBackup(value => !value)} className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-bold text-cyan-200"><FileDown size={16} /> {showBackup ? "Ocultar backup" : "Exportar / importar JSON"}</button>
      </div>
      {showBackup && <div className="space-y-4 border-y border-white/10 bg-[#0b1a29] p-5 text-xs">
        <label className="block text-slate-300">Backup atual (copie e salve em arquivo .json)
          <textarea aria-label="Backup JSON atual" readOnly rows={5} value={exportJson} className="erp-field mt-2 w-full resize-y px-3 py-2 font-mono text-[11px]" />
        </label>
        <label className="block text-slate-300">Importar backup (cole o conteúdo do arquivo .json)
          <textarea aria-label="Cole o backup JSON" rows={4} value={backupText} onChange={event => setBackupText(event.target.value)} className="erp-field mt-2 w-full resize-y px-3 py-2 font-mono text-[11px]" />
        </label>
        <button type="button" disabled={!backupText || blocked} onClick={importBackup} className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 font-bold text-cyan-200 disabled:opacity-40">Importar backup validado</button>
      </div>}
      <div className="overflow-x-auto"><table aria-label="Entradas manuais para o SISCOM" className="w-full min-w-[1040px] text-left text-xs">
        <thead className="bg-[#102036] text-[10px] uppercase tracking-wide text-slate-400"><tr>{["Tipo","Competência","Filial","Dimensão","Valor","Origem / observação","Situação","Ações"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-white/10">{rows.map(row => <tr key={row.id}>
          <td className="p-3 font-semibold text-cyan-200">{MANUAL_INPUT_TYPES[row.tipo].label}</td>
          <td className="p-3">{row.competencia}</td><td className="p-3">{row.filial}</td>
          <td className="p-3">{row.linha ? `Linha ${row.linha}` : row.sku ? `SKU ${row.sku}` : row.data ?? "Rede / filial"}</td>
          <td className="p-3 font-semibold tabular-nums">{row.valor === null ? row.data : `${row.tipo === "peso_produto" ? row.valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) : numberFormat.format(row.valor)} ${MANUAL_INPUT_TYPES[row.tipo].unit}`}</td>
          <td className="max-w-56 p-3 text-slate-400">{row.observacao || "Informação manual"}</td>
          <td className="p-3 text-amber-200">Pendente de integração</td>
          <td className="p-3"><div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setMonth(row.competencia); setForm({ tipo: row.tipo, filial: row.filial, linha: String(row.linha ?? 1), sku: row.sku ?? "", data: row.data ?? "", valor: row.valor === null ? "" : String(row.valor), observacao: row.observacao }); setMessage("Entrada carregada no formulário acima para edição.") }} className="text-cyan-300 underline">Editar</button>
            {deleteId === row.id ? <><button type="button" disabled={saving} onClick={() => void removeRecord(row)} className="font-semibold text-rose-300 disabled:opacity-40">Confirmar exclusão</button><button type="button" onClick={() => setDeleteId(null)} className="text-slate-300">Cancelar</button></> : <button type="button" aria-label={`Excluir ${row.id}`} onClick={() => setDeleteId(row.id)} className="inline-flex items-center gap-1 text-slate-400 hover:text-rose-300"><Trash2 size={14} /> Excluir</button>}
          </div></td>
        </tr>)}</tbody>
      </table>{rows.length === 0 && <p className="p-8 text-center text-sm text-slate-400">Nenhuma entrada cadastrada neste navegador.</p>}</div>
    </section>
    <p className="text-xs leading-6 text-slate-400">A fonte oficial continua sendo o Supabase, após as futuras integrações com SISCOM e a homologação financeira. Esta grade não grava pedidos, contas a pagar ou decisões de aprovação.</p>
  </main>
}
