import { describe, expect, it } from "vitest"
import { allocatePurchaseByBranch, type BranchAllocationMetric } from "./purchase-branch-allocation"

const rows:BranchAllocationMetric[]=[
  {filial:"BDS",stock:0,pending:0,sales90d:450},
  {filial:"CG",stock:0,pending:0,sales90d:900},
  {filial:"RIO",stock:0,pending:0,sales90d:0},
  {filial:"CX",stock:0,pending:0,sales90d:0},
  {filial:"PG",stock:0,pending:0,sales90d:0},
  {filial:"AN",stock:0,pending:0,sales90d:0},
]

describe("Rateio AP:AU e AW:BB com fontes completas",()=>{
  it("distribui a quantidade inteira por necessidade da filial sem sobra",()=>{
    expect(allocatePurchaseByBranch({quantity:9,targetDde:45,rows})).toEqual([3,6,0,0,0,0])
  })

  it("suspende o rateio quando falta estoque, pedido pendente ou venda de uma filial",()=>{
    for(const field of ["stock","pending","sales90d"] as const){
      const corrupted=rows.map(r=>({...r}))
      corrupted[3][field]=null
      expect(allocatePurchaseByBranch({quantity:9,targetDde:45,rows:corrupted})).toBeNull()
    }
  })

  it("suspende se uma filial não veio da RPC ou veio duplicada",()=>{
    expect(allocatePurchaseByBranch({quantity:9,targetDde:45,rows:rows.slice(1)})).toBeNull()
    expect(allocatePurchaseByBranch({quantity:9,targetDde:45,rows:[...rows,rows[0]]})).toBeNull()
  })

  it("suspende sem DDE, sem venda comprovada ou com métrica negativa",()=>{
    expect(allocatePurchaseByBranch({quantity:9,targetDde:null,rows})).toBeNull()
    expect(allocatePurchaseByBranch({quantity:9,targetDde:45,rows:rows.map(r=>({...r,sales90d:0}))})).toBeNull()
    expect(allocatePurchaseByBranch({quantity:9,targetDde:45,rows:rows.map((r,i)=>i? r:{...r,stock:-1})})).toBeNull()
  })
})
