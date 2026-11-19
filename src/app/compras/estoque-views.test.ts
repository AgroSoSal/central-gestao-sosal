import {describe,it,expect} from "vitest"
import {parseStockFilters} from "./estoque-views"

describe("consulta de liquidação",()=>{
  it("limita parâmetros antes de consultar a RPC Master",()=>{
    expect(parseStockFilters({pagina:"100000",dde:"0",linha:"9",filial:"SO SAL",situacao:"hack"},"lojas")).toEqual({
      busca:"",filial:"",linha:"",situacao:"todos",dde:60,pagina:1,
    })
    expect(parseStockFilters({filial:"BDS",linha:"0",situacao:"excesso",dde:"75",pagina:"3"},"lojas")).toMatchObject({filial:"BDS",linha:"0",situacao:"excesso",dde:75,pagina:3})
  })
  it("não aplica filtro de filial ao consolidado de rede",()=>{
    expect(parseStockFilters({filial:"CG"},"linhas").filial).toBe("")
  })
})
