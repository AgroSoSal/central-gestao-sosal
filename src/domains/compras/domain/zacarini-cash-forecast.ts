import { dashboardReference, type DashboardReferenceRow } from "./dashboard-zacarini-237"
import type { PartialCashSeries } from "./dashboard-cash-contracts"

/** Projeção OPERACIONAL a partir de premissas versionadas. Não é conciliação nem liberação OTB.
 * A planilha não é consultada durante a execução. Fluxos de investimentos, captação,
 * liquidação de estoque, pedidos em trânsito e despesas não importadas são lacunas explícitas.
 */
export const CASH_SCENARIOS = ["noventa", "plano", "historico"] as const
export type CashScenario = typeof CASH_SCENARIOS[number]
export type ForecastStockLine = { linha: number; estoque: number; cmv90: number }
export type CashForecastInput = {
  today: string
  references: readonly DashboardReferenceRow[]
  contracts: PartialCashSeries
  stock: readonly ForecastStockLine[]
  overdue: number | null
}

type ScenarioSeries = Record<CashScenario, number[]>
type WeekSeries = Record<CashScenario, { withPurchases: number[]; withoutPurchases: number[] }>
export type CashForecastResult =
  | { state: "indisponivel"; reasons: string[]; authorizesPurchases: false }
  | { state: "simulado"; warnings: string[]; authorizesPurchases: false;
    monthLabels: string[]; weekly: WeekSeries; monthly: ScenarioSeries;
    minimum13WithPurchases: number; minimum13WithoutPurchases: number;
    minimum12: number; final12: number; safetyFloor: number;
    monthlyNewPurchases: ScenarioSeries }

const DAY = 86400000
const dateMs = (iso: string) => Date.parse(`${iso}T00:00:00.000Z`)
const isoDate = (ms: number) => new Date(ms).toISOString().slice(0,10)
const startMonth = (ms: number) => new Date(ms).toISOString().slice(0,7) + "-01"
const dayInMonth = (ms: number) => new Date(ms).getUTCDate()
const monthLength = (ms: number) => {
  const d = new Date(ms)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1, 0)).getUTCDate()
}
const addMonths = (ms: number, months: number) => {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1)
}

function unavailable(reason: string): CashForecastResult {
  return { state: "indisponivel", reasons: [reason], authorizesPurchases: false }
}

type MonthData = { month: string; invoicing: Record<CashScenario, number>; deliveries: Record<CashScenario, number[]>; cmv: Record<CashScenario, number[]> }

