/** Comparação de custos de produtos para análise comercial, sem decisão de aprovação. */
export type SupplierQuoteLine={
  code:string; quantity:number; unitCost:number|null; discountPercent:number|null
}

export type SupplierQuoteComparison=
  | {state:"pendente";baseSubtotal:null;alternativeSubtotal:null;difference:null}
  | {state:"calculado";baseSubtotal:number;alternativeSubtotal:number;difference:number}

const pendente:SupplierQuoteComparison={state:"pendente",baseSubtotal:null,alternativeSubtotal:null,difference:null}

function checkedLines(lines:SupplierQuoteLine[]):Map<string,{quantity:number;cents:number}>|null {
  if(lines.length===0||lines.length>40)return null
  const result=new Map<string,{quantity:number;cents:number}>()
  for(const line of lines){
    const code=line.code.trim()
    if(!code||result.has(code)||!Number.isInteger(line.quantity)||line.quantity<=0||line.quantity>100000000
      ||line.unitCost===null||!Number.isFinite(line.unitCost)||line.unitCost<0
      ||line.discountPercent===null||!Number.isFinite(line.discountPercent)
      ||line.discountPercent<0||line.discountPercent>100)return null
    const gross=line.quantity*line.unitCost
    if(!Number.isFinite(gross)||gross>Number.MAX_SAFE_INTEGER/100)return null
    const cents=Math.round(gross*(1-line.discountPercent/100)*100)
    if(!Number.isSafeInteger(cents))return null
    result.set(code,{quantity:line.quantity,cents})
  }
  return result
}

export function compareSupplierQuotes(base:SupplierQuoteLine[],alternative:SupplierQuoteLine[]):SupplierQuoteComparison {
  const originals=checkedLines(base)
  const offered=checkedLines(alternative)
  if(!originals||!offered||originals.size!==offered.size)return pendente
  let totalBase=0,totalAlternative=0
  for(const [code,origin] of originals){
    const candidate=offered.get(code)
    if(!candidate||candidate.quantity!==origin.quantity)return pendente
    totalBase+=origin.cents
    totalAlternative+=candidate.cents
  }
  if(!Number.isSafeInteger(totalBase)||!Number.isSafeInteger(totalAlternative))return pendente
  return {state:"calculado",baseSubtotal:totalBase/100,
    alternativeSubtotal:totalAlternative/100,difference:(totalAlternative-totalBase)/100}
}
