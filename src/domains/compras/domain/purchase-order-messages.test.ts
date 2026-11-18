import {describe,it,expect} from "vitest"
import {formatSupplierOrder} from "./purchase-order-messages"
describe("Mensagens Atendimento Fornecedor!AO6 e AW6/AW8",()=>{
  const quote={kind:"Mercadoria" as const,brand:"MSD",supplier:"Fornecedor ABC",branch:"CG",deliveryDate:"2026-11-25",
    terms:"30/60",installmentCount:2,freight:"CIF",buyer:"Compras Só Sal",baseDate:"2026-11-18",
    authorized:false,items:[{code:"123",description:"Produto de referência",quantity:2,unitPrice:50,discountPercent:10}]}
  it("usa preço com desconto, soma itens e informa que é rascunho",()=>{
    const r=formatSupplierOrder(quote)
    expect(r.total).toBe(90)
    expect(r.whatsapp).toMatch(/RASCUNHO/)
    expect(r.whatsapp).toContain("2 un × R$ 45,00 = R$ 90,00")
    expect(r.whatsapp).toContain("Entrega:* CG até 25/11/26")
  })
  it("gera assunto e texto no padrão da planilha",()=>{
    const r=formatSupplierOrder(quote)
    expect(r.subject).toContain("Pedido de compra Só Sal – MSD – CG – 18/11/26")
    expect(r.email).toContain("enviem a NF/boletos para conferência.")
  })
  it("recusa texto como pedido quando não há quantidade",()=>{
    expect(formatSupplierOrder({...quote,items:[]}).whatsapp).toMatch(/Digite as quantidades/)
  })
})
