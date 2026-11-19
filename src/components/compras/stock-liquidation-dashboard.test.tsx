import {describe,expect,it} from "vitest"
import {render,screen} from "@testing-library/react"
import {StockLiquidationDashboard, type StockLiquidationFilters, type StockLiquidationRow} from "./stock-liquidation-dashboard"

const filters:StockLiquidationFilters={busca:"100",filial:"",linha:"",situacao:"todos",dde:60,pagina:1}
const row:StockLiquidationRow={
  filial:"BDS",produto_cod:"100",descricao:"Produto X",grupo_subgrupo:"3.OUTROS / PEÇAS",
  marca:"SO SAL",linha:3,qtde_estoque:100,valor_estoque:1000,vendido_90d:10,
  previsto_90d:15,fator_crescimento:1.5,dde_previsto:600,situacao:"excesso",valor_parado:900,
  motivo_exclusao:null,base_previsao:"Últimos 90 dias",data_historico:"2026-11-18",
  total_itens:1,total_estoque:1000,total_parado:900,itens_sem_giro:0,itens_excesso:1,
}

describe("painel de liquidação",()=>{
  it("não apresenta indicador zero quando a consulta Master falhar",()=>{
    render(<StockLiquidationDashboard variant="lojas" rows={[]} error="42501" filters={filters}/>)
    expect(screen.getByRole("alert")).toHaveTextContent("autorização Master")
    expect(screen.queryByText("Valor potencial parado")).not.toBeInTheDocument()
  })
  it("identifica Bandeirantes como filial do código BDS",()=>{
    render(<StockLiquidationDashboard variant="lojas" rows={[row]} error={null} filters={filters}/>)
    expect(screen.getAllByText("Bandeirantes").length).toBeGreaterThan(0)
    expect(screen.getByText("Produto X")).toBeInTheDocument()
    expect(screen.getAllByText("Excesso").length).toBeGreaterThan(0)
  })
})
