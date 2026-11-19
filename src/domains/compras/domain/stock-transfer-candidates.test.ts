import {describe,expect,it} from "vitest"
import {findStockTransferCandidates} from "./stock-transfer-candidates"

describe("indicações de remanejamento (somente análise)",()=>{
  it("aponta loja com demanda e cobertura curta para origem excedente",()=>{
    const rows=[
      {filial:"BDS",produto_cod:"100",situacao:"excesso",qtde_estoque:50,dde_previsto:200,previsto_90d:23},
      {filial:"CG",produto_cod:"100",situacao:"regular",qtde_estoque:2,dde_previsto:8,previsto_90d:22},
    ]
    expect(findStockTransferCandidates(rows)).toEqual([{produto:"100",origem:"BDS",destino:"CG"}])
  })
  it("não inventa destino sem venda nem cruza produtos diferentes",()=>{
    expect(findStockTransferCandidates([
      {filial:"BDS",produto_cod:"100",situacao:"sem_giro",qtde_estoque:30,dde_previsto:null,previsto_90d:0},
      {filial:"CG",produto_cod:"200",situacao:"regular",qtde_estoque:0,dde_previsto:null,previsto_90d:20},
    ])).toEqual([])
  })
  it("não propõe transferência entre dois estoques com alta cobertura",()=>{
    expect(findStockTransferCandidates([
      {filial:"BDS",produto_cod:"100",situacao:"excesso",qtde_estoque:20,dde_previsto:150,previsto_90d:10},
      {filial:"CG",produto_cod:"100",situacao:"excesso",qtde_estoque:20,dde_previsto:125,previsto_90d:12},
    ])).toEqual([])
  })
})
