/** OTB 2.3.8: colunas U, AD e AM são entradas manuais de vendas casadas.
 * A planilha fornecida contém zero nessas três competências. O Supabase
 * devolve apenas lançamentos Master auditados; ausência de linha equivale a
 * zero, nunca a venda presumida.
 */
export type OtbTiedSale238={name:string;month:string;amount:number;reason:string;updated:string}
export type OtbTiedSales238=
 | {state:"indisponivel";reason:string}
 | {state:"conectado";start:string;rows:readonly OtbTiedSale238[];total:number;entries:number}
const validDate=(s:unknown)=>typeof s==="string"&&/^20\d{2}-(0[1-9]|1[0-2])-01$/.test(s)
function addMonth(s:string,i:number){
 const [year,month]=s.split("-").map(Number)
 return new Date(Date.UTC(year,month-1+i,1)).toISOString().slice(0,10)
}
export function interpretOtbTiedSales238(data:unknown,error:unknown,start:string):OtbTiedSales238{
 const fail=(reason:string):OtbTiedSales238=>({state:"indisponivel",reason})
 if(error||!validDate(start)||!data||typeof data!=="object"||Array.isArray(data))
  return fail("Vendas casadas manuais indisponíveis.")
 const x=data as Record<string,unknown>
 if(x.start!==start||x.authorizesPurchases!==false||!Array.isArray(x.rows)||
   x.rows.length>1000||typeof x.entries!=="number"||x.entries!==x.rows.length||
   !Number.isFinite(Number(x.total)))return fail("Resposta das vendas casadas inválida.")
 const months=[start,addMonth(start,1),addMonth(start,2)],keys=new Set<string>()
 const rows:OtbTiedSale238[]=[]
 for(const r of x.rows){
  if(!r||typeof r!=="object"||Array.isArray(r))return fail("Venda casada inválida.")
  const y=r as Record<string,unknown>;const amount=Number(y.amount)
  if(typeof y.name!=="string"||!y.name.trim()||!months.includes(y.month as string)||
    !Number.isFinite(amount)||amount<0||amount>1e12||typeof y.reason!=="string"||
    typeof y.updated!=="string")return fail("Lançamento de venda casada inconsistente.")
  const key=y.name+"\0"+y.month
  if(keys.has(key))return fail("Lançamento de venda casada duplicado.")
  keys.add(key)
  rows.push({name:y.name,month:y.month as string,amount,reason:y.reason,updated:y.updated})
 }
 return {state:"conectado",start,rows,total:Number(x.total),entries:x.entries}
}
export function tiedSalesForSubgroup238(
 source:Extract<OtbTiedSales238,{state:"conectado"}>|null,
 subgroup:string,months:readonly [string,string,string]):readonly [number,number,number]{
 const map=new Map(source?.rows.filter(r=>r.name===subgroup).map(r=>[r.month,r.amount])??[])
 return [map.get(months[0])??0,map.get(months[1])??0,map.get(months[2])??0]
}

export type OtbDeliveryCalendar238=
 | {state:"indisponivel";reason:string}
 | {state:"conectado";base:string;itemCount:number;pendingValue:number;
    assumedArrivalItems:number;explicitArrivalItems:number;termsToReview:number;
    bonificationItems?:number;bonificationValue?:number;fixedDueDateItems?:number;
    weeks:readonly {start:string;end:string;amount:number;installments:number}[];
    months:readonly {month:string;amount:number;installments:number}[]}
export function interpretOtbDeliveryCalendar238(
 data:unknown,error:unknown,base:string):OtbDeliveryCalendar238{
 const fail=(reason:string):OtbDeliveryCalendar238=>({state:"indisponivel",reason})
 if(error||!data||typeof data!=="object"||Array.isArray(data))return fail("Calendário de parcelas indisponível.")
 const x=data as Record<string,unknown>
 if(x.base!==base||x.authorizesPurchases!==false||x.defaultArrivalDays!==7||x.defaultTermsDays!==30||
  !Array.isArray(x.weeks)||x.weeks.length!==26||!Array.isArray(x.months)||x.months.length!==12)
  return fail("O calendário não segue as regras da planilha 2.3.8.")
 const read=(name:string):number|null=>{
  const n=Number(x[name]);return Number.isFinite(n)&&n>=0&&n<1e15?n:null
 }
 const n=read("itemCount"),pending=read("pendingValue"),assumed=read("assumedArrivalItems"),
  explicit=read("explicitArrivalItems"),review=read("termsToReview")
 if(n===null||pending===null||assumed===null||explicit===null||review===null||
    ![n,assumed,explicit,review].every(Number.isSafeInteger)||assumed+explicit!==n)
  return fail("Totais de planejamento inconsistentes.")
 const weeks=x.weeks.map((w:unknown)=>{
  if(!w||typeof w!=="object"||Array.isArray(w))return null
  const t=w as Record<string,unknown>
  const amount=Number(t.amount),installments=Number(t.installments)
  if(typeof t.start!=="string"||typeof t.end!=="string"||!Number.isFinite(amount)||amount<0||
    !Number.isSafeInteger(installments)||installments<0)return null
  return {start:t.start,end:t.end,amount,installments}
 })
 const months=x.months.map((w:unknown)=>{
  if(!w||typeof w!=="object"||Array.isArray(w))return null
  const t=w as Record<string,unknown>
  const amount=Number(t.amount),installments=Number(t.installments)
  if(!validDate(t.month)||!Number.isFinite(amount)||amount<0||
    !Number.isSafeInteger(installments)||installments<0)return null
  return {month:t.month as string,amount,installments}
 })
 if(weeks.some(x=>x===null)||months.some(x=>x===null))return fail("Parcelas inválidas.")
 const optional=(key:string):number|undefined=>{
  if(x[key]===undefined)return undefined
  const n=read(key)
  return n!==null?n:undefined
 }
 const bonuses=optional("bonificationItems"),bonusValue=optional("bonificationValue"),
   fixed=optional("fixedDueDateItems")
 if((x.bonificationItems!==undefined&&(bonuses===undefined||!Number.isSafeInteger(bonuses)))||
   (x.bonificationValue!==undefined&&bonusValue===undefined)||
   (x.fixedDueDateItems!==undefined&&(fixed===undefined||!Number.isSafeInteger(fixed))))
   return fail("Classificação de parcelas não financeiras inconsistente.")
 return {state:"conectado",base,itemCount:n,pendingValue:pending,assumedArrivalItems:assumed,
  explicitArrivalItems:explicit,termsToReview:review,
  bonificationItems:bonuses,bonificationValue:bonusValue,fixedDueDateItems:fixed,
  weeks:weeks as Exclude<typeof weeks[number],null>[],months:months as Exclude<typeof months[number],null>[]}
}
