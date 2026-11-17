import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import { ComprasLogin, ComprasSair } from "@/components/compras/compras-auth"
import { OtbDashboard } from "@/components/compras/otb-dashboard"
import { LoadingState } from "@/components/shared/mascot-loader"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { interpretOtbHistoricalSource, lastClosedMonthInCampoGrande } from "@/domains/compras/domain/otb-historical-source"
import { interpretOtbPurchaseSource } from "@/domains/compras/domain/otb-source-status"

export default function ComprasOtbPage() {
  return <Suspense fallback={<LoadingState label="Autenticando acesso ao OTB..." />}><OtbContent /></Suspense>
}

export async function OtbContent() {
  await connection()
  const supabase = await createSupabaseServerClient()
  if (!supabase) return <ComprasLogin configured={false} />

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return <ComprasLogin configured />

  // Reaproveita a verificação de Master ATIVO dentro da própria função PostgreSQL
  // existente; passar [] não consulta nenhum pedido nem altera dados.
  // Nunca autorizar a página apenas pelo e-mail ou metadados do navegador.
  const { error: permissionError } = await supabase.rpc("fn_listar_decisoes_compra", { p_chaves: [] })
  if (permissionError) {
    return <div className="mx-auto max-w-3xl space-y-4 pb-12 pt-8 text-slate-100">
      <div className="flex justify-end"><ComprasSair /></div>
      <section role="alert" className="rounded-2xl border border-amber-400/30 bg-amber-950/30 p-7 text-amber-100">
        <AlertTriangle size={25} />
        <h1 className="mt-4 text-xl font-bold">{permissionError.code === "42501" ? "Acesso exclusivo ao Master" : "Não foi possível verificar seu acesso"}</h1>
        <p className="mt-2 text-sm leading-6">
          {permissionError.code === "42501"
            ? "O planejamento OTB exige perfil Master ativo na Só Sal."
            : "A verificação de permissão no Supabase falhou. Por segurança, o OTB não foi carregado."}
        </p>
        <Link href="/compras" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 underline"><ArrowLeft size={15} /> Voltar a Compras</Link>
      </section>
    </div>
  }

  // A RPC de listagem antiga é suficiente para a telemetria de importação
  // e evita o custo da conciliação integral de NFs a cada abertura da OTB.
  // Isto NÃO constitui saldo a receber, Projeção 12M, DDE nem meta de MP.
  const lastClosedMonth = lastClosedMonthInCampoGrande()
  const [year, month] = lastClosedMonth.split("-").map(Number)
  const firstMonth = new Date(Date.UTC(year, month - 24, 1)).toISOString().slice(0, 10)

  // Duas fontes agregadas, somente leitura, verificadas pelo banco como Master.
  // O histórico NÃO contém fluxo de caixa futuro nem substitui a Projeção 12M.
  const [summary, historical] = await Promise.all([
    supabase.rpc("fn_listar_pedidos_compra", {
    p_busca: null,
    p_loja: null,
    p_inicio: null,
    p_fim: null,
    p_pagina: 1,
    p_tamanho: 1,
    }),
    supabase.rpc("fn_otb_historico_mensal", { p_inicio: firstMonth, p_fim: lastClosedMonth }),
  ])
  const purchaseSource = interpretOtbPurchaseSource(summary.data, summary.error)
  const historicalSource = interpretOtbHistoricalSource(historical.data, historical.error, lastClosedMonth)

  return <OtbDashboard email={user.email ?? ""} purchaseSource={purchaseSource} historicalSource={historicalSource} />
}
