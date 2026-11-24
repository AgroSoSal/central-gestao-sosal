"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Check, ClipboardPenLine, History, Loader2 } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import {
  operationalDecision, type PurchaseDecision, type PurchaseDecisionRecord,
} from "@/domains/compras/domain/purchase-decisions"

type Props = {
  loja: string
  pedido: string
  produtoCodigo: string
  record: PurchaseDecisionRecord | null
  available: boolean
  expanded?: boolean
}

const palette: Record<PurchaseDecision, string> = {
  Aprovado: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  Segurar: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  Cancelar: "border-rose-400/25 bg-rose-400/10 text-rose-300",
  "Já pago": "border-violet-400/25 bg-violet-400/10 text-violet-200",
}

function formattedDate(date: string): string {
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString("pt-BR", {
    timeZone: "America/Campo_Grande", day: "2-digit", month: "2-digit",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

export function PurchaseDecisionEditor({ loja, pedido, produtoCodigo, record, available, expanded = false }: Props) {
  const router = useRouter()
  const [saved, setSaved] = useState<PurchaseDecisionRecord | null>(record)
  const [decision, setDecision] = useState<PurchaseDecision | "">(record?.decisao ?? "")
  const [note, setNote] = useState(record?.observacao ?? "")
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState("")

  const current = operationalDecision(saved?.decisao)
  const dirty = decision !== "" && (!saved || decision !== saved.decisao || note.trim() !== (saved.observacao ?? ""))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!available || !dirty || !decision || busy) return
    const client = createSupabaseBrowserClient()
    if (!client) {
      setFeedback("Conexão indisponível. Tente novamente.")
      return
    }
    setBusy(true)
    setFeedback("")
    try {
      const { error } = await client.rpc("fn_registrar_decisao_pedido_compra", {
        p_loja: loja, p_pedido: pedido, p_produto_codigo: produtoCodigo,
        p_decisao: decision, p_observacao: note.trim() || null,
      })
      if (error) {
        setFeedback(error.code === "42501" ? "Seu perfil não tem autorização Master ativa." : "Não foi possível gravar. Tente novamente.")
        return
      }

      const { data, error: reloadError } = await client.rpc("fn_listar_decisoes_compra", {
        p_chaves: [{ loja, pedido, produto_codigo: produtoCodigo }],
      })
      if (reloadError) {
        // Não presume histórico após falha de leitura. A escrita já foi confirmada.
        setSaved({
          loja, pedido, produto_codigo: produtoCodigo, decisao: decision,
          observacao: note.trim() || null, atualizado_em: new Date().toISOString(),
          alteracoes: saved?.alteracoes ?? [],
        })
        setFeedback("Decisão salva. Atualize a página para consultar o histórico.")
      } else {
        const latest = ((data ?? []) as PurchaseDecisionRecord[])[0] ?? null
        setSaved(latest)
        setNote(latest?.observacao ?? "")
        setFeedback("Decisão registrada com sucesso.")
      }
      // Uma decisão altera os filtros de fila e os itens elegíveis ao follow-up.
      router.refresh()
    } catch {
      setFeedback("Falha de conexão. Confira se a decisão foi salva antes de tentar novamente.")
    } finally {
      setBusy(false)
    }
  }

  const form = (
          <form onSubmit={submit} className={`mt-3 w-full space-y-3 rounded-xl border border-cyan-300/20 bg-[#0c1c2e] p-4 shadow-[0_15px_35px_-15px_rgba(0,0,0,.85)] ${expanded ? "max-w-none" : "max-w-72"}`}>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-slate-300" htmlFor={`decisao-${loja}-${pedido}-${produtoCodigo}`}>Decisão do item</label>
              <select id={`decisao-${loja}-${pedido}-${produtoCodigo}`} value={decision} onChange={(event) => { setDecision(event.target.value as PurchaseDecision); setFeedback("") }} disabled={busy} className="erp-field w-full px-3 text-xs">
                <option value="" disabled>Selecione uma decisão</option>
                <option value="Aprovado">Aprovado</option>
                <option value="Segurar">Segurar</option>
                <option value="Cancelar">Cancelar</option>
                <option value="Já pago">Já pago</option>
              </select>
              {decision === "Segurar" && <p className="mt-1.5 text-[11px] leading-4 text-amber-200">Adia o item até voltar para Aprovado.</p>}
              {decision === "Já pago" && <p className="mt-1.5 text-[11px] leading-4 text-violet-200">Pagamento já realizado: sem novo vencimento no fluxo. Não altera as NFs do SISCOM.</p>}
              {decision === "Cancelar" && <p className="mt-1.5 text-[11px] leading-4 text-rose-200">Sinaliza cancelamento para Compras. Não cancela no SISCOM.</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-slate-300" htmlFor={`motivo-${loja}-${pedido}-${produtoCodigo}`}>Motivo / observações</label>
              <textarea id={`motivo-${loja}-${pedido}-${produtoCodigo}`} value={note} onChange={(event) => { setNote(event.target.value); setFeedback("") }} disabled={busy} maxLength={500} rows={3} placeholder="Contexto da decisão (opcional)" className="erp-field w-full resize-y px-3 py-2 text-xs" />
            </div>
            <button type="submit" disabled={!dirty || busy} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2.5 text-xs font-bold text-[#061524] transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40">
              {busy ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : <><Check size={14} /> Salvar decisão</>}
            </button>
            {feedback && <p role="status" aria-live="polite" className="text-[11px] leading-5 text-cyan-100">{feedback}</p>}
            {(saved?.alteracoes?.length ?? 0) > 0 && (
              <details className="border-t border-white/10 pt-3">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-semibold text-slate-300"><History size={13} /> Histórico ({saved?.alteracoes.length})</summary>
                <ol className="mt-3 max-h-60 space-y-3 overflow-y-auto text-[11px] text-slate-400">
                  {saved?.alteracoes.map((change, index) => (
                    <li key={`${change.quando}-${index}`} className="border-l-2 border-cyan-400/30 pl-2.5">
                      <p className="font-semibold text-slate-200">{change.anterior ?? "Sem decisão"} → {change.nova}</p>
                      <p className="mt-0.5 break-words">{change.observacao || "Sem observação"}</p>
                      <p className="mt-0.5 break-all text-slate-500">{change.por} · {formattedDate(change.quando)}</p>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </form>
  )

  return (
    <div className="min-w-[170px]">
      <span className={`inline-flex rounded-lg border px-2.5 py-1 text-[11px] font-bold ${current === "Aprovado (padrão Zacarini)" ? "border-amber-400/25 bg-amber-400/10 text-amber-200" : palette[current]}`}>{available ? current : "Indisponível"}</span>
      {available && !saved && <p className="mt-2 text-[11px] leading-4 text-amber-200">A coluna AP vazia equivale a Aprovado na Zacarini 2.3.8. Isto não é autorização financeira de compra.</p>}
      {available && (expanded ? form : (
        <details className="group/decision relative mt-2">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-cyan-300 transition hover:text-cyan-100 focus-visible:outline-2 focus-visible:outline-cyan-300">
            <ClipboardPenLine size={13} /> Gerenciar pedido
          </summary>
          {form}
        </details>
      ))}
    </div>
  )
}
