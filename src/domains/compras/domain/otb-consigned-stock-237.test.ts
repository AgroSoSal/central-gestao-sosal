import { describe,expect,it } from "vitest"
import { subtractOtbConsignedStock } from "./otb-consigned-stock-237"
import type { OtbStockPosition } from "./otb-position-source"

const snap="2026-11-19T08:15:00+00:00"
const stock:OtbStockPosition={status:"conectado",snapshotAt:snap,stockCost:250,
  cmv90d:125,stockSkus:3,subgroups:[
    {line:3,subgroup:"3.OUTROS / CERCA ELETRICA",stockCost:200,cmv90d:100,skuCount:2,observedDde:180},
    {line:4,subgroup:"4.PASTAGEM / ADUBO",stockCost:50,cmv90d:25,skuCount:1,observedDde:180},
  ]}

describe("OTB!I: estoque a custo sem marca consignada GALLAGHER",()=>{
  it("subtrai somente a marca consignada na mesma foto, sem alterar estoque observado",()=>{
    const result=subtractOtbConsignedStock(stock,[{linha:3,grupo_subgrupo:"3.OUTROS / CERCA ELETRICA",
      valor_consignado:"80.50",ultima_atualizacao:snap}],null)
    expect(result.state).toBe("conectado")
    if(result.state!=="conectado")return
    expect(result.consignedCost).toBeCloseTo(80.50)
    expect(result.subgroups.map(r=>r.stockCost)).toEqual([119.5,50])
    expect(stock.subgroups[0].stockCost).toBe(200)
    expect(result.stockCost).toBeCloseTo(169.50)
  })

  it("bloqueia subtração acima do estoque, grupo ausente, snapshot divergente e consulta falha",()=>{
    const row={linha:3,grupo_subgrupo:"3.OUTROS / CERCA ELETRICA",valor_consignado:"80.50",ultima_atualizacao:snap}
    expect(subtractOtbConsignedStock(stock,[{...row,valor_consignado:"201"}],null).state).toBe("indisponivel")
    expect(subtractOtbConsignedStock(stock,[{...row,grupo_subgrupo:"3.OUTROS / SEM CADASTRO"}],null).state).toBe("indisponivel")
    expect(subtractOtbConsignedStock(stock,[{...row,ultima_atualizacao:"2026-11-18T08:15:00+00:00"}],null).state).toBe("indisponivel")
    expect(subtractOtbConsignedStock(stock,[row],{code:"42501"}).state).toBe("indisponivel")
    expect(subtractOtbConsignedStock(stock,[row,row],null).state).toBe("indisponivel")
  })

  it("preserva estoque quando não existe nenhuma marca consignada",()=>{
    const result=subtractOtbConsignedStock(stock,[],null)
    expect(result.state).toBe("conectado")
    if(result.state!=="conectado")return
    expect(result.stockCost).toBe(250)
    expect(result.consignedCost).toBe(0)
  })
})
