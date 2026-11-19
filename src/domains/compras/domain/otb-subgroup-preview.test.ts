import { describe, expect, it } from "vitest"
import { buildOtbSubgroupPreview } from "./otb-subgroup-preview"

const referenceMonths=Array.from({length:12},(_,i)=>new Date(Date.UTC(2026,10+i,1)).toISOString().slice(0,10))
const futureMonths=referenceMonths.slice(1,4) as [string,string,string]
const projectedCmv=referenceMonths.map(()=>[100,200,300,400])
const base={months:futureMonths,referenceMonths,projectedCmv,
  positions:[
    {line:1,subgroup:"1.LINHA / A",stockCost:10,cmv90d:60},
    {line:1,subgroup:"1.LINHA / B",stockCost:30,cmv90d:40},
  ],
  plans:futureMonths.map(competencia=>({grupo_subgrupo:"1.LINHA / A",competencia,dde_meta:10})),
  fallbackDde:{1:20,2:30,3:40,4:50},
}

describe("prévia da OTB por subgrupo independente da planilha",()=>{
  it("usa OTB!D/E/F projetados por SKU, vendas entregues e pesos BH/BI para custo futuro",()=>{
    const preview=buildOtbSubgroupPreview({...base,
      projectedDeliveries:referenceMonths.map(()=>[200,400,600,800]),
      positions:[
        {...base.positions[0],projectedSales90d:600,projectedCmv90d:480,curveASales90d:500},
        {...base.positions[1],projectedSales90d:400,projectedCmv90d:200,curveASales90d:200},
      ],
      historicalSales:[
        {line:1,name:"1.LINHA / A",sales:[70000,3000,70000,10000]},
        {line:1,name:"1.LINHA / B",sales:[30000,97000,30000,90000]},
      ],
    })
    expect(preview.state).toBe("calculado")
    if(preview.state!=="calculado")return
    const a=preview.rows[0]
    expect(preview.seasonality).toBe("venda_abc_237")
    expect(a.share).toBeCloseTo(.6)
    expect(a.seasonalWeights![0]).toBeCloseTo(.7)
    expect(a.months![0].forecastCost).toBeCloseTo(200*.7*.8)
    expect(a.months![0].targetStock).toBeCloseTo(200*(.6/(.6+.97))*.8*10/30)
    expect(preview.authorizesPurchases).toBe(false)
  })
  it("aplica as quatro janelas de venda entregue da Zacarini quando a fonte Master está disponível",()=>{
    const preview=buildOtbSubgroupPreview({...base,historicalSales:[
      {line:1,name:"1.LINHA / A",sales:[70000,3000,70000,10000]},
      {line:1,name:"1.LINHA / B",sales:[30000,97000,30000,90000]},
    ]})
    expect(preview.state).toBe("calculado")
    if(preview.state!=="calculado")return
    const a=preview.rows.find(r=>r.name==="1.LINHA / A")!
    expect(preview.seasonality).toBe("venda_entregue")
    expect(a.seasonalWeights![0]).toBeCloseTo(.7)
    expect(a.seasonalWeights![1]).toBeCloseTo(.6/(.6+.97))
    expect(a.months![0].forecastCost).toBeCloseTo(70)
    expect(a.months![0].targetStock).toBeCloseTo(100*(.6/(.6+.97))*10/30)
    expect(preview.authorizesPurchases).toBe(false)
  })
  it("distribui o CMV futuro da linha pela participação histórica e aplica DDE por subgrupo",()=>{
    const preview=buildOtbSubgroupPreview(base)
    expect(preview.state).toBe("calculado")
    if(preview.state!=="calculado")return
    const a=preview.rows.find(r=>r.name==="1.LINHA / A")!
    const b=preview.rows.find(r=>r.name==="1.LINHA / B")!
    expect(a.targets[0]).toMatchObject({days:10,source:"plano"})
    expect(b.targets[0]).toMatchObject({days:20,source:"linha"})
    expect(a.months![0].forecastCost).toBeCloseTo(60)
    expect(a.months![0].targetStock).toBeCloseTo(20)
    expect(a.months![0].need).toBeCloseTo(70)
    expect(b.months![0].forecastCost).toBeCloseTo(40)
    expect(b.months![0].targetStock).toBeCloseTo(40/30*20)
    expect(b.months![0].need).toBeCloseTo(40+40/30*20-30)
    expect(preview.totals[1]![0]).toBeCloseTo(a.months![0].need+b.months![0].need)
    expect(preview.authorizesPurchases).toBe(false)
  })

  it("recusa o total da linha quando um subgrupo não tem CMV, sem assumir zero",()=>{
    const preview=buildOtbSubgroupPreview({...base,positions:[...base.positions,{line:1,subgroup:"1.LINHA / C",stockCost:10,cmv90d:null}]})
    expect(preview.state).toBe("calculado")
    if(preview.state!=="calculado")return
    expect(preview.rows.every(r=>r.issue!==null)).toBe(true)
    expect(preview.totals[1]).toEqual([null,null,null])
  })

  it("não inventa metas se faltar meta individual e a premissa geral de DDE",()=>{
    const preview=buildOtbSubgroupPreview({...base,plans:[],fallbackDde:{}})
    expect(preview.state).toBe("calculado")
    if(preview.state!=="calculado")return
    expect(preview.rows[0].months).toBeNull()
    expect(preview.rows[0].issue).toMatch(/DDE/)
    expect(preview.totals[1]).toEqual([null,null,null])
  })

  it("bloqueia fonte sem os meses futuros necessários, mesmo que haja estoque",()=>{
    expect(buildOtbSubgroupPreview({...base,referenceMonths:referenceMonths.slice(0,4),projectedCmv:projectedCmv.slice(0,4)}).state)
      .toBe("indisponivel")
  })

  it("identifica metas sem correspondência literal, preservando nomes distintos",()=>{
    const preview=buildOtbSubgroupPreview({...base,plans:[...base.plans,{grupo_subgrupo:"1.LINHA / OUTRO NOME",competencia:futureMonths[0],dde_meta:45}]})
    expect(preview.state).toBe("calculado")
    if(preview.state!=="calculado")return
    expect(preview.unmatchedPlanGroups).toEqual(["1.LINHA / OUTRO NOME"])
  })

  it("reconcilia caracteres acentuados perdidos na extração quando há um único nome possível",()=>{
    const position="3.OUTROS / ACESSÓRIOS PARA VEÍCULOS / BATERIAS"
    const truncated="3.OUTROS / ACESS RIOS PARA VE CULOS / BATERIAS"
    const preview=buildOtbSubgroupPreview({...base,
      positions:[{line:3,subgroup:position,stockCost:100,cmv90d:300}],
      plans:futureMonths.map(competencia=>({grupo_subgrupo:truncated,competencia,dde_meta:25})),
    })
    expect(preview.state).toBe("calculado")
    if(preview.state!=="calculado")return
    expect(preview.rows[0].targets[0]).toEqual({days:25,source:"plano"})
    expect(preview.unmatchedPlanGroups).toEqual([])
    expect(preview.reconciledPlanGroups).toEqual([truncated])
  })

  it("não faz reconciliação da extração se dois nomes de cadastro são compatíveis",()=>{
    const truncated="3.OUTROS / APARELHO E ACESSORIOS VETERIN "
    const preview=buildOtbSubgroupPreview({...base,
      positions:[
        {line:3,subgroup:"3.OUTROS / APARELHO E ACESSORIOS VETERINÁ",stockCost:100,cmv90d:300},
        {line:3,subgroup:"3.OUTROS / APARELHO E ACESSORIOS VETERINÀ",stockCost:100,cmv90d:300},
      ],
      plans:futureMonths.map(competencia=>({grupo_subgrupo:truncated,competencia,dde_meta:25})),
    })
    expect(preview.state).toBe("calculado")
    if(preview.state!=="calculado")return
    expect(preview.unmatchedPlanGroups).toEqual([truncated])
    expect(preview.rows.every(row=>row.targets[0].source==="linha")).toBe(true)
  })
})
