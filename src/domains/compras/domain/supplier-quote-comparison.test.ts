import { describe, expect, it } from "vitest"
import { compareSupplierQuotes, type SupplierQuoteLine } from "./supplier-quote-comparison"

const item=(overrides:Partial<SupplierQuoteLine>={}):SupplierQuoteLine=>({
  code:"90001",quantity:10,unitCost:10,discountPercent:10,...overrides,
})

describe("Comparação auxiliar de cotações — não aprova pedidos",()=>{
  it("compara somente os mesmos produtos e quantidades, descontando cada oferta",()=>{
    const result=compareSupplierQuotes([
      item(),item({code:"90002",quantity:5,unitCost:20,discountPercent:0}),
    ],[
      item({unitCost:8,discountPercent:0}),
      item({code:"90002",quantity:5,unitCost:18,discountPercent:0}),
    ])
    expect(result).toEqual({state:"calculado",baseSubtotal:190,alternativeSubtotal:170,difference:-20})
  })

  it("arredonda os totais a centavos por item antes de somá-los",()=>{
    expect(compareSupplierQuotes([item({quantity:3,unitCost:0.333,discountPercent:0})],
      [item({quantity:3,unitCost:0.33,discountPercent:0})])).toEqual({
        state:"calculado",baseSubtotal:1,alternativeSubtotal:0.99,difference:-0.01,
      })
  })

  it("não presume zero se preço ou desconto de uma das ofertas estiver ausente",()=>{
    const result=compareSupplierQuotes([item()], [item({unitCost:null})])
    expect(result).toMatchObject({state:"pendente",baseSubtotal:null,
      alternativeSubtotal:null,difference:null})
  })

  it("rejeita linhas em falta, códigos duplicados e quantidades divergentes",()=>{
    expect(compareSupplierQuotes([item()],[]).state).toBe("pendente")
    expect(compareSupplierQuotes([item()], [item(),item()]).state).toBe("pendente")
    expect(compareSupplierQuotes([item()], [item({quantity:11})]).state).toBe("pendente")
    expect(compareSupplierQuotes([item()], [item({code:"OUTRO"})]).state).toBe("pendente")
  })

  it("rejeita preço negativo, desconto acima de 100% e valor acima da capacidade segura",()=>{
    expect(compareSupplierQuotes([item()], [item({unitCost:-1})]).state).toBe("pendente")
    expect(compareSupplierQuotes([item()], [item({discountPercent:110})]).state).toBe("pendente")
    expect(compareSupplierQuotes([item()], [item({unitCost:1e20})]).state).toBe("pendente")
  })
})
