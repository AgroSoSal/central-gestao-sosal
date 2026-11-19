import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import { ComprasLogin, ComprasSair } from "@/components/compras/compras-auth"
import { ComprasExecutiveDashboard } from "@/components/compras/compras-executive-dashboard"
import { LoadingState } from "@/components/shared/mascot-loader"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { DashboardReferenceRow, DashboardSalesRow } from "@/domains/compras/domain/dashboard-zacarini-237"
import type { ContractedWeek } from "@/domains/compras/domain/dashboard-cash-contracts"
import type { ContractedMonth } from "@/domains/compras/domain/otb-bank-readiness"
import type { RecoverableReceivablesLine } from "@/domains/compras/domain/receivables-recovery-237"
import type { DdePlanRow } from "@/domains/compras/domain/dashboard-goals-and-dde-237"

type Props = { searchParams: Promise<{ mes?: string }> }

function currentMonth() {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Campo_Grande",
  }).formatToParts(new Date())
  const get = (name: string) => parts.find(p => p.type === name)?.value ?? ""
  return { month: `${get("year")}-${get("month")}`, today: `${get("year")}-${get("month")}-${get("day")}` }
}

export default function Page({ searchParams }: Props) {
  return <Suspense fallback={<LoadingState label="Carregando Dashboard de Compras..." />}><Content searchParams={searchParams} /></Suspense>
}

async function Content({ searchParams }: Props) {
  await connection()
  const supabase = await createSupabaseServerClient()
  if (!supabase) return <ComprasLogin configured={false} />
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) return <ComprasLogin configured />

  const { error: authz } = await supabase.rpc("fn_listar_decisoes_compra", { p_chaves: [] })
  if (authz) return <div role="alert" className="mx-auto max-w-3xl space-y-5 rounded-2xl border border-amber-400/30 bg-amber-950/20 p-8 text-amber-100">
    <div className="flex justify-end"><ComprasSair /></div>
    <AlertTriangle size={24} />
    <h1 className="text-xl font-bold">{authz.code === "42501" ? "Acesso restrito ao Master ativo" : "Não foi possível validar o seu acesso"}</h1>
    <p className="text-sm">A dashboard exige autenticação e permissão Master no Supabase.</p>
    <Link href="/compras" className="inline-flex items-center gap-2 text-cyan-200"><ArrowLeft size={15} /> Voltar a Compras</Link>
  </div>

  const now = currentMonth()
  const params = await searchParams
  const month = typeof params.mes === "string" && /^20\d\d-(0[1-9]|1[0-2])$/.test(params.mes)
    ? params.mes : now.month
  const competencia = `${month}-01`

  const [config, sales, position, stock, bank, weeks, months, ordersQuality, recovery, ddePlan] = await Promise.all([
    supabase.rpc("fn_compras_dashboard_config_237"),
    supabase.rpc("fn_compras_dashboard_vendas_237", { p_competencia: competencia }),
    supabase.rpc("fn_compras_dashboard_posicao_237"),
    supabase.rpc("fn_otb_posicao_subgrupos", { p_data_base: now.today }),
    supabase.rpc("fn_otb_extratos_posicao_237"),
    supabase.rpc("fn_compras_dashboard_agenda_26s_237", { p_inicio: now.today }),
    supabase.rpc("fn_otb_agenda_contratada_12m_237", { p_inicio: `${now.month}-01` }),
    supabase.rpc("fn_compras_dashboard_pedidos_qualidade_237"),
    supabase.rpc("fn_compras_dashboard_receber_recuperavel_237", { p_data_base: now.today }),
    supabase.rpc("fn_compras_plano_estoque_237", { p_busca: null, p_competencia: competencia,
      p_pagina: 1, p_tamanho: 100 }),
  ])

  return <ComprasExecutiveDashboard
    month={month}
    email={user.email ?? ""}
    referenceRows={config.error ? [] : (config.data ?? []) as DashboardReferenceRow[]}
    salesRows={sales.error ? [] : (sales.data ?? []) as DashboardSalesRow[]}
    shopPositions={position.error ? [] : position.data ?? []}
    stockRows={stock.error ? [] : stock.data ?? []}
    bankRows={bank.error ? [] : bank.data ?? []}
    today={now.today}
    contractedWeeks={weeks.error ? [] : (weeks.data ?? []) as ContractedWeek[]}
    contractedMonths={months.error ? [] : (months.data ?? []) as ContractedMonth[]}
    pendingOrdersQuality={ordersQuality.error ? null : (ordersQuality.data?.[0] ?? null)}
    recoveryRows={recovery.error ? [] : (recovery.data ?? []) as RecoverableReceivablesLine[]}
    ddePlanRows={ddePlan.error ? [] : (ddePlan.data ?? []) as DdePlanRow[]}
    errors={{
      premissas: config.error?.message ?? null, vendas: sales.error?.message ?? null,
      posicao: position.error?.message ?? null, estoque: stock.error?.message ?? null,
      extratos: bank.error?.message ?? null,
      agenda26s: weeks.error?.message ?? null,
      agenda12m: months.error?.message ?? null,
      pedidosPendentes: ordersQuality.error?.message ?? null,
      receberRecuperavel: recovery.error?.message ?? null,
      planoDde: ddePlan.error?.message ?? null,
    }}
  />
}
