import { describe,expect,it } from "vitest"
import {
 interpretOtbTiedSales238,tiedSalesForSubgroup238,interpretOtbDeliveryCalendar238
} from "./otb-manual-calendar-238"

const source={
 source:"OTB Zacarini 2.3.8 U/AD/AM; lançamentos Master auditados",
 start:"2026-12-01",authorizesPurchases:false,entries:2,total:2000,
 rows:[
  {name:"1.LINHA NUTRIÇÃO / MATERIA PRIMA",month:"2026-12-01",amount:1200,reason:"Venda casada #123",updated:"2026-11-24T14:00:00Z"},
  {name:"3.OUTROS / FERRAMENTAS",month:"2027-01-01",amount:800,reason:"Venda casada #456",updated:"2026-11-24T14:01:00Z"},
 ],
}
describe("OTB!U/AD/AM vendas casadas auditadas",()=>{
 it("mantém zero nas células sem lançamento e usa somente valor de subgrupo e competência exatos",()=>{
  const v=interpretOtbTiedSales238(source,null,"2026-12-01")
  expect(v.state).toBe("conectado")
  if(v.state!=="conectado")throw Error(v.reason)
  expect(tiedSalesForSubgroup238(v,"1.LINHA NUTRIÇÃO / MATERIA PRIMA",
   ["2026-12-01","2027-01-01","2027-02-01"])).toEqual([1200,0,0])
  expect(tiedSalesForSubgroup238(v,"Subgrupo sem lançamento",
   ["2026-12-01","2027-01-01","2027-02-01"])).toEqual([0,0,0])
 })
 it("rejeita duplicatas, valores negativos e consultas com competência divergente",()=>{
  expect(interpretOtbTiedSales238({...source,rows:[...source.rows,source.rows[0]],entries:3},null,"2026-12-01").state).toBe("indisponivel")
  expect(interpretOtbTiedSales238({...source,rows:[{...source.rows[0],amount:-1}],entries:1},null,"2026-12-01").state).toBe("indisponivel")
  expect(interpretOtbTiedSales238(source,null,"2027-01-01").state).toBe("indisponivel")
 })
})
const months=Array.from({length:12},(_,i)=>({month:new Date(Date.UTC(2026,10+i,1)).toISOString().slice(0,10),amount:i*100,installments:i}))
const weeks=Array.from({length:26},(_,i)=>({start:new Date(Date.UTC(2026,10,24+i*7)).toISOString().slice(0,10),end:new Date(Date.UTC(2026,10,30+i*7)).toISOString().slice(0,10),amount:i*100,installments:i}))
describe("Pedidos de Compra!B6/B7 P:AK, calendário",()=>{
 it("aceita 26 semanas e 12 meses com parâmetros padrão documentados",()=>{
  const x=interpretOtbDeliveryCalendar238({
   base:"2026-11-24",authorizesPurchases:false,defaultArrivalDays:7,defaultTermsDays:30,
   itemCount:5,pendingValue:1000,assumedArrivalItems:4,explicitArrivalItems:1,
   termsToReview:2,months,weeks,
  },null,"2026-11-24")
  expect(x.state).toBe("conectado")
 })
 it("não confunde erro do calendário, semanas incompletas ou soma de chegadas incoerente com vencimentos confirmados",()=>{
  const base={base:"2026-11-24",authorizesPurchases:false,defaultArrivalDays:7,
    defaultTermsDays:30,itemCount:5,pendingValue:1000,assumedArrivalItems:4,
    explicitArrivalItems:1,termsToReview:2,months,weeks}
  expect(interpretOtbDeliveryCalendar238({...base,defaultArrivalDays:9},null,"2026-11-24").state).toBe("indisponivel")
  expect(interpretOtbDeliveryCalendar238({...base,weeks:weeks.slice(1)},null,"2026-11-24").state).toBe("indisponivel")
  expect(interpretOtbDeliveryCalendar238({...base,explicitArrivalItems:2},null,"2026-11-24").state).toBe("indisponivel")
 })
})
