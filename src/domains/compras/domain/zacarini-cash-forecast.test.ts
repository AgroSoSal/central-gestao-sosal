import { describe, expect, it } from "vitest"
import { buildZacariniCashForecast, type ForecastStockLine } from "./zacarini-cash-forecast"
import type { DashboardReferenceRow } from "./dashboard-zacarini-237"
import type { PartialCashSeries } from "./dashboard-cash-contracts"

const start = "2026-11-19"

function ref(codigo: string, valor: number, competencia: string | null = null): DashboardReferenceRow {
  return { codigo, valor, competencia, grupo: "caixa", dimensao: null, rotulo: codigo,
    unidade: "R$", origem_aba: "Fluxo de Caixa", origem_celula: "B9", versao: "2.3.7", situacao: "referencia" }
}

function fixtures(sales = 3000) {
  const rows: DashboardReferenceRow[] = [
    ref("minimo_caixa", 500000), ref("vendas_a_vista", .15), ref("recuperacao_vencidos_semana", .015),
    ref("fator_vendas_previstas", .9),
    ref("folha_mensal", 0), ref("encargos_mensais", 0), ref("decimo_terceiro_2026", 0),
    ref("salarios_base_2026", 0), ref("decimo_terceiro_parcela_1", 0), ref("decimo_terceiro_parcela_2", 0),
    ref("despesas_pct", 0), ref("impostos_pct", 0),
    ...[.349,.228,.31,.113].map((v,i) => ref(`curva_recebimento_faixa_${i+1}`,v)),
    ...[3,6,12,20].map((v,i) => ref(`atraso_recebimento_semanas_${i+1}`,v)),
    ...[1,2,3,4].map(i => ref(`prazo_pagamento_linha_${i}`, 47)),
    ...[1,2,3,4].map(i => ref(`dde_alvo_linha_${i}`, 60)),
  ]
  for (let m=0; m<12; m++) {
    const day = new Date(Date.UTC(2026, 10 + m, 1)).toISOString().slice(0,10)
    rows.push(ref("fluxo_meta_comercial_mes", sales, day))
    rows.push(ref("fluxo_extra_saude_mes", 0, day))
    for (const scenario of ["noventa", "plano", "historico"]) {
      rows.push(ref(`proj_faturamento_${scenario}`, sales, day))
      for (let line=1; line<=4; line++) rows.push(ref(`proj_entrega_${scenario}_linha_${line}`, 100, day))
    }
    for (let line=1; line<=4; line++) rows.push(ref(`proj_cmv_base_linha_${line}`, 50, day))
  }
  const partial: PartialCashSeries = { state: "parcial", base: "2026-11-11", openingCash: 1000000,
    warning: "Conciliação pendente.", weeklyReceivables: Array(26).fill(0), weeklyPayables: Array(26).fill(0),
    monthlyReceivables: Array(12).fill(0), monthlyPayables: Array(12).fill(0),
    receivables13: 0,payables13:0,receivables12:0,payables12:0,net12:0,lastPayablesImport:null }
  const stock: ForecastStockLine[] = [1,2,3,4].map(linha => ({ linha, estoque: 3000, cmv90: 150 }))
  return { rows, partial, stock }
}

