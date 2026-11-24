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


/** Valores de subgrupos reais extraídos do XLSX enviado, e não apenas
 * totais sintéticos: Verba Comprador!G/K/O25,26,144,145;
 * OTB!Q/R/S, Z/AA/AB, AI/AJ/AK nas respectivas linhas + 28.
 * As linhas "restantes" preservam exatamente os totais da planilha para
 * reproduzir o rateio de cada subgrupo com os mesmos denominadores.
 */
type SubgroupGolden = {
  line: string; name: string; openingStock: number
  forecastCost: number; need: number; expectedBuyer: number
}
const samples: SubgroupGolden[][] = [
  [
    {line:"Nutrição",name:"MATÉRIA PRIMA",openingStock:3463148.44,forecastCost:1722778.1899303021,need:1565551.0957383164,expectedBuyer:1408995.9861644849},
    {line:"Saúde",name:"HOMEOPATICOS",openingStock:96232.15,forecastCost:47418.032234654493,need:139630.98032501992,expectedBuyer:25746.454586172411},
    {line:"Saúde",name:"EQUINOS",openingStock:79750.040000000008,forecastCost:19730.600714729171,need:0,expectedBuyer:0},
    {line:"Pastagem",name:"SEMENTES",openingStock:1283540.1299999997,forecastCost:489546.94246516732,need:459123.48382769665,expectedBuyer:343998.12222671701},
  ],
  [
    {line:"Nutrição",name:"MATÉRIA PRIMA",openingStock:3305921.3458080143,forecastCost:1218936.156427569,need:1419865.9274980277,expectedBuyer:1277879.3347482251},
    {line:"Saúde",name:"HOMEOPATICOS",openingStock:188445.09809036541,forecastCost:49504.939166078126,need:40836.093626899354,expectedBuyer:0},
    {line:"Saúde",name:"EQUINOS",openingStock:60019.439285270841,forecastCost:19507.127284647915,need:21622.469215134217,expectedBuyer:0},
    {line:"Pastagem",name:"SEMENTES",openingStock:1253116.671362529,forecastCost:658340.67631289468,need:487618.3576552365,expectedBuyer:373678.88279063546},
  ],
  [
    {line:"Nutrição",name:"MATÉRIA PRIMA",openingStock:3506851.1168784732,forecastCost:1680712.4732309387,need:1373377.7419921095,expectedBuyer:1236039.9677928986},
    {line:"Saúde",name:"HOMEOPATICOS",openingStock:179776.25255118666,forecastCost:63445.275979898041,need:0,expectedBuyer:0},
    {line:"Saúde",name:"EQUINOS",openingStock:62134.781215757146,forecastCost:27410.171576066954,need:18966.409101348647,expectedBuyer:7304.678676042673},
    {line:"Pastagem",name:"SEMENTES",openingStock:1082394.352704871,forecastCost:852996.78203708085,need:170312.85708364821,expectedBuyer:0},
  ],
]
describe("Zacarini 2.3.8 – paridade de rateio por subgrupo e por linha",()=>{
  for(let i=0;i<workbook.length;i++){
    const reference=workbook[i]
    it("reproduz cada subgrupo de controle e o total de "+reference.month,()=>{
      const source=samples[i]
      const selected=source.map(row=>({
        line:row.line,name:row.name,kind:"S" as const,
        need:row.need,openingStock:row.openingStock,forecastCost:row.forecastCost,
      }))
      const rest:Buyer238Input["subgroups"][number][]=[]
      names.forEach((line,index)=>{
        const own=source.filter(row=>row.line===line)
        const fromSource=own.reduce((total,row)=>total+row.need*0.9,0)
        const protectedSource=own.reduce((total,row)=>
          total+(row.forecastCost>0&&row.openingStock/(row.forecastCost/reference.days)<30?row.need*0.9:0),0)
        const protectedRemaining=reference.protected[index]-protectedSource
        const unprotectedRemaining=reference.desired[index]-reference.protected[index]-
          (fromSource-protectedSource)
        expect(protectedRemaining).toBeGreaterThanOrEqual(-0.0001)
        expect(unprotectedRemaining).toBeGreaterThanOrEqual(-0.0001)
        if(protectedRemaining>0.0001)rest.push({
          line,name:line+" restante DDE menor que 30",kind:"S",
          need:protectedRemaining/0.9,openingStock:10,forecastCost:reference.days,
        })
        if(unprotectedRemaining>0.0001)rest.push({
          line,name:line+" restante DDE maior que 30",kind:"S",
          need:unprotectedRemaining/0.9,openingStock:100,forecastCost:reference.days,
        })
      })
      const budget=calculateBuyerBudget238({
        month:reference.month,cashCap:reference.cap,daysInMonth:reference.days,
        share:0.9,subgroups:[...selected,...rest],
        lines:names.map((line,index)=>({line,availableAfterExcess:reference.balance[index]})),
      })
      expect(budget.desired).toBeCloseTo(reference.desiredTotal,2)
      expect(budget.protected).toBeCloseTo(reference.protected.reduce((a,b)=>a+b,0),2)
      expect(budget.buyerTotal).toBeCloseTo(reference.total,2)
      expect(budget.allocatedToSubgroups).toBeCloseTo(budget.buyerTotal,2)
      for(const example of source){
        const result=budget.subgroups.find(row=>row.line===example.line&&row.name===example.name)
        expect(result,example.name+" em "+reference.month).toBeDefined()
        expect(result!.buyer,example.name+" em "+reference.month)
          .toBeCloseTo(example.expectedBuyer,2)
      }
    })
  }
  it("só protege DDE estritamente inferior a 30 e deixa P/M/N com verba zero",()=>{
    const budget=calculateBuyerBudget238({
      month:"2026-12-01",daysInMonth:30,cashCap:1000,share:0.9,
      lines:[{line:"Saúde",availableAfterExcess:1000}],
      subgroups:[
        {line:"Saúde",name:"DDE igual a 30",kind:"S",need:400,openingStock:30,forecastCost:30},
        {line:"Saúde",name:"DDE igual a 29,99",kind:"S",need:400,openingStock:29.99,forecastCost:30},
        {line:"Saúde",name:"Produção",kind:"P",need:1000,openingStock:0,forecastCost:30},
        {line:"Saúde",name:"Núcleo",kind:"M",need:1000,openingStock:0,forecastCost:30},
        {line:"Saúde",name:"Fora da OTB",kind:"N",need:1000,openingStock:0,forecastCost:30},
      ],
    })
    expect(budget.subgroups.find(s=>s.name==="DDE igual a 30")!.isProtected).toBe(false)
    expect(budget.subgroups.find(s=>s.name==="DDE igual a 29,99")!.isProtected).toBe(true)
    expect(budget.subgroups.filter(s=>s.kind!=="S").every(s=>s.buyer===0)).toBe(true)
  })
})
