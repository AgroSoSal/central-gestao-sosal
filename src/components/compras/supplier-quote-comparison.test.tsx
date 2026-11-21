import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { SupplierQuoteComparison } from "./supplier-quote-comparison"

afterEach(cleanup)

const proposal={items:[{
  code:"90001",description:"Sal mineral",quantity:10,unitCost:10,discountPercent:0,
}],baseSupplier:"Fornecedor A",singleSupplier:true}

describe("Comparação de propostas no Atendimento Fornecedor",()=>{
  it("compara a mesma quantidade por SKU sem liberar uma compra",()=>{
    render(<SupplierQuoteComparison {...proposal}/> )
    expect(screen.getByRole("heading",{name:/Comparar cotações/i})).toBeInTheDocument()
    expect(screen.getByText(/Sem comparação completa/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Fornecedor concorrente/i),{target:{value:"Fornecedor B"}})
    fireEvent.change(screen.getByLabelText(/Custo concorrente 90001/i),{target:{value:"8"}})
    expect(screen.getByText(/R\$\s*100,00/)).toBeInTheDocument()
    expect(screen.getByText(/R\$\s*80,00/)).toBeInTheDocument()
    expect(screen.getByText(/-R\$\s*20,00/)).toBeInTheDocument()
    expect(screen.getByText(/não autoriza pedidos/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Custo concorrente 90001/i),{target:{value:""}})
    expect(screen.getByText(/Sem comparação completa/i)).toBeInTheDocument()
    expect(screen.queryByText(/-R\$\s*20,00/)).not.toBeInTheDocument()
  })

  it("não compara propostas de fornecedores base misturados",()=>{
    render(<SupplierQuoteComparison {...proposal} singleSupplier={false}/> )
    expect(screen.getByText(/um único fornecedor por vez/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Custo concorrente 90001/i)).not.toBeInTheDocument()
  })

  it("aguarda todos os custos se há dois SKUs e não converte custo ausente em zero",()=>{
    render(<SupplierQuoteComparison {...proposal} items={[...proposal.items,{
      code:"90002",description:"Ração",quantity:5,unitCost:20,discountPercent:0,
    }]}/> )
    fireEvent.change(screen.getByLabelText(/Fornecedor concorrente/i),{target:{value:"Fornecedor B"}})
    fireEvent.change(screen.getByLabelText(/Custo concorrente 90001/i),{target:{value:"8"}})
    expect(screen.getByText(/Sem comparação completa/i)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Custo concorrente 90002/i),{target:{value:"18"}})
    expect(screen.getByText(/R\$\s*170,00/)).toBeInTheDocument()
    expect(screen.getByText(/-R\$\s*30,00/)).toBeInTheDocument()
  })
})
