/**
 * Gestão Zacarini 2.3.8 – aba "Verba Comprador", linhas 5:16 e 20:145.
 *
 * Observação: há rótulos "85%" antigos na pasta, porém as fórmulas
 * E20/I20/M20 aplicam OTB!R24 = 0,90. Não transformar rótulo em regra.
 * A verba do comprador é calculada após a trava financeira, com proteção
 * de subgrupo com DDE inicial inferior a 30 dias e limite por linha.
 *
 * Apenas cálculo de referência. Não produz aprovação, nem cria compras.
 */
export type Buyer238Subgroup = {
  line: string
  name: string
  kind: "S" | "P" | "M" | "N"
  need: number
  openingStock: number
  forecastCost: number
}
export type Buyer238LineBalance = { line: string; availableAfterExcess: number }
export type Buyer238Input = {
  month: string
  cashCap: number
  daysInMonth: number
  share: number
  subgroups: readonly Buyer238Subgroup[]
  lines: readonly Buyer238LineBalance[]
}
export type Buyer238SubgroupAllocation = {
  line: string
  name: string
  kind: "S" | "P" | "M" | "N"
  ddeOpening: number | null
  desired: number
  isProtected: boolean
  afterCashCut: number
  buyer: number
}
export type Buyer238Line = {
  line: string
  desired: number
  protected: number
  afterCashCut: number
  availableAfterExcess: number
  buyer: number
  allocatedToSubgroups: number
}
export type Buyer238Result = {
  version: "ZACARINI_238"
  authorizesPurchases: false
  desired: number
  protected: number
  cashCutFactor: number
  buyerTotal: number
  allocatedToSubgroups: number
  protectedAboveCashCap: boolean
  lines: Buyer238Line[]
  /** Rateio por subgrupo: Verba Comprador!E:G/I:K/M:O, sem aprovação. */
  subgroups: Buyer238SubgroupAllocation[]
}

function finite(value: unknown, label: string, min = Number.NEGATIVE_INFINITY) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || Math.abs(value) > 1e12) {
    throw new RangeError("Verba Comprador 2.3.8: campo inválido ou ausente: " + label)
  }
  return value
}

export function calculateBuyerBudget238(input: Buyer238Input): Buyer238Result {
  if (!/^20\d{2}-(0[1-9]|1[0-2])-01$/.test(input.month)) throw new RangeError("Mês inválido.")
  finite(input.cashCap, "teto de caixa", 0)
  if (!Number.isInteger(input.daysInMonth) || input.daysInMonth<28 || input.daysInMonth>31) {
    throw new RangeError("Número de dias inválido.")
  }
  finite(input.share, "OTB!R24", 0)
  if (Math.abs(input.share-0.9)>1e-9) throw new RangeError("A fonte OTB!R24 da versão 2.3.8 é 90%, apesar dos rótulos desatualizados de 85%.")
  const buckets = new Map<string, {
    desired:number; protected:number; afterCashCut:number;
    availableAfterExcess:number; buyer:number; allocatedToSubgroups:number;
  }>()
  for (const line of input.lines) {
    if (!line.line?.trim() || buckets.has(line.line)) throw new RangeError("Linha inválida ou duplicada.")
    buckets.set(line.line,{
      desired:0,protected:0,afterCashCut:0,
      availableAfterExcess:finite(line.availableAfterExcess,"saldo livre da linha"),buyer:0,allocatedToSubgroups:0,
    })
  }
  const allocations:Buyer238SubgroupAllocation[]=[]
  const keys = new Set<string>()
  for (const s of input.subgroups) {
    if (!s.line?.trim() || !s.name?.trim() || !["S","P","M","N"].includes(s.kind)) {
      throw new RangeError("Subgrupo ou classificação inválida.")
    }
    const key=s.line+"\u0000"+s.name
    if(keys.has(key)) throw new RangeError("Subgrupo duplicado: "+s.name)
    keys.add(key)
    finite(s.need,"necessidade",0)
    finite(s.openingStock,"estoque inicial")
    finite(s.forecastCost,"CMV projetado",0)
    if (!buckets.has(s.line)) throw new RangeError("Saldo da linha não informado: "+s.line)
    const dde=s.kind==="S"
      ? (s.forecastCost>0?s.openingStock/(s.forecastCost/input.daysInMonth):999)
      : null
    const amount=s.kind==="S"?s.need*input.share:0
    const protectedDde=amount>0&&dde!==null&&dde<30
    const bucket=buckets.get(s.line)!
    bucket.desired+=amount
    if(protectedDde)bucket.protected+=amount
    allocations.push({
      line:s.line,name:s.name,kind:s.kind,ddeOpening:dde,
      desired:amount,isProtected:protectedDde,afterCashCut:0,buyer:0,
    })
  }
  const totalDesired=[...buckets.values()].reduce((sum,b)=>sum+b.desired,0)
  const totalProtected=[...buckets.values()].reduce((sum,b)=>sum+b.protected,0)
  const remainingNonProtected=totalDesired-totalProtected
  const factor=totalDesired<=input.cashCap?1:
    remainingNonProtected>1e-9?Math.max(0,Math.min(1,(input.cashCap-totalProtected)/remainingNonProtected)):0
  for(const entry of allocations){
    entry.afterCashCut=entry.desired*(entry.isProtected?1:factor)
    buckets.get(entry.line)!.afterCashCut+=entry.afterCashCut
  }
  for(const line of buckets.values()){
    // E12/M12: MAX(protegido; MIN(total após trava; MAX(0; saldo da linha))).
    line.buyer=Math.max(line.protected,Math.min(line.afterCashCut,Math.max(0,line.availableAfterExcess)))
  }
  for(const entry of allocations){
    const line=buckets.get(entry.line)!
    const after=entry.afterCashCut
    // G20/K20/O20: protegidos mantidos; demais rateados após corte por linha.
    const remaining=line.afterCashCut-line.protected
    const allocation=entry.isProtected?after:
      remaining>1e-9?after*Math.max(0,Math.min(1,(line.buyer-line.protected)/remaining)):0
    entry.buyer=allocation
    line.allocatedToSubgroups+=allocation
  }
  const lines:Buyer238Line[]=[...buckets].map(([line,value])=>({line,...value}))
  return {
    version:"ZACARINI_238",authorizesPurchases:false,
    desired:totalDesired,protected:totalProtected,cashCutFactor:factor,
    buyerTotal:lines.reduce((sum,row)=>sum+row.buyer,0),
    allocatedToSubgroups:lines.reduce((sum,row)=>sum+row.allocatedToSubgroups,0),
    protectedAboveCashCap:totalProtected>input.cashCap+0.005,
    lines,subgroups:allocations,
  }
}
