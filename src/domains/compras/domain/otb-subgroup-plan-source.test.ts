import {describe,expect,it,vi} from "vitest"
import { fetchOtbSubgroupPlans } from "./otb-subgroup-plan-source"

const months=["2026-12-01","2027-01-01","2027-02-01"] as const
describe("leitura protegida de metas do OTB",()=>{
  it("consulta exatamente as três competências e rejeita totais parciais",async()=>{
    const fetch=vi.fn(async(month:string)=>({data:[
      {grupo_subgrupo:"1.LINHA / A",competencia:month,dde_meta:45,total_itens:1},
    ],error:null}))
    const result=await fetchOtbSubgroupPlans(months,fetch)
    expect(fetch.mock.calls.map(call=>call[0])).toEqual(months)
    expect(result.state).toBe("conectado")
    if(result.state==="conectado"){
      expect(result.plans).toHaveLength(3)
      expect(result.plans[0]).toMatchObject({grupo_subgrupo:"1.LINHA / A",competencia:months[0]})
    }
  })

  it("não presume DDE da planilha se a consulta falha",async()=>{
    const fetch=vi.fn(async(month:string)=>({data:month===months[1]?null:[{grupo_subgrupo:"A",competencia:month,dde_meta:40,total_itens:1}],error:month===months[1]?{code:"57014"}:null}))
    expect((await fetchOtbSubgroupPlans(months,fetch)).state).toBe("indisponivel")
  })

  it("bloqueia data de competência trocada ou página incompleta",async()=>{
    const partial=async(month:string)=>({data:[{grupo_subgrupo:"A",competencia:month,dde_meta:40,total_itens:2}],error:null})
    expect((await fetchOtbSubgroupPlans(months,partial)).state).toBe("indisponivel")
    const wrongMonth=async()=>({data:[{grupo_subgrupo:"A",competencia:"2026-11-01",dde_meta:40,total_itens:1}],error:null})
    expect((await fetchOtbSubgroupPlans(months,wrongMonth)).state).toBe("indisponivel")
  })

  it("recusa competências sem planejamento ou cadastro desigual entre os meses",async()=>{
    const empty=async(month:string)=>({data:month===months[1]?[]:[{grupo_subgrupo:"A",competencia:month,dde_meta:40,total_itens:1}],error:null})
    expect((await fetchOtbSubgroupPlans(months,empty)).state).toBe("indisponivel")
    const inconsistent=async(month:string)=>({data:[{grupo_subgrupo:month===months[1]?"B":"A",competencia:month,dde_meta:40,total_itens:1}],error:null})
    expect((await fetchOtbSubgroupPlans(months,inconsistent)).state).toBe("indisponivel")
  })
})