describe("projeção de caixa Zacarini 2.3.7", () => {
  it("não calcula qualquer saldo quando falta uma premissa, carteira ou posição de estoque", () => {
    const f = fixtures()
    expect(buildZacariniCashForecast({ today:start, references:f.rows.slice(1), contracts:f.partial, stock:f.stock, overdue:0 }).state).toBe("indisponivel")
    expect(buildZacariniCashForecast({ today:start, references:f.rows, contracts:f.partial, stock:f.stock.slice(1), overdue:0 }).state).toBe("indisponivel")
    expect(buildZacariniCashForecast({ today:start, references:f.rows, contracts:{ ...f.partial, state:"indisponivel" }, stock:f.stock, overdue:0 }).state).toBe("indisponivel")
  })

  it("conserva 15% à vista e aplica a curva completa de 3/6/12/20 semanas sem recebimento duplicado", () => {
    const f = fixtures(3100)
    const result = buildZacariniCashForecast({ today:start, references:f.rows, contracts:f.partial, stock:f.stock, overdue:0 })
    expect(result.state).toBe("simulado")
    if (result.state !== "simulado") return
    // Fluxo B34: mês comercial NOV tem 31 dias (26/10 a 25/11), fator 90%.
    expect(result.weekly["noventa"].withoutPurchases[0]).toBeCloseTo(1000000 + 7*3100*.9/31*.15, 4)
    expect(result.weekly["noventa"].withoutPurchases[3] - result.weekly["noventa"].withoutPurchases[2]).toBeGreaterThan(7*3100*.9/31*.15)
    expect(result.monthly.noventa.length).toBe(12)
    expect(result.weekly.noventa.withPurchases.length).toBe(26)
  })

  it("pagamentos de compras novas só reduzem o cenário com compras, no prazo configurado", () => {
    const f = fixtures(0)
    // A referência de CMV já gera necessidade de reposição, mesmo com faturamento zero.
    const result = buildZacariniCashForecast({ today:start, references:f.rows, contracts:f.partial,
      stock:[1,2,3,4].map(linha => ({ linha, estoque:0, cmv90:150 })), overdue:0 })
    expect(result.state).toBe("simulado")
    if (result.state !== "simulado") return
    expect(result.weekly.noventa.withPurchases[4]).toBeCloseTo(result.weekly.noventa.withoutPurchases[4], 4)
    expect(result.weekly.noventa.withPurchases[8]).toBeLessThan(result.weekly.noventa.withoutPurchases[8])
    expect(result.minimum13WithoutPurchases).toBeGreaterThanOrEqual(result.minimum13WithPurchases)
  })

  it("projeções de 12 meses calculam piso e saldo final, mas nunca aprovam OTB", () => {
    const f = fixtures(3000)
    const result = buildZacariniCashForecast({ today:start, references:f.rows, contracts:f.partial, stock:f.stock, overdue:5000 })
    expect(result.state).toBe("simulado")
    if (result.state !== "simulado") return
    expect(result.minimum12).toBe(Math.min(...result.monthly.noventa))
    expect(result.final12).toBe(result.monthly.noventa.at(-1))
    expect(result.authorizesPurchases).toBe(false)
    expect(result.warnings.join(" ")).toMatch(/concilia|homolog/i)
  })

  it("expõe os quatro componentes mensais de CMV e reposição para a OTB sem duplicar o total",()=>{
    const f=fixtures(3000)
    const result=buildZacariniCashForecast({today:start,references:f.rows,contracts:f.partial,
      stock:[1,2,3,4].map(linha=>({linha,estoque:0,cmv90:150})),overdue:0})
    expect(result.state).toBe("simulado")
    if(result.state!=="simulado")return
    expect(result.monthlyCmvByLine.noventa).toHaveLength(12)
    expect(result.monthlyNewPurchasesByLine.noventa).toHaveLength(12)
    for(let month=0;month<12;month++){
      expect(result.monthlyCmvByLine.noventa[month]).toEqual([50,50,50,50])
      expect(result.monthlyNewPurchasesByLine.noventa[month]).toHaveLength(4)
      expect(result.monthlyNewPurchasesByLine.noventa[month].reduce((a,b)=>a+b,0))
        .toBeCloseTo(result.monthlyNewPurchases.noventa[month],6)
    }
    expect(result.authorizesPurchases).toBe(false)
  })

  it("repete a recuperação de vencidos em valor fixo a cada semana, como Fluxo B38", () => {
    const f = fixtures(0)
    const result = buildZacariniCashForecast({ today:start, references:f.rows, contracts:f.partial,
      stock:f.stock, overdue:1000 })
    expect(result.state).toBe("simulado")
    if (result.state !== "simulado") return
    expect(result.weekly.noventa.withoutPurchases[0]).toBeCloseTo(1000015, 3)
    expect(result.weekly.noventa.withoutPurchases[1]).toBeCloseTo(1000030, 3)
  })

  it("separa salários, encargos semanais e duas parcelas reais do 13º, sem duplicar a folha", () => {
    const f = fixtures(0)
    const set = (code:string, value:number) => { f.rows.find(r => r.codigo===code)!.valor=value }
    set("salarios_base_2026", 500)
    set("encargos_mensais", 520)
    set("folha_mensal", 1020)
    set("decimo_terceiro_2026", 400)
    set("decimo_terceiro_parcela_1", 100)
    set("decimo_terceiro_parcela_2", 300)
    const result = buildZacariniCashForecast({ today:start, references:f.rows, contracts:f.partial,
      stock:f.stock, overdue:0 })
    expect(result.state).toBe("simulado")
    if (result.state !== "simulado") return
    const curve = result.weekly.noventa.withoutPurchases
    expect(curve[0]).toBeCloseTo(1000000-520*12/52,3)
    expect(curve[1]).toBeCloseTo(1000000-2*520*12/52-100,3)
    expect(curve[2]).toBeCloseTo(1000000-3*520*12/52-100-500,3)
    expect(curve[4]).toBeCloseTo(1000000-5*520*12/52-100-500-300,3)
  })

  it("segue a meta do mês comercial 26–25 e a venda extra de Saúde do Fluxo B34", () => {
    const f = fixtures(0)
    const nov = f.rows.find(r=>r.codigo==="fluxo_meta_comercial_mes"&&r.competencia==="2026-11-01")!
    nov.valor=10000000
    f.rows.find(r=>r.codigo==="fluxo_extra_saude_mes"&&r.competencia==="2026-11-01")!.valor=2559288.2193603679
    const result = buildZacariniCashForecast({today:start,references:f.rows,contracts:f.partial,stock:f.stock,overdue:0})
    expect(result.state).toBe("simulado")
    if (result.state !== "simulado") return
    const weeklySale = (10000000*.9+2559288.2193603679)*7/31
    expect(weeklySale).toBeCloseTo(2610161.8559845993,5) // Fluxo de Caixa!B34 da Zacarini
    expect(result.weekly.noventa.withoutPurchases[0]).toBeCloseTo(1000000+weeklySale*.15,3)
  })

  it("aplica o PIOR CASO CORRETO: Saúde compra pelo plano mas não recebe o extra projetado", () => {
    const f=fixtures(3100)
    f.rows.find(r=>r.codigo==="fluxo_extra_saude_mes"&&r.competencia==="2026-11-01")!.valor=930
    const result=buildZacariniCashForecast({today:start,references:f.rows,contracts:f.partial,stock:f.stock,overdue:0})
    expect(result.state).toBe("simulado")
    if(result.state!=="simulado") return
    // Novembro: 12 dias futuros, somente 15% do extra cai à vista no próprio mês.
    expect(result.monthly.noventa[0]-result.monthlyWorst[0]).toBeCloseTo(930*12/30*.15,2)
    expect(result.monthlyWorst[1]).toBeLessThan(result.monthly.noventa[1])
    expect(result.minimumWorst12).toBe(Math.min(...result.monthlyWorst))
    expect(result.authorizesPurchases).toBe(false)
  })
})