export function buildZacariniCashForecast(input: CashForecastInput): CashForecastResult {
  const { today, references, contracts, stock, overdue } = input
  const todayMs = dateMs(today)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || !Number.isFinite(todayMs) || isoDate(todayMs) !== today) return unavailable("Data-base inválida.")
  if (contracts.state !== "parcial" || contracts.openingCash === null || !Number.isFinite(contracts.openingCash) ||
    contracts.weeklyReceivables.length !== 26 || contracts.weeklyPayables.length !== 26 ||
    contracts.monthlyReceivables.length !== 12 || contracts.monthlyPayables.length !== 12 || !contracts.base) {
    return unavailable("Saldo bancário e agenda de títulos completos são necessários para a simulação.")
  }
  if (overdue === null || !Number.isFinite(overdue) || overdue < 0) return unavailable("Carteira vencida indisponível.")
  if (stock.length !== 4 || new Set(stock.map(s => s.linha)).size !== 4 ||
    stock.some(s => s.linha < 1 || s.linha > 4 || !Number.isFinite(s.estoque) || s.estoque < 0 || !Number.isFinite(s.cmv90) || s.cmv90 < 0)) {
    return unavailable("Estoque a custo e CMV observados das quatro linhas são necessários.")
  }
  const lookup = (code: string, month: string | null = null) => dashboardReference(references, code, month).valor
  const required = (code: string) => lookup(code)
  const config: Record<string, number> = {}
  for (const code of ["minimo_caixa", "vendas_a_vista", "recuperacao_vencidos_semana", "folha_mensal",
    "encargos_mensais", "decimo_terceiro_2026", "despesas_pct", "impostos_pct",
    ...Array.from({length:4}, (_,i) => `curva_recebimento_faixa_${i+1}`),
    ...Array.from({length:4}, (_,i) => `atraso_recebimento_semanas_${i+1}`),
    ...Array.from({length:4}, (_,i) => `prazo_pagamento_linha_${i+1}`),
    ...Array.from({length:4}, (_,i) => `dde_alvo_linha_${i+1}`)]) {
    const value = required(code)
    if (value === null || !Number.isFinite(value) || value < 0) return unavailable(`Premissa ${code} não encontrada na versão 2.3.7.`)
    config[code] = value
  }
  if (config.vendas_a_vista > 1 || config.recuperacao_vencidos_semana > 1 ||
    Math.abs([1,2,3,4].reduce((sum,i) => sum + config[`curva_recebimento_faixa_${i}`], 0) - 1) > 0.00001 ||
    [1,2,3,4].some(i => !Number.isInteger(config[`atraso_recebimento_semanas_${i}`]) || !Number.isInteger(config[`prazo_pagamento_linha_${i}`]))) {
    return unavailable("Percentuais e prazos da curva de recebimento ou dos pagamentos inválidos.")
  }

  const baseMonthMs = dateMs(startMonth(todayMs))
  const months: MonthData[] = []
  for (let m=0; m<12; m++) {
    const month = isoDate(addMonths(baseMonthMs, m))
    const invoicing = {} as Record<CashScenario, number>
    const deliveries = {} as Record<CashScenario, number[]>
    const cmv = {} as Record<CashScenario, number[]>
    for (const scenario of CASH_SCENARIOS) {
      const invoice = lookup(`proj_faturamento_${scenario}`,month)
      if (invoice === null || invoice < 0) return unavailable(`Sem faturamento do cenário ${scenario} em ${month}.`)
      invoicing[scenario] = invoice
      deliveries[scenario] = []
      cmv[scenario] = []
      for (let l=1;l<=4;l++) {
        const delivered = lookup(`proj_entrega_${scenario}_linha_${l}`,month)
        const baseDelivered = lookup(`proj_entrega_noventa_linha_${l}`,month)
        const baseCost = lookup(`proj_cmv_base_linha_${l}`,month)
        if (delivered === null || baseDelivered === null || baseCost === null || delivered < 0 || baseDelivered <= 0 || baseCost < 0) {
          return unavailable(`Projeção de entrega ou CMV da linha ${l} incompleta em ${month}.`)
        }
        deliveries[scenario].push(delivered)
        cmv[scenario].push(baseCost * delivered / baseDelivered)
      }
    }
    months.push({month,invoicing,deliveries,cmv})
  }
  // A consulta é sempre uma janela móvel. Nenhum mês fora da referência 2026/27 é inventado.
  const endMs = addMonths(baseMonthMs,12)
  const dayCount = Math.round((endMs-todayMs)/DAY)
  if (dayCount < 182) return unavailable("A referência precisa cobrir integralmente 26 semanas futuras.")

  const weekly = {} as WeekSeries
  const monthly = {} as ScenarioSeries
  const monthlyNewPurchases = {} as ScenarioSeries
  const calendarMonths = months.map(m => m.month)
  const floor = config.minimo_caixa
  for (const scenario of CASH_SCENARIOS) {
    const invoiceByDay = new Array<number>(dayCount).fill(0)
    const monthOfDay = new Array<number>(dayCount).fill(0)
    for (let day=0; day<dayCount; day++) {
      const ms = todayMs + day*DAY
      const m = (new Date(ms).getUTCFullYear()-new Date(baseMonthMs).getUTCFullYear()) * 12 +
        new Date(ms).getUTCMonth()-new Date(baseMonthMs).getUTCMonth()
      monthOfDay[day] = m
      invoiceByDay[day] = months[m].invoicing[scenario]/monthLength(ms)
    }
    const receipts = new Array<number>(dayCount).fill(0)
    for (let day=0;day<dayCount;day++) {
      const invoice = invoiceByDay[day]
      receipts[day] += invoice*config.vendas_a_vista
      for (let band=1;band<=4;band++) {
        const dueDay = day + config[`atraso_recebimento_semanas_${band}`]*7
        if (dueDay<dayCount) receipts[dueDay] += invoice*(1-config.vendas_a_vista)*config[`curva_recebimento_faixa_${band}`]
      }
    }

    // O estoque inicial é o SISCOM atual (não o estoque histórico do arquivo Excel).
    // Faz o DDE convergir linearmente até o alvo, segundo as linhas 98-127 da Projeção 12M.
    const inventory = [1,2,3,4].map(l => stock.find(s => s.linha === l)!.estoque)
    const openingDde = [1,2,3,4].map(l => {
      const line = stock.find(s => s.linha === l)!
      return line.cmv90 > 0 ? line.estoque*90/line.cmv90 : 0
    })
    const purchasePayments = new Array<number>(dayCount).fill(0)
    const purchases = new Array<number>(12).fill(0)
    for (let m=0;m<12;m++) {
      const ms = addMonths(baseMonthMs,m)
      const activeStart = Math.max(ms,todayMs)
      const activeDays = monthLength(ms) - (dayInMonth(activeStart)-1)
      for (let l=1;l<=4;l++) {
        const cost = months[m].cmv[scenario][l-1] * activeDays / monthLength(ms)
        let nextCost=0, nextDays=0
        for (let offset=1;offset<=3;offset++) {
          const next = months[Math.min(11,m+offset)]
          const d = addMonths(baseMonthMs,m+offset)
          nextCost += next.cmv[scenario][l-1]
          nextDays += monthLength(d)
        }
        const goal = config[`dde_alvo_linha_${l}`]
        const desiredDde = openingDde[l-1] + (goal-openingDde[l-1])*(m+1)/12
        const targetStock = Math.max(0, desiredDde*nextCost/nextDays)
        const toOrder = Math.max(0,cost+targetStock-inventory[l-1])
        inventory[l-1] = Math.max(0,inventory[l-1]+toOrder-cost)
        purchases[m] += toOrder
        const delay = config[`prazo_pagamento_linha_${l}`]
        const dueIndex = Math.round((activeStart+delay*DAY-todayMs)/DAY)
        if (dueIndex>=0 && dueIndex<dayCount) purchasePayments[dueIndex] += toOrder
      }
    }
    monthlyNewPurchases[scenario] = purchases

    const simulate = (source: "weekly"|"monthly", buy: boolean) => {
      let balance = contracts.openingCash!
      const weeklyEnds: number[] = []
      const monthlyEnds: number[] = []
      for (let day=0;day<(source==="weekly"?182:dayCount);day++) {
        const ms = todayMs+day*DAY
        const month = monthOfDay[day]
        let ar=0, ap=0
        if (source === "weekly") {
          ar = contracts.weeklyReceivables[Math.floor(day/7)]/7
          ap = contracts.weeklyPayables[Math.floor(day/7)]/7
        } else {
          const first = month===0
          const activeDays = monthLength(ms) - (first ? dayInMonth(todayMs)-1 : 0)
          ar = contracts.monthlyReceivables[month]/activeDays
          ap = contracts.monthlyPayables[month]/activeDays
        }
        const invoicing = invoiceByDay[day]
        const recovered = overdue*config.recuperacao_vencidos_semana/7 *
          Math.pow(1-config.recuperacao_vencidos_semana,Math.floor(day/7))
        let personnel = 0
        if (dayInMonth(ms) === 5) personnel += config.folha_mensal
        if (dayInMonth(ms) === 20) personnel += config.encargos_mensais
        const iso = isoDate(ms)
        if (iso === "2026-11-30" || iso === "2026-12-18") personnel += config.decimo_terceiro_2026/2
        balance += ar+receipts[day]+recovered-ap-
          invoicing*(config.despesas_pct+config.impostos_pct)-personnel-(buy?purchasePayments[day]:0)
        if ((day+1)%7===0 && source==="weekly") weeklyEnds.push(balance)
        if ((day+1===dayCount || monthOfDay[day+1]!==month) && source==="monthly") monthlyEnds.push(balance)
      }
      return source==="weekly"?weeklyEnds:monthlyEnds
    }
    weekly[scenario] = { withPurchases: simulate("weekly",true), withoutPurchases: simulate("weekly",false) }
    monthly[scenario] = simulate("monthly",true)
  }
  const warnings = [
    "Simulação de referência: compras e caixa NÃO homologados; nenhuma verba é liberada.",
    "Saldo-base bancário de " + contracts.base + " não reconciliado até a data da projeção; mudanças posteriores podem alterar todo o fluxo.",
    "Faltam entradas e saídas futuras não importadas: empréstimos, investimentos, pedidos a chegar, matéria-prima sazonal, liquidação de estoque e orçamento de despesas por categoria.",
    "Valores contratuais por competência distribuídos por dia no 12M; fluxo semanal usa títulos por semana.",
  ]
  return {
    state: "simulado", authorizesPurchases: false, warnings, monthLabels: calendarMonths,
    weekly, monthly, monthlyNewPurchases, safetyFloor: floor,
    minimum13WithPurchases: Math.min(...weekly.noventa.withPurchases.slice(0,13)),
    minimum13WithoutPurchases: Math.min(...weekly.noventa.withoutPurchases.slice(0,13)),
    minimum12: Math.min(...monthly.noventa), final12: monthly.noventa[11],
  }
}
