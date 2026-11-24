import { describe, expect, it } from "vitest"
import { calculateBuyerBudget238, type Buyer238Input } from "./otb-buyer-budget-238"

/**
 * Golden values obtained directly from the supplied workbook 2.3.8:
 * "Verba Comprador"!B12:M16, C5:E9, "OTB"!R24 and I17:O20.
 * Names/labels say 85% but the effective formula is OTB!R24=0.9.
 * Synthetic rows below are accounting-equivalent grouped representatives,
 * not real product stock: only the totals, protected slices and balances
 * come from the workbook.
 */
const names = ["Nutrição", "Saúde", "Outros", "Pastagem"]
const workbook = [
  {
    month:"2026-12-01", cap:8381590.4696455672, days:31,
    desired:[1408995.9861644849,2512042.062531244,616898.38844132016,3005494.9855439607],
    protected:[0,1017494.0271446427,152497.81283754436,1202771.571983852],
    balance:[1565551.0957383164,1323692.49582231,-363208.68664611096,2703538.167954416],
    expectedBuyer:[1408995.9861644849,1323692.49582231,152497.81283754436,2703538.167954416],
    total:5588724.4627787545, desiredTotal:7543431.4226810094,
  },
  {
    month:"2027-01-01", cap:6387809.1413329616, days:31,
    desired:[1277879.3347482251,1363023.538324937,784082.8186386671,2324042.5354878372],
    protected:[0,0,0,0],
    balance:[1419865.9274980277,-15079.639722809894,2117.5111944759265,1978882.7894809232],
    expectedBuyer:[1277879.3347482251,0,2117.5111944759265,1978882.7894809232],
    total:3258879.635423624, desiredTotal:5749028.227199666,
  },
  {
    month:"2027-02-01", cap:5917956.6516225971, days:28,
    desired:[1236039.9677928986,1653748.8729617107,836065.103506959,1600307.042198769],
    protected:[0,0,0,1417618.8260072814],
    balance:[1373377.7419921095,707689.99277160247,271739.38354099228,1360461.2076867465],
    expectedBuyer:[1236039.9677928986,707689.99277160247,271739.38354099228,1417618.8260072814],
    total:3633088.1701127747, desiredTotal:5326160.9864603374,
  },
]
function setup(w: typeof workbook[number]):Buyer238Input {
  return {
    month:w.month,daysInMonth:w.days,cashCap:w.cap,share:0.9,
    lines:names.map((line,i)=>({line,availableAfterExcess:w.balance[i]})),
    subgroups:names.flatMap((line,i)=>{
      const rows=[]
      if(w.protected[i]>0)rows.push({
        line,name:line+" protegido",kind:"S" as const,need:w.protected[i]/0.9,
        openingStock:10,forecastCost:w.days,
      })
      const remaining=Math.max(0,w.desired[i]-w.protected[i])
      if(remaining>0)rows.push({
        line,name:line+" outros",kind:"S" as const,need:remaining/0.9,
        openingStock:100,forecastCost:w.days,
      })
      return rows
    }),
  }
}
describe("Verba Comprador Zacarini 2.3.8 – resultados das fórmulas fornecidas",()=>{
  for(const w of workbook)it("reproduz as quatro linhas e o total em "+w.month,()=>{
    const out=calculateBuyerBudget238(setup(w))
    expect(out.authorizesPurchases).toBe(false)
    expect(out.desired).toBeCloseTo(w.desiredTotal,2)
    expect(out.buyerTotal).toBeCloseTo(w.total,2)
    expect(out.cashCutFactor).toBeCloseTo(1,8)
    for(let i=0;i<names.length;i++){
      expect(out.lines.find(l=>l.line===names[i])!.buyer).toBeCloseTo(w.expectedBuyer[i],2)
    }
    expect(out.allocatedToSubgroups).toBeCloseTo(out.buyerTotal,2)
  })
  it("protege DDE<30 na trava e corta o resto antes do rateio da linha",()=>{
    const x=setup(workbook[0])
    x.cashCap=4000000
    const out=calculateBuyerBudget238(x)
    expect(out.cashCutFactor).toBeGreaterThan(0)
    expect(out.cashCutFactor).toBeLessThan(1)
    expect(out.protected).toBeCloseTo(2372763.4119660389,2)
    expect(out.buyerTotal).toBeGreaterThanOrEqual(out.protected-0.01)
  })
  it("expõe proteção que excede a trava, sem disfarçar como aprovada",()=>{
    const x=setup(workbook[0])
    x.cashCap=10000
    const out=calculateBuyerBudget238(x)
    expect(out.protectedAboveCashCap).toBe(true)
    expect(out.authorizesPurchases).toBe(false)
    expect(out.cashCutFactor).toBe(0)
  })
  it("não troca 90% por rótulo obsoleto 85% nem aceita linhas sem dados",()=>{
    const input=setup(workbook[0])
    expect(()=>calculateBuyerBudget238({...input,share:0.85})).toThrow(/90%/)
    expect(()=>calculateBuyerBudget238({...input,lines:input.lines.slice(0,1)})).toThrow(/não informado/)
  })
})
