import { describe, expect, it } from "vitest"
import { buildOtb12mDraftRows, validateOtb12mDraftRows } from "./otb-projection-draft-12m"
import type { CashForecastResult } from "./zacarini-cash-forecast"

const sample = () => {
  const labels=Array.from({length:12},(_,n)=>new Date(Date.UTC(2026,10+n,1)).toISOString().slice(0,10))
  return {
    state:"simulado",authorizesPurchases:false,monthLabels:labels,
    monthly:{noventa:labels.map((_,i)=>100+i),plano:labels.map((_,i)=>200+i),historico:labels.map((_,i)=>300+i)},
    monthlyWorst:labels.map((_,i)=>-20-i),
    monthlyNewPurchases:{noventa:labels.map((_,i)=>900+i),plano:[],historico:[]},
  } as unknown as CashForecastResult
}
describe("foto 12M versionada não é aprovação de compras",()=>{
  it("reproduz três cenários e pior caso sem inventar campos",()=>{
    const rows=buildOtb12mDraftRows(sample())
    expect(rows).toHaveLength(12)
    expect(rows?.[0]).toEqual({mes:"2026-11-01",noventa:100,plano:200,historico:300,pior:-20,reposicao:900})
    expect(rows?.[11].mes).toBe("2027-10-01")
    expect(validateOtb12mDraftRows(rows,"2026-11-23")).toBe(true)
    expect(rows?.[0]).not.toHaveProperty("teto_oficial")
  })
  it("rejeita meses ausentes, duplicados ou dados adicionais",()=>{
    const rows=buildOtb12mDraftRows(sample())!
    expect(validateOtb12mDraftRows(rows.slice(0,11),"2026-11-23")).toBe(false)
    expect(validateOtb12mDraftRows([{...rows[0]},{...rows[0]},...rows.slice(2)],"2026-11-23")).toBe(false)
    expect(validateOtb12mDraftRows([{...rows[0],liberado:true},...rows.slice(1)],"2026-11-23")).toBe(false)
  })
  it("bloqueia infinito, reposição negativa e cenários incompletos",()=>{
    const rows=buildOtb12mDraftRows(sample())!
    expect(validateOtb12mDraftRows([{...rows[0],pior:Infinity},...rows.slice(1)],"2026-11-23")).toBe(false)
    expect(validateOtb12mDraftRows([{...rows[0],reposicao:-1},...rows.slice(1)],"2026-11-23")).toBe(false)
    expect(buildOtb12mDraftRows({ ...sample(), monthlyWorst:[] } as CashForecastResult)).toBeNull()
    expect(buildOtb12mDraftRows({state:"indisponivel",reasons:[],authorizesPurchases:false})).toBeNull()
  })
})
