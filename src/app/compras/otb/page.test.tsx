import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const state=vi.hoisted(()=>({planCalls:[] as string[],seasonalCalls:[] as string[],failPlan:false,failSeasonal:false,failConsigned:false,consignedCalls:0}))

vi.mock("next/server",()=>({connection:async()=>undefined}))
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:async()=>({
  auth:{getUser:async()=>({data:{user:{email:"master@sosal.com.br"}},error:null})},
  rpc:async(name:string,args?:Record<string,unknown>)=>{
    if(name==="fn_listar_decisoes_compra")return {data:[],error:null}
    if(name==="fn_otb_posicao_subgrupos")return {data:[1,2,3,4].map(line=>({
      linha:line,grupo_subgrupo:line===3?"3.OUTROS / CHAPÉU":`${line}.LINHA / A`,
      estoque_custo:100,cmv_90d:300,sku_count:1,ultima_atualizacao:"2026-11-19T12:00:00Z",
    })),error:null}
    if(name==="fn_otb_estoque_consignado_237"){
      state.consignedCalls++
      if(state.failConsigned)return {data:null,error:{code:"57014"}}
      return {data:[{linha:3,grupo_subgrupo:"3.OUTROS / CHAPÉU",valor_consignado:"25",ultima_atualizacao:"2026-11-19T12:00:00Z"}],error:null}
    }
    if(name==="fn_compras_dashboard_config_237")return {data:[1,2,3,4].map(line=>({
      codigo:`dde_alvo_linha_${line}`,competencia:null,versao:"2.3.7",valor:30,
      origem_aba:"OTB",origem_celula:`H${line+5}`,situacao:"referencia",
    })),error:null}
    if(name==="fn_otb_venda_sazonal_237"){
      state.seasonalCalls.push(String(args?.p_mes_otb))
      if(state.failSeasonal)return {data:null,error:{code:"57014"}}
      return {data:[1,2,3,4].map(line=>({
        linha:line,grupo_subgrupo:line===3?"3.OUTROS / CHAPÉU":`${line}.LINHA / A`,
        venda_janela_1:"15000",venda_janela_2:"25000",venda_janela_3:"35000",venda_janela_4:"45000",
        meses_linha:6,
      })),error:null}
    }
    if(name==="fn_compras_plano_estoque_237"){
      const month=args?.p_competencia as string
      state.planCalls.push(month)
      if(state.failPlan)return {data:null,error:{code:"57014"}}
      return {data:[{grupo_subgrupo:"3.OUTROS / CHAP U",competencia:month,dde_meta:20,total_itens:1}],error:null}
    }
    return {data:[],error:null}
  },
})}))
vi.mock("@/domains/compras/domain/zacarini-cash-forecast",()=>({
  buildZacariniCashForecast:()=>{
    const todayParts=new Intl.DateTimeFormat("en-US",{year:"numeric",month:"2-digit",timeZone:"America/Campo_Grande"}).formatToParts(new Date())
    const year=Number(todayParts.find(p=>p.type==="year")?.value)
    const month=Number(todayParts.find(p=>p.type==="month")?.value)
    return {state:"simulado",monthLabels:Array.from({length:12},(_,index)=>new Date(Date.UTC(year,month-1+index,1)).toISOString().slice(0,10)),
      monthlyNewPurchases:{noventa:Array(12).fill(1000)},monthlyCmvByLine:{noventa:Array.from({length:12},()=>[300,300,300,300])}}
  },
}))
vi.mock("@/components/compras/otb-dashboard",()=>({OtbDashboard:({subgroupPreview,seasonalHistory,indicativeMonths,forecastIssues,consignedPosition}:{subgroupPreview:unknown;seasonalHistory:unknown;indicativeMonths:unknown;forecastIssues:unknown;consignedPosition:unknown})=><pre data-testid="otb-props">{JSON.stringify({subgroupPreview,seasonalHistory,indicativeMonths,forecastIssues,consignedPosition})}</pre>}))

afterEach(()=>{cleanup();state.planCalls=[];state.seasonalCalls=[];state.failPlan=false;state.failSeasonal=false;state.failConsigned=false;state.consignedCalls=0})

describe("OTB no servidor — ligação operacional Supabase",()=>{
  it("lê as três metas mensais e entrega prévia sem autorização ao componente",async()=>{
    const {OtbContent}=await import("./page")
    render(await OtbContent())
    const props=JSON.parse(screen.getByTestId("otb-props").textContent??"{}")
    expect(state.planCalls).toHaveLength(3)
    expect(state.seasonalCalls).toHaveLength(1)
    expect(state.seasonalCalls[0]).toBe(props.indicativeMonths[0].month)
    expect(props.seasonalHistory.state).toBe("conectado")
    expect(props.subgroupPreview.seasonality).toBe("venda_entregue")
    expect(new Set(state.planCalls).size).toBe(3)
    expect(props.subgroupPreview.state).toBe("calculado")
    expect(props.subgroupPreview.authorizesPurchases).toBe(false)
    expect(props.subgroupPreview.reconciledPlanGroups).toEqual(["3.OUTROS / CHAP U"])
    expect(state.consignedCalls).toBe(1)
    expect(props.consignedPosition.consignedCost).toBe(25)
    expect(props.subgroupPreview.rows.find((row:{name:string})=>row.name==="3.OUTROS / CHAPÉU").stockCost).toBe(75)
    expect(props.subgroupPreview.rows.find((row:{name:string})=>row.name==="3.OUTROS / CHAPÉU").targets[0])
      .toEqual({days:20,source:"plano"})
  })

  it("mostra falta da fonte sazonal quando a RPC falha sem autorizar compra",async()=>{
    state.failSeasonal=true
    const {OtbContent}=await import("./page")
    render(await OtbContent())
    const props=JSON.parse(screen.getByTestId("otb-props").textContent??"{}")
    expect(props.seasonalHistory.state).toBe("indisponivel")
    expect(props.subgroupPreview.seasonality).toBe("cmv_90d")
    expect(props.subgroupPreview.authorizesPurchases).toBe(false)
  })

  it("apresenta ausência de meta quando a RPC falha, sem criar saldo alternativo",async()=>{
    state.failPlan=true
    const {OtbContent}=await import("./page")
    render(await OtbContent())
    const props=JSON.parse(screen.getByTestId("otb-props").textContent??"{}")
    expect(props.subgroupPreview.state).toBe("indisponivel")
    expect(props.subgroupPreview.authorizesPurchases).toBe(false)
    expect(props.subgroupPreview).not.toHaveProperty("totals")
  })

  it("não calcula compra sobre estoque bruto quando falha a exclusão da marca consignada",async()=>{
    state.failConsigned=true
    const {OtbContent}=await import("./page")
    render(await OtbContent())
    const props=JSON.parse(screen.getByTestId("otb-props").textContent??"{}")
    expect(props.consignedPosition.state).toBe("indisponivel")
    expect(props.subgroupPreview.state).toBe("indisponivel")
    expect(props.subgroupPreview.authorizesPurchases).toBe(false)
  })
})
