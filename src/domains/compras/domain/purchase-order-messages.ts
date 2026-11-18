/** Fórmulas de texto Atendimento Fornecedor!AO6 e AW6/AW8, Zacarini 2.3.7. */
export type OrderMessageItem={
  code:string; description:string; quantity:number; unitPrice:number; discountPercent:number;
  linkedSale?:string|null; byBranch?:string|null
}
export type OrderMessageInput={
  kind:"Mercadoria"|"Despesa"; brand:string; supplier:string; branch:string;
  deliveryDate:string; terms:string; installmentCount:number; freight:string;
  buyer:string; items:OrderMessageItem[]; baseDate:string; authorized:boolean
}
export function formatSupplierOrder(input:OrderMessageInput){
  const money=(n:number)=>n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})
  const integer=(n:number)=>n.toLocaleString("pt-BR",{maximumFractionDigits:0})
  const day=(s:string)=>s.match(/^\d{4}-\d{2}-\d{2}$/)?s.slice(8,10)+"/"+s.slice(5,7)+"/"+s.slice(2,4):"a combinar"
  const valid=input.items.filter(i=>i.quantity>0)
  if(!valid.length)return {whatsapp:"Digite as quantidades",subject:"",email:"",total:0}
  const total=valid.reduce((s,i)=>s+i.quantity*i.unitPrice*(1-i.discountPercent/100),0)
  const discount=valid.every(i=>i.discountPercent===valid[0].discountPercent)?valid[0].discountPercent:null
  const prefix=input.authorized?"":"⚠️ RASCUNHO – NÃO ENVIAR SEM APROVAÇÃO\n\n"
  const branch=input.branch==="REDE"?"por loja (rateio abaixo)":input.branch
  const rows=valid.map(i=>{
    const unit=i.unitPrice*(1-i.discountPercent/100)
    return {i,unit,final:i.quantity*unit,notes:(i.linkedSale?"\n   🤝 venda casada: "+i.linkedSale:"")
      +(i.byBranch?"\n   🏬 por loja: "+i.byBranch:"")}
  })
  const subject="Pedido de compra Só Sal – "+input.brand+" – "+input.branch+" – "+day(input.baseDate)
  const whatsapp=prefix+"*🛒 PEDIDO DE COMPRA – SÓ SAL*\n\n"
    +(input.kind==="Mercadoria"?"🏷️ *Marca:* "+input.brand:"🧰 *Tipo:* "+input.kind)
    +"\n🏢 *Fornecedor:* "+input.supplier
    +"\n📍 *Entrega:* "+branch+" até "+day(input.deliveryDate)
    +"\n💳 *Pagamento:* "+input.terms+" ("+input.installmentCount+"x)"
    +"\n🚚 *Frete:* "+input.freight
    +(discount!==null&&discount>0?"\n🏷️ *Desconto:* "+money(discount)+"%":"")
    +"\n\n📦 *Itens:*\n"
    +rows.map(({i,unit,final,notes})=>"• *"+i.description+"* (cód. "+i.code+")\n   "
      +integer(i.quantity)+" un × R$ "+money(unit)+" = R$ "+money(final)+notes).join("\n")
    +"\n\n💰 *Total: R$ "+money(total)+"*"
    +"\n👤 *Comprador:* "+input.buyer+"\n\nFavor confirmar o pedido e a data de entrega. Obrigado! 🙏"
  const email=prefix+"Prezados, "+input.supplier+",\n\n"
    +(input.kind==="Mercadoria"?"Segue nosso pedido de compra da marca "+input.brand+":":"Segue nosso pedido de compra ("+input.kind.toLowerCase()+"):")
    +"\n\n"+rows.map(({i,unit,final,notes})=>"- "+i.description+" (cód. "+i.code+"): "
      +integer(i.quantity)+" un × R$ "+money(unit)+" = R$ "+money(final)+notes).join("\n")
    +"\n\nTotal do pedido: R$ "+money(total)
    +(discount!==null&&discount>0?" (já com "+money(discount)+"% de desconto)":"")
    +"\nCondição de pagamento: "+input.terms+" ("+input.installmentCount+" parcelas)"
    +"\nFrete: "+input.freight
    +"\nLocal de entrega: "+(input.branch==="REDE"?"conforme divisão por loja abaixo":"loja "+branch)
    +"\nEntrega até: "+day(input.deliveryDate)
    +"\n\nPor favor, confirmem o recebimento do pedido, a data de faturamento e enviem a NF/boletos para conferência."
    +"\n\nAtenciosamente,\n"+input.buyer+"\nCompras – Só Sal"
  return {whatsapp,subject,email,total}
}
