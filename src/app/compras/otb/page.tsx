import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import { ComprasLogin, ComprasSair } from "@/components/compras/compras-auth"
import { OtbDashboard } from "@/components/compras/otb-dashboard"
import { LoadingState } from "@/components/shared/mascot-loader"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { interpretOtbHistoricalSource, lastClosedMonthInCampoGrande } from "@/domains/compras/domain/otb-historical-source"
import { interpretOtbStockPosition } from "@/domains/compras/domain/otb-position-source"
import { interpretOtbPurchaseSource } from "@/domains/compras/domain/otb-source-status"
import { buildPartialCashSeries, type ContractedWeek } from "@/domains/compras/domain/dashboard-cash-contracts"
import { buildZacariniCashForecast } from "@/domains/compras/domain/zacarini-cash-forecast"
import { resolveReceivablesRecovery, type RecoverableReceivablesLine } from "@/domains/compras/domain/receivables-recovery-237"
import { nextOtbPurchaseNeeds } from "@/domains/compras/domain/otb-indicative-months"
import { dashboardReference, type DashboardReferenceRow } from "@/domains/compras/domain/dashboard-zacarini-237"
import { buildOtbSubgroupPreview, type OtbSubgroupPreview } from "@/domains/compras/domain/otb-subgroup-preview"
import { interpretOtbSeasonalHistory } from "@/domains/compras/domain/otb-seasonal-source"
import { interpretOtbAbcProjection } from "@/domains/compras/domain/otb-abc-projection-237"
import { fetchOtbSubgroupPlans } from "@/domains/compras/domain/otb-subgroup-plan-source"
import type { BankPositionRow, ContractedMonth } from "@/domains/compras/domain/otb-bank-readiness"

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
  const todayParts = new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Campo_Grande",
  }).formatToParts(new Date())
  const today = (type: string) => todayParts.find((part) => part.type === type)?.value ?? ""
  const todayISO = `${today("year")}-${today("month")}-${today("day")}`

  // Duas fontes agregadas, somente leitura, verificadas pelo banco como Master.
  // O histórico NÃO contém fluxo de caixa futuro nem substitui a Projeção 12M.
  const [summary, historical, stock, config, bank, weeks, months, recovery] = await Promise.all([
    supabase.rpc("fn_listar_pedidos_compra", {
    p_busca: null,
    p_loja: null,
    p_inicio: null,
    p_fim: null,
    p_pagina: 1,
    p_tamanho: 1,
    }),
    supabase.rpc("fn_otb_historico_mensal", { p_inicio: firstMonth, p_fim: lastClosedMonth }),
    supabase.rpc("fn_otb_posicao_subgrupos", { p_data_base: todayISO }),
    supabase.rpc("fn_compras_dashboard_config_237"),
    supabase.rpc("fn_otb_extratos_posicao_237"),
    supabase.rpc("fn_compras_dashboard_agenda_26s_237", { p_inicio: todayISO }),
    supabase.rpc("fn_otb_agenda_contratada_12m_237", { p_inicio: `${todayISO.slice(0,7)}-01` }),
    supabase.rpc("fn_compras_dashboard_receber_recuperavel_237", { p_data_base: todayISO }),
  ])
  const purchaseSource = interpretOtbPurchaseSource(summary.data, summary.error)
  const historicalSource = interpretOtbHistoricalSource(historical.data, historical.error, lastClosedMonth)
  const stockPosition = interpretOtbStockPosition(stock.data, stock.error)

  // Mesmo cenário operacional simulado da dashboard, sem teto oficial nem
  // autorizar compra. OTB!B7 inicia no mês SEGUINTE ao fluxo.
  const partialCash = buildPartialCashSeries(bank.error ? [] : (bank.data ?? []) as BankPositionRow[],
    weeks.error ? [] : (weeks.data ?? []) as ContractedWeek[],
    months.error ? [] : (months.data ?? []) as ContractedMonth[], todayISO)
  const stocks = new Map<number,{linha:number;estoque:number;cmv90:number;incompleto:boolean}>()
  if (stockPosition.status === "conectado") for (const row of stockPosition.subgroups) {
    if (row.line < 1 || row.line > 4) continue
    const group = stocks.get(row.line) ?? {linha:row.line,estoque:0,cmv90:0,incompleto:false}
    group.estoque += row.stockCost
    if (row.cmv90d===null) group.incompleto=true
    else group.cmv90+=row.cmv90d
    stocks.set(row.line,group)
  }
  const recovered = recovery.error ? null : resolveReceivablesRecovery((recovery.data ?? []) as RecoverableReceivablesLine[])
  const forecast = buildZacariniCashForecast({
    today:todayISO, references:config.error ? [] : (config.data ?? []) as DashboardReferenceRow[],
    contracts:partialCash, overdue:recovered?.eligible ?? null,
    stock:[...stocks.values()].filter(x=>!x.incompleto).map(x=>({linha:x.linha,estoque:x.estoque,cmv90:x.cmv90})),
  })
  const indicativeMonths = forecast.state === "simulado" ?
    nextOtbPurchaseNeeds(todayISO,forecast.monthLabels,forecast.monthlyNewPurchases.noventa) : null

  // OTB!B7: competência seguinte ao mês-base. A RPC entrega apenas quatro
  // janelas consolidadas de SAÍDA; não consulta diretamente vendas no navegador.
  const seasonalMonth=indicativeMonths?.[0]?.month??new Date(Date.UTC(Number(today("year")),Number(today("month")),1))
    .toISOString().slice(0,10)
  const [seasonalResponse,abcResponse]=await Promise.all([
    supabase.rpc("fn_otb_venda_sazonal_237",{p_mes_otb:seasonalMonth}),
    supabase.rpc("fn_otb_abc_previsao_237",{p_data_base:todayISO}),
  ])
  const seasonalHistory=interpretOtbSeasonalHistory(seasonalResponse.data,seasonalResponse.error,seasonalMonth)
  const abcProjection=interpretOtbAbcProjection(abcResponse.data,abcResponse.error)

  let subgroupPreview:OtbSubgroupPreview|null=null
  if(indicativeMonths?.length===3&&forecast.state==="simulado"){
    if(stockPosition.status!=="conectado"||config.error){
      subgroupPreview={state:"indisponivel",reason:"Posição de estoque ou parâmetros de planejamento indisponíveis.",authorizesPurchases:false}
    }else{
      const nextMonths=indicativeMonths.map(item=>item.month) as [string,string,string]
      const planSource=await fetchOtbSubgroupPlans(nextMonths,async competencia=>
        supabase.rpc("fn_compras_plano_estoque_237",{
          p_busca:null,p_competencia:competencia,p_pagina:1,p_tamanho:100,
        }))
      if(planSource.state==="indisponivel"){
        subgroupPreview={state:"indisponivel",reason:planSource.reason,authorizesPurchases:false}
      }else{
        const references=(config.data??[]) as DashboardReferenceRow[]
        const fallbackDde:Record<number,number>={}
        for(let line=1;line<=4;line++){
          const target=dashboardReference(references,`dde_alvo_linha_${line}`,null).valor
          if(target!==null&&target>=0)fallbackDde[line]=target
        }
        const abcByGroup=new Map<string,Extract<typeof abcProjection,{state:"conectado"}>["groups"][number]>(
          abcProjection.state==="conectado"?
          abcProjection.groups.map(group=>[`${group.line}\0${group.name}`,group] as const):[])
        const positions=stockPosition.subgroups.filter(row=>row.line>=1&&row.line<=4).map(row=>{
          const abc=abcByGroup.get(`${row.line}\0${row.subgroup}`)
          return {line:row.line,subgroup:row.subgroup,stockCost:row.stockCost,cmv90d:row.cmv90d,
            ...(abcProjection.state==="conectado"?{
              projectedSales90d:abc?.projectedSales90??0,
              projectedCmv90d:abc?.projectedCmv90??0,
              curveASales90d:abc?.curveASales90??0,
            }:{}),
          }
        })
        if(abcProjection.state==="conectado"){
          const stocked=new Set(positions.map(row=>`${row.line}\0${row.subgroup}`))
          for(const abc of abcProjection.groups){
            if(stocked.has(`${abc.line}\0${abc.name}`))continue
            positions.push({line:abc.line,subgroup:abc.name,stockCost:0,cmv90d:0,
              projectedSales90d:abc.projectedSales90,projectedCmv90d:abc.projectedCmv90,
              curveASales90d:abc.curveASales90})
          }
        }
        subgroupPreview=buildOtbSubgroupPreview({
          months:nextMonths,referenceMonths:forecast.monthLabels,
          projectedCmv:forecast.monthlyCmvByLine.noventa,
          ...(abcProjection.state==="conectado"?{
            projectedDeliveries:forecast.monthlyDeliveriesByLine.noventa,
          }:{}),
          positions,
          plans:planSource.plans,fallbackDde,
          historicalSales:seasonalHistory.state==="conectado"?seasonalHistory.groups:undefined,
        })
      }
    }
  }

  return <OtbDashboard email={user.email ?? ""} purchaseSource={purchaseSource} historicalSource={historicalSource}
    stockPosition={stockPosition} indicativeMonths={indicativeMonths} subgroupPreview={subgroupPreview}
    seasonalHistory={seasonalHistory} abcProjection={abcProjection}
    forecastIssues={forecast.state==="indisponivel"?forecast.reasons:
      indicativeMonths?[]:["A referência da Projeção 12M não contém os três meses seguintes completos."]} />
}
