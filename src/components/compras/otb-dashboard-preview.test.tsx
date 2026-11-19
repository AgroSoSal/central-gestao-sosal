import { renderToStaticMarkup } from "react-dom/server"
import { describe,expect,it,vi } from "vitest"
import { OtbDashboard } from "./otb-dashboard"

vi.mock("@/components/compras/compras-auth",()=>({ComprasSair:()=>null}))

describe("OTB — prévia integrada da Projeção 12M e estoque",()=>{
  it("exibe as quatro janelas reais da venda entregue, separadas da OTB liberada",()=>{
    const html=renderToStaticMarkup(<OtbDashboard email="master@sosal.com.br"
      purchaseSource={{status:"indisponivel",itemCount:null,lastImportedAt:null}}
      historicalSource={{status:"indisponivel",firstMonth:null,lastMonth:null,monthCount:null,totalRecords:null,excludedRecords:null,unmappedRecords:null,completeLast12Months:false}}
      stockPosition={{status:"indisponivel",snapshotAt:null,stockCost:null,cmv90d:null,stockSkus:null,subgroups:[]}}
      seasonalHistory={{state:"conectado",month:"2026-12-01",windowMonths:[
        "2025-12 a 2026-02","2026-01 a 2026-03","2026-02 a 2026-04","2026-03 a 2026-05"],
        groups:[{line:1,name:"1.LINHA / MINERAL",sales:[3221151,3379136,3777908,3994738]}]}} />)
    expect(html).toContain("Sazonalidade por subgrupo")
    expect(html).toContain("2025-12 a 2026-02")
    expect(html).toContain("1.LINHA / MINERAL")
    expect(html).toContain("3.221.151")
    expect(html).toContain("não libera compras")
  })
  it("mostra necessidades por linha e subgrupo sem apresentá-las como verba liberada",()=>{
    const html=renderToStaticMarkup(<OtbDashboard email="master@sosal.com.br"
      purchaseSource={{status:"indisponivel",itemCount:null,lastImportedAt:null}}
      historicalSource={{status:"indisponivel",firstMonth:null,lastMonth:null,monthCount:null,totalRecords:null,excludedRecords:null,unmappedRecords:null,completeLast12Months:false}}
      stockPosition={{status:"indisponivel",snapshotAt:null,stockCost:null,cmv90d:null,stockSkus:null,subgroups:[]}}
      indicativeMonths={[{month:"2026-12-01",amount:70},{month:"2027-01-01",amount:90},{month:"2027-02-01",amount:80}]}
      subgroupPreview={{state:"calculado",authorizesPurchases:false,seasonality:"cmv_90d",months:["2026-12-01","2027-01-01","2027-02-01"],unmatchedPlanGroups:[],reconciledPlanGroups:[],totals:{1:[70,80,90],2:[null,null,null],3:[null,null,null],4:[null,null,null]},rows:[
        {line:1,name:"1.LINHA / MINERAL",stockCost:10,cmv90d:60,share:1,seasonalWeights:null,targets:[{days:20,source:"plano"},{days:20,source:"plano"},{days:20,source:"linha"}],issue:null,months:[
          {month:"2026-12-01",openingStock:10,forecastCost:60,targetStock:20,need:70,closingStock:20},
          {month:"2027-01-01",openingStock:20,forecastCost:80,targetStock:20,need:80,closingStock:20},
          {month:"2027-02-01",openingStock:20,forecastCost:90,targetStock:20,need:90,closingStock:20},
        ]},
      ]}}/>)
    expect(html).toContain("Reposição por subgrupo")
    expect(html).toContain("1.LINHA / MINERAL")
    expect(html).toContain("Participação histórica")
    expect(html).toContain("Sem autorização de compras")
    expect(html).not.toContain("Projeção oficial do Supabase")
  })

  it("explica qual fonte impediu a prévia sem apresentar valores fictícios",()=>{
    const html=renderToStaticMarkup(<OtbDashboard email="master@sosal.com.br"
      purchaseSource={{status:"indisponivel",itemCount:null,lastImportedAt:null}}
      historicalSource={{status:"indisponivel",firstMonth:null,lastMonth:null,monthCount:null,totalRecords:null,excludedRecords:null,unmappedRecords:null,completeLast12Months:false}}
      stockPosition={{status:"indisponivel",snapshotAt:null,stockCost:null,cmv90d:null,stockSkus:null,subgroups:[]}}
      forecastIssues={["Sem metas futuras para as quatro linhas."]}/>)
    expect(html).toContain("Sem metas futuras para as quatro linhas")
    expect(html).not.toContain("Necessidade simulada por subgrupo")
  })
})
