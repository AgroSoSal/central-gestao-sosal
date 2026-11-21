"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { AlertTriangle, Calculator, CheckCircle2, CircleHelp, PackageSearch } from "lucide-react"
import { negotiatedPurchase, suggestedPurchaseQuantity } from "@/domains/compras/domain/purchase-zacarini-237"
import { forecastPurchasePayments } from "@/domains/compras/domain/purchase-payment-forecast"
import { allocatePurchaseByBranch, PURCHASE_BRANCHES } from "@/domains/compras/domain/purchase-branch-allocation"
import { rankSuppliersByNeed } from "@/domains/compras/domain/supplier-priority-237"
import { SupplierQuoteComparison } from "@/components/compras/supplier-quote-comparison"
import { validarAtendimento, ddePlanejado, PROGRESSO_DDE_ZACARINI_237 } from "@/domains/compras/domain/purchase-attendance-validation"
import { formatSupplierOrder } from "@/domains/compras/domain/purchase-order-messages"
import { buildAttendanceManualScenario, type ManualInput } from "@/domains/compras/domain/siscom-manual-inputs"
import { fetchRemoteManualInputs } from "@/app/compras/entradas-manuais/actions"

export type AttendanceProduct = {
  produto_cod: string; descricao: string | null; marca: string | null; fornecedor: string | null
  grupo_subgrupo: string | null; linha: number | null
  estoque_qtde: number | string | null; pedido_pendente_qtde: number | string | null
  venda_qtde_90d: number | string | null; venda_valor_90d: number | string | null
  cmv_90d: number | string | null; ultimo_custo: number | string | null
  preco_venda_medio: number | string | null
}
type BranchMetric = { produto_codigo: string; filial: string; estoque_qtde: number | string | null; pedido_pendente: number | string | null; venda_qtde_90d: number | string | null }
export type AttendanceDdeMeta = { produto_codigo: string; grupo_subgrupo: string|null; competencia:string|null; dde_meta:number|string|null; origem:string|null }
export type AttendanceObservedDde = { grupo_subgrupo:string; dde_observado:number|null }
export type PurchaseDraft = { id: number; filial: string; total: number | string; itens_count: number; observacao: string | null; criado_em: string }
type Props = { products: AttendanceProduct[]; branch: string; baseDate: string; drafts: PurchaseDraft[]; ddeMetas:AttendanceDdeMeta[];
  ddeObservado:AttendanceObservedDde[]; posicaoConectada:boolean; competencia:string; userId?:string }
const money = new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"})
const qtyFmt = new Intl.NumberFormat("pt-BR",{maximumFractionDigits:1})
const ddeDefaults: Record<number, number> = { 1:45, 2:60, 3:60, 4:50 }
function num(x: number | string | null | undefined): number | null {
  if (x === null || x === undefined || x === "") return null
  const n=Number(x)
  return Number.isFinite(n) ? n : null
}
const safe=(x: number | string | null | undefined)=>num(x)??0
const validTestAmount=(value:string):number|null=>{
  if(!value.trim())return null
  const n=Number(value)
  return Number.isFinite(n)&&n>=0?n:null
}
const validTestDate=(value:string):string|null=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null
  const date=new Date(value+"T00:00:00Z")
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value?value:null
}

export function AtendimentoFornecedor({products,branch,baseDate,drafts,ddeMetas,ddeObservado,posicaoConectada,competencia}:Props) {
  const router = useRouter()
  const [saving,setSaving] = useState(false)
  const [notice,setNotice] = useState("")
  const [notes,setNotes] = useState("")
  const [frete,setFrete] = useState("CIF")
  const [fornecedor,setFornecedor] = useState("")
  const [comprador,setComprador] = useState("")
  const [rateioLoading,setRateioLoading] = useState(false)
  const [rateioError,setRateioError] = useState("")
  const [branchRows,setBranchRows] = useState<BranchMetric[]>([])
  const [quantities,setQuantities]=useState<Record<string,string>>({})
  const [costs,setCosts]=useState<Record<string,string>>({})
  const [discount,setDiscount]=useState("0")
  // Entrada da Zacarini 2.3.7: H15=7, H16=1, H17=90, H18=30.
  const [paymentTerms,setPaymentTerms]=useState("")
  const [prazoEntrega,setPrazoEntrega]=useState("7")
  const [numeroParcelas,setNumeroParcelas]=useState("1")
  const [primeiraParcela,setPrimeiraParcela]=useState("90")
  const [intervaloParcelas,setIntervaloParcelas]=useState("30")
  const [deliveryDate,setDeliveryDate]=useState("")
  // Cenário manual para exercitar as fórmulas da planilha sem simular homologação da OTB.
  // Os valores existem somente neste componente; não são salvos nem habilitam pedidos.
  const [testMode,setTestMode]=useState(false)
  const [testDailyCost,setTestDailyCost]=useState("1000")
  const [testReleaseDate,setTestReleaseDate]=useState(baseDate)
  const [testAccumulatedCash,setTestAccumulatedCash]=useState("200000")
  const [testLineBudget,setTestLineBudget]=useState<Record<number,string>>({1:"200000",2:"200000",3:"200000",4:"200000"})
  const [manualMode,setManualMode]=useState(false)
  const [manualRows,setManualRows]=useState<ManualInput[]>([])
  const [manualLoadError,setManualLoadError]=useState("")
  const [manualLoading,setManualLoading]=useState(false)
  const pct = Number(discount)
  const validDiscount=Number.isFinite(pct)&&pct>=0&&pct<=100
  const entries = useMemo(()=>products.map(p=>{
    const meta=ddeMetas.find(m=>m.produto_codigo===p.produto_cod)
    const metaAlvo=num(meta?.dde_meta)
    const objetivo=p.linha==null?null:ddeDefaults[p.linha]??null
    const meses=(Number(competencia.slice(0,4))-2026)*12+Number(competencia.slice(5,7))-11
    const dentroDoPlano=meses>=0&&meses<6
    const observado=ddeObservado.find(o=>o.grupo_subgrupo===p.grupo_subgrupo)?.dde_observado??null
    const target=metaAlvo!==null?metaAlvo:
      posicaoConectada&&dentroDoPlano&&objetivo!==null
        ?ddePlanejado(observado,objetivo,PROGRESSO_DDE_ZACARINI_237[meses]):null
    const metaSource=metaAlvo!==null?"Meta combinada · Plano de Estoque":
      target!==null?"DDE observado → meta da linha · Plano de Estoque":"Fonte do DDE pendente"
    const observedSales=num(p.venda_qtde_90d)
    const sales=observedSales===null?null:observedSales/90
    const stock=num(p.estoque_qtde), pending=num(p.pedido_pendente_qtde)
    // Fonte ausente não equivale a estoque/venda/pedido pendente igual a zero.
    const available=target!==null&&Number.isFinite(target)&&target>=0
      &&sales!==null&&Number.isFinite(sales)&&sales>=0
      &&stock!==null&&stock>=0&&pending!==null&&pending>=0
    const suggest=available?suggestedPurchaseQuantity(sales,target,stock,pending):null
    const qty=Number(quantities[p.produto_cod]??"0")
    const cost=num(costs[p.produto_cod]??p.ultimo_custo)
    const validQty=Number.isInteger(qty)&&qty>=0&&qty<=100000000
    const canCalculate=validQty&&cost!==null&&cost>=0&&validDiscount
    const quote=canCalculate?negotiatedPurchase(qty,cost,pct,num(p.preco_venda_medio)):null
    const isMerchandise=!!p.grupo_subgrupo && /^[1-4]\./.test(p.grupo_subgrupo)
    return { p,target,metaSource,sales,stock,pending,suggest,qty,cost,quote,isMerchandise,validQty }
  }),[products,ddeMetas,ddeObservado,posicaoConectada,competencia,quantities,costs,pct,validDiscount])
  const supplierPriority=useMemo(()=>rankSuppliersByNeed(entries.map(({p,suggest})=>({
    code:p.produto_cod,supplier:p.fornecedor,line:p.linha,
    stock:num(p.estoque_qtde),sales90d:num(p.venda_qtde_90d),
    suggestedQuantity:suggest,lastCost:num(p.ultimo_custo),
  }))),[entries])
  const chosen=entries.filter(x=>x.qty>0)
  const invalid=chosen.some(x=>!x.quote||!x.isMerchandise)
  const amount=chosen.reduce((sum,x)=>sum+(x.quote?.total??0),0)
  const units=chosen.reduce((sum,x)=>sum+x.qty,0)
  const qtdParcelas=Number(numeroParcelas)
  const primeiro=Number(primeiraParcela)
  const intervalo=Number(intervaloParcelas)
  const prazo=Number(prazoEntrega)
  const prazoValido=Number.isInteger(qtdParcelas)&&qtdParcelas>=1&&qtdParcelas<=10
    &&Number.isInteger(primeiro)&&primeiro>=0&&primeiro<=3650
    &&Number.isInteger(intervalo)&&intervalo>=0&&intervalo<=3650
    &&Number.isInteger(prazo)&&prazo>=0&&prazo<=365
  const termos=paymentTerms.trim()||(prazoValido?Array.from({length:qtdParcelas},(_,i)=>String(primeiro+i*intervalo)).join("/"):"")
  const chegadaEstimada=(()=>{
    if(deliveryDate)return deliveryDate
    if(!prazoValido)return null
    const d=new Date(baseDate+"T00:00:00Z")
    d.setUTCDate(d.getUTCDate()+prazo)
    return d.toISOString().slice(0,10)
  })()
  const forecast=chosen.length&&!invalid&&prazoValido?forecastPurchasePayments({
    orderDate:baseDate,paymentTerms:termos,pendingQuantity:units,pendingValue:amount,
    decision:"Aprovado",followUpArrival:chegadaEstimada,baseDate,
  }):null
  const testCash=validTestAmount(testAccumulatedCash)
  const testCost=validTestAmount(testDailyCost)
  const testLines=[...new Set(chosen.map(x=>x.p.linha).filter((line):line is number=>line!==null))]
  const testBudgetsValid=testLines.every(line=>validTestAmount(testLineBudget[line]??"")!==null)
  const manualScenario=buildAttendanceManualScenario(manualRows,competencia.slice(0,7),branch)
  const testFinancialInputsValid=manualMode
    ?manualScenario.dailyCost!==null&&manualScenario.dailyCost>0&&manualScenario.releaseDate!==null
      &&manualScenario.cashLimits.length>0&&testLines.every(line=>manualScenario.lineBudgets[line]!==undefined)
    :testCost!==null&&testCost>0&&validTestDate(testReleaseDate)!==null&&testCash!==null&&testBudgetsValid
  const conferencia=validarAtendimento({
    tipo:"Mercadoria",valor:amount,
    diasPMP:forecast?.paymentDays.length
      ?forecast.paymentDays.reduce((s,d)=>s+d,0)/forecast.paymentDays.length:null,
    // Excel AD63 = custo diário PREVISTO. CMV histórico 90d não substitui a previsão.
    custoDiarioPrevisto:testMode?(manualMode?manualScenario.dailyCost:testCost):null,
    primeiroVencimento:forecast?.installments.map(p=>p.dueDate).sort()[0]??null,
    primeiraDataLiberada:testMode?(manualMode?manualScenario.releaseDate:validTestDate(testReleaseDate)):null,
    parcelas:forecast?.installments.map(p=>({vencimento:p.dueDate,valor:p.amount}))??[],
    // Teto uniforme por vencimento APENAS em teste; a OTB oficial usa 26 semanas.
    limitesAcumulados:testMode?(manualMode
      ?manualScenario.cashLimits.length?manualScenario.cashLimits:null
      :testCash!==null?forecast?.installments.map(p=>({data:p.dueDate,limite:testCash}))??null:null):null,
    verbasPorLinha:testMode&&(manualMode||testBudgetsValid)?testLines.map(line=>({
      linha:String(line),valor:chosen.filter(x=>x.p.linha===line).reduce((sum,x)=>sum+(x.quote?.total??0),0),
      saldo:manualMode?manualScenario.lineBudgets[line]??null:validTestAmount(testLineBudget[line]),
    })):null,
    quantidadeOrfa:false,itensInvalidos:invalid||!prazoValido||forecast?.status==="conferir",
  })
  async function loadManualInputsFromServer() {
    if(manualLoading)return
    setManualLoading(true)
    try {
      const result=await fetchRemoteManualInputs()
      if(result.status!=="success")throw new Error(result.message)
      setManualRows(result.records)
      setManualMode(true)
      setManualLoadError("")
    } catch {
      setManualLoadError("Entradas do Supabase indisponíveis. Verifique a tabela e as permissões Master.")
    } finally {setManualLoading(false)}
  }
  async function loadRateio() {
    if (rateioLoading || branch!=="REDE" || chosen.length===0) return
    const client=createSupabaseBrowserClient()
    if (!client) {setRateioError("Sem conexão com o Supabase.");return}
    setRateioLoading(true);setRateioError("")
    try {
      const {data,error}=await client.rpc("fn_compras_atendimento_rateio",{
        p_codigos:chosen.map(({p})=>p.produto_cod),
      })
      if(error){setRateioError("Não foi possível obter a posição por filial; rateio indisponível.");return}
      setBranchRows((data??[]) as BranchMetric[])
    }catch{setRateioError("Falha de conexão ao consultar rateio.")}
    finally{setRateioLoading(false)}
  }
  const branches=PURCHASE_BRANCHES
  const allocation=chosen.map(entry=>{
    const rows=branchRows.filter(r=>r.produto_codigo===entry.p.produto_cod).map(r=>({
      filial:r.filial,stock:num(r.estoque_qtde),pending:num(r.pedido_pendente),sales90d:num(r.venda_qtde_90d),
    }))
    return {code:entry.p.produto_cod,qty:entry.qty,
      parts:allocatePurchaseByBranch({quantity:entry.qty,targetDde:entry.target,rows})}
  })
  const nomesCompradores:Record<number,string>={1:"Thiago e Filipe",2:"Margotti",3:"Thiago e Filipe",4:"Claudiney"}
  const linhas=chosen.map(x=>x.p.linha).filter((x):x is number=>x!==null)
  const mesmaLinha=linhas.length>0&&linhas.every(x=>x===linhas[0])
  const compradorProposto=mesmaLinha?nomesCompradores[linhas[0]]??"Compras Só Sal":"Compras Só Sal"
  const marcas=[...new Set(chosen.map(x=>x.p.marca).filter(Boolean))]
  const marca=marcas.length===1?marcas[0]!:"Marcas diversas"
  const fornecedores=[...new Set(chosen.map(x=>x.p.fornecedor).filter(Boolean))]
  const fornecedorProposto=fornecedor.trim()||(fornecedores.length===1?fornecedores[0]!:"Fornecedor a confirmar")
  const singleSupplier=fornecedor.trim().length>0||(fornecedores.length===1
    &&chosen.every(x=>x.p.fornecedor===fornecedores[0]))
  const mensagens=chosen.length&&!invalid?formatSupplierOrder({
    kind:"Mercadoria",brand:marca,supplier:fornecedorProposto,branch,
    deliveryDate:chegadaEstimada||baseDate,terms:termos,
    installmentCount:forecast?.paymentDays.length??qtdParcelas,freight:frete,
    buyer:comprador.trim()||compradorProposto,baseDate,
    authorized:!testMode&&conferencia.podeGravar,
    items:chosen.map(x=>{
      const rateio=allocation.find(a=>a.code===x.p.produto_cod)
      return {code:x.p.produto_cod,description:x.p.descricao||x.p.produto_cod,
        quantity:x.qty,unitPrice:x.cost??0,discountPercent:pct,
        byBranch:rateio?.parts?branches.map((b,i)=>rateio.parts![i]>0?b+": "+rateio.parts![i]:"").filter(Boolean).join(", "):null}
    }),
  }):null
  async function copiar(texto:string){
    try { await navigator.clipboard.writeText(texto);setNotice("Texto copiado. Rascunho: confira a autorização antes de enviar.") }
    catch { setNotice("Não foi possível copiar automaticamente. Selecione o texto na prévia.") }
  }
  async function saveDraft() {
    if (saving || invalid || chosen.length === 0) return
    const client=createSupabaseBrowserClient()
    if (!client) { setNotice("Conexão indisponível; nada foi salvo."); return }
    setSaving(true);setNotice("")
    try {
      const itens=chosen.map(({p,qty,cost})=>({
        produto_codigo:p.produto_cod,quantidade:qty,custo_unitario:cost,desconto_percentual:pct,
      }))
      const {data,error}=await client.rpc("fn_compras_salvar_cotacao_rascunho",{
        p_filial:branch,p_itens:itens,p_observacao:notes.trim()||null,
      })
      if (error) {setNotice(error.code==="42501"?"Seu perfil não é Master ativo.":"Não foi possível salvar; confira os valores e tente novamente.");return}
      setNotice("Rascunho #"+String(data)+" salvo no Supabase. Nenhum pedido foi enviado ao SISCOM.")
      router.refresh()
    } catch { setNotice("Falha na conexão. Confirme a lista de rascunhos antes de repetir.") }
    finally {setSaving(false)}
  }
  return <section className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="erp-surface rounded-2xl p-5"><p className="text-xs text-slate-400">Itens encontrados</p><p className="mt-2 text-2xl font-bold text-cyan-200">{products.length}</p><p className="mt-1 text-[11px] text-slate-500">Limite de consulta: 40 produtos</p></div>
      <div className="erp-surface rounded-2xl p-5"><p className="text-xs text-slate-400">Itens selecionados</p><p className="mt-2 text-2xl font-bold text-white">{chosen.length}</p><p className="mt-1 text-[11px] text-slate-500">Quantidade total: {qtyFmt.format(units)}</p></div>
      <div className="erp-surface rounded-2xl p-5"><p className="text-xs text-slate-400">Valor negociado</p><p className="mt-2 text-2xl font-bold text-cyan-200">{money.format(amount)}</p><p className="mt-1 text-[11px] text-slate-500">Não equivale a verba autorizada</p></div>
    </div>
    <div className="erp-surface rounded-2xl p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-300"><Calculator size={16} className="text-cyan-300"/> Premissas da simulação</div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="text-xs text-slate-300">Desconto negociado (%)
          <input type="number" step="0.01" min="0" max="100" value={discount} onChange={e=>setDiscount(e.target.value)} className="erp-field mt-2 w-full px-3"/>
        </label>
        <label className="text-xs text-slate-300">Prazo de entrega (dias) · H15
          <input type="number" min="0" max="365" value={prazoEntrega} onChange={e=>setPrazoEntrega(e.target.value)} className="erp-field mt-2 w-full px-3"/>
        </label>
        <label className="text-xs text-slate-300">Nº de parcelas · H16
          <input type="number" min="1" max="10" value={numeroParcelas} onChange={e=>setNumeroParcelas(e.target.value)} className="erp-field mt-2 w-full px-3"/>
        </label>
        <label className="text-xs text-slate-300">Primeira parcela após entrega (dias) · H17
          <input type="number" min="0" max="3650" value={primeiraParcela} onChange={e=>setPrimeiraParcela(e.target.value)} className="erp-field mt-2 w-full px-3"/>
        </label>
        <label className="text-xs text-slate-300">Intervalo entre parcelas (dias) · H18
          <input type="number" min="0" max="3650" value={intervaloParcelas} onChange={e=>setIntervaloParcelas(e.target.value)} className="erp-field mt-2 w-full px-3"/>
        </label>
        <label className="text-xs text-slate-300">Condição especial (sobrescreve os prazos acima)
          <input value={paymentTerms} onChange={e=>setPaymentTerms(e.target.value)} maxLength={100} className="erp-field mt-2 w-full px-3" placeholder="Ex.: ent/30/60 ou 10x" />
        </label>
        <label className="text-xs text-slate-300">Frete · H20
          <select value={frete} onChange={e=>setFrete(e.target.value)} className="erp-field mt-2 w-full px-3">
            <option value="CIF">CIF</option><option value="FOB">FOB</option><option value="A negociar">A negociar</option>
          </select>
        </label>
        <label className="text-xs text-slate-300">Fornecedor confirmado
          <input value={fornecedor} onChange={e=>setFornecedor(e.target.value)} maxLength={150} placeholder="Informe para a mensagem" className="erp-field mt-2 w-full px-3"/>
        </label>
        <label className="text-xs text-slate-300">Comprador
          <input value={comprador} onChange={e=>setComprador(e.target.value)} maxLength={100} placeholder="Padrão por linha da Zacarini" className="erp-field mt-2 w-full px-3"/>
        </label>
        <label className="text-xs text-slate-300">Chegada prevista (opcional)
          <input type="date" value={deliveryDate} onChange={e=>setDeliveryDate(e.target.value)} className="erp-field mt-2 w-full px-3"/>
        </label>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-slate-400">Metas combinadas por subgrupo vêm do Plano de Estoque 2.3.7. Nos demais produtos, o DDE observado do Supabase converge gradualmente para a meta da linha (45/60/60/50), com os fatores da planilha. Quando não há fonte validada, a sugestão permanece indisponível. Nenhum valor autoriza pedidos. Os saldos da caixa e da OTB permanecem independentes.</p>
    </div>
    <div className="erp-surface overflow-x-auto rounded-2xl">
      <table className="min-w-[1260px] w-full text-left text-xs">
        <thead className="bg-[#102036] text-[10px] uppercase text-slate-400"><tr>
          {["Produto / marca","Subgrupo","Estoque","Ped. pend.","Venda/dia","DDE alvo","Sugestão","Qtde negociada","Últ. custo","Custo negociado","Valor final","Margem"].map(t=><th key={t} className="p-3">{t}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-white/10">
          {entries.map(({p,target,metaSource,sales,stock,pending,suggest,qty,quote,isMerchandise})=><tr key={p.produto_cod} className="transition hover:bg-cyan-400/[.04]">
            <td className="max-w-64 p-3"><p className="font-bold text-cyan-200">{p.produto_cod}</p><p className="mt-1 font-semibold text-white">{p.descricao||"Sem descrição"}</p><p className="mt-1 text-[11px] text-slate-500">{p.marca||p.fornecedor||"Marca não informada"}</p></td>
            <td className="max-w-44 p-3"><p className={isMerchandise?"text-slate-200":"text-amber-200"}>{p.grupo_subgrupo||"Sem cadastro"}</p></td>
            <td className="p-3 tabular-nums">{stock===null?"—":qtyFmt.format(stock)}</td>
            <td className="p-3 tabular-nums">{pending===null?"—":qtyFmt.format(pending)}</td>
            <td className="p-3 tabular-nums">{sales===null?"—":qtyFmt.format(sales)}</td>
            <td className="p-3 tabular-nums">{target??"—"}<p className="mt-1 max-w-28 text-[10px] leading-4 text-slate-500">{metaSource}</p></td>
            <td className="p-3"><span className="font-semibold text-emerald-300">{suggest??"—"}</span>{suggest!==null&&suggest>0&&<button type="button" onClick={()=>setQuantities(old=>({...old,[p.produto_cod]:String(suggest)}))} className="mt-2 block whitespace-nowrap text-[10px] font-bold text-cyan-300 underline">Usar sugestão</button>}</td>
            <td className="p-3"><input aria-label={"Quantidade "+p.produto_cod} type="number" min="0" max="100000000" step="1" value={quantities[p.produto_cod]??"0"} onChange={e=>setQuantities(old=>({...old,[p.produto_cod]:e.target.value}))} className="erp-field w-24 px-2 py-1.5"/></td>
            <td className="p-3 tabular-nums">{num(p.ultimo_custo)===null?"—":money.format(safe(p.ultimo_custo))}</td>
            <td className="p-3"><input aria-label={"Custo negociado "+p.produto_cod} type="number" min="0" step="0.01" placeholder="Informar" value={costs[p.produto_cod]??(p.ultimo_custo??"")} onChange={e=>setCosts(old=>({...old,[p.produto_cod]:e.target.value}))} className="erp-field w-28 px-2 py-1.5"/></td>
            <td className="p-3 font-bold tabular-nums text-cyan-100">{quote&&qty>0?money.format(quote.total):"—"}</td>
            <td className="p-3 tabular-nums">{quote?.margin===null||!quote?"—":new Intl.NumberFormat("pt-BR",{style:"percent",maximumFractionDigits:1}).format(quote.margin)}</td>
          </tr>)}
        </tbody>
      </table>
      {!products.length&&<div className="p-8 text-center text-sm text-slate-400"><PackageSearch className="mx-auto mb-3 text-cyan-400"/> Nenhum produto encontrado nesta busca.</div>}
    </div>
    <section className="erp-surface rounded-2xl p-5 sm:p-6">
      <h2 className="text-lg font-bold text-white">Pré-ranking de fornecedores</h2>
      <p className="mt-2 max-w-4xl text-xs leading-6 text-slate-400">
        Prioridade indicativa entre os SKUs desta busca (máximo 40), por quantidade com cobertura real inferior a 30 dias e sugestão baseada no DDE do plano. O valor é quantidade sugerida × último custo cadastrado: não representa cotação concorrente nem autorização de compra ou verba OTB.
      </p>
      {supplierPriority.length===0?<p className="mt-4 text-xs text-slate-400">Nenhum fornecedor disponível nesta consulta.</p>:<div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[740px] text-left text-xs">
          <thead className="border-b border-white/10 text-[10px] uppercase tracking-wide text-slate-400"><tr>
            {["Fornecedor da base","SKUs","Críticos <30 dias","Quantidade sugerida","Valor referencial","Conferência da fonte"].map(label=><th key={label} className="p-3">{label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-white/10">{supplierPriority.map(row=><tr key={row.supplier??"sem-fornecedor"}>
            <td className="p-3 font-semibold text-cyan-200">{row.supplier??"Fornecedor não informado"}</td>
            <td className="p-3 tabular-nums">{row.skuCount}</td>
            <td className="p-3 font-semibold tabular-nums text-amber-200">{row.urgentCount}</td>
            <td className="p-3 tabular-nums">{row.suggestedUnits===null?"Sugestão indisponível":qtyFmt.format(row.suggestedUnits)}</td>
            <td className="p-3 font-bold tabular-nums text-cyan-100">{row.referenceValue===null?"Pendente":money.format(row.referenceValue)}</td>
            <td className={row.unverifiedCount?"p-3 text-amber-200":"p-3 text-emerald-200"}>{row.unverifiedCount?`${row.unverifiedCount} produto(s) com fonte pendente`:"Fontes conferidas para esta estimativa"}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
    {chosen.length>0&&!invalid&&<SupplierQuoteComparison
      key={chosen.map(x=>`${x.p.produto_cod}:${x.qty}`).join("|")+"/"+fornecedorProposto}
      baseSupplier={fornecedorProposto} singleSupplier={singleSupplier}
      items={chosen.map(x=>({code:x.p.produto_cod,description:x.p.descricao||x.p.produto_cod,
        quantity:x.qty,unitCost:x.cost,discountPercent:pct}))}/>}
    {branch==="REDE"&&chosen.length>0&&<div className="erp-surface rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-white">Rateio entre as seis filiais</h2><p className="mt-2 text-xs leading-6 text-slate-400">Conforme Atendimento Fornecedor!AW:BB e AP:AU: prioridade pela necessidade, estoque, pendências e participação nas vendas, com arredondamento cumulativo sem sobras.</p></div><button type="button" onClick={loadRateio} disabled={rateioLoading} className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-bold text-cyan-100 disabled:opacity-40">{rateioLoading?"Consultando...":"Calcular rateio"}</button></div>
      {rateioError&&<p role="alert" className="mt-3 text-xs text-amber-200">{rateioError}</p>}
      {branchRows.length>0&&<div className="mt-5 overflow-x-auto"><table className="min-w-[720px] w-full text-xs"><thead className="text-left text-[11px] uppercase text-slate-400"><tr>{["SKU","Total","BDS","CG","RIO","CX","PG","AN","Conferência"].map(x=><th key={x} className="p-2">{x}</th>)}</tr></thead><tbody className="divide-y divide-white/10">{allocation.map(a=><tr key={a.code}><td className="p-2 font-bold text-cyan-200">{a.code}</td><td className="p-2">{a.qty}</td>{a.parts? a.parts.map((n,i)=><td key={i} className="p-2">{n}</td>):<td colSpan={6} className="p-2 text-amber-200">Sem fonte suficiente para rateio</td>}<td className="p-2">{a.parts&&a.parts.reduce((x,y)=>x+y,0)===a.qty?"✔ Confere":"Pendente"}</td></tr>)}</tbody></table></div>}
    </div>}
    <div className="erp-surface rounded-2xl p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-white"><CircleHelp className="text-cyan-300"/> Conferência do pedido</h2>
      {!chosen.length?<p className="mt-3 text-sm text-slate-400">Informe quantidades na grade para montar a simulação.</p>:<>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 p-4"><p className="text-[11px] text-slate-400">Quantidade</p><p className="mt-2 text-xl font-bold">{units}</p></div>
          <div className="rounded-xl border border-white/10 p-4"><p className="text-[11px] text-slate-400">Total a custo negociado</p><p className="mt-2 text-xl font-bold">{money.format(amount)}</p></div>
          <div className="rounded-xl border border-white/10 p-4"><p className="text-[11px] text-slate-400">Condição financeira</p><p className="mt-2 text-sm font-bold">{forecast?.status==="projetado"?"Parcelas simuladas":forecast?.status==="isento"?"Sem cobrança":"Conferir condições"}</p></div>
        </div>
        {forecast?.installments.length?<div className="mt-4 flex flex-wrap gap-2">{forecast.installments.map(p=><div key={p.number} className="rounded-lg border border-cyan-300/20 bg-cyan-400/5 p-3 text-xs"><p className="text-slate-400">Parcela {p.number} · {p.dueDate}</p><p className="mt-1 font-bold text-cyan-200">{money.format(p.amount)}</p></div>)}</div>:null}
        {invalid&&<div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-xs text-amber-100"><AlertTriangle size={16}/> Custo inválido ou item sem grupo de mercadorias 1–4. Revise antes de continuar.</div>}
        {forecast?.status==="conferir"&&<div role="alert" className="mt-4 text-xs text-amber-200">{forecast.issue}</div>}
        <section className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/[.06] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="text-sm font-bold text-amber-100">Conferência financeira com premissas manuais</h3><p className="mt-1 text-[11px] text-slate-300">Use para testar a lógica enquanto a Projeção 12M e o saldo oficial da OTB não estão homologados.</p></div>
            <button type="button" aria-pressed={testMode} onClick={()=>setTestMode(old=>!old)} className="rounded-lg border border-amber-400/40 bg-amber-300/10 px-4 py-2 text-xs font-bold text-amber-100">{testMode?"Encerrar conferência de teste":"Ativar conferência financeira de teste"}</button>
          </div>
          {testMode&&<div role="status" aria-label="Conferência financeira de teste" className="mt-4 rounded-lg border border-amber-400/30 bg-[#1c1d20] p-4">
            <p className="text-xs font-bold text-amber-200">MODO DE TESTE — não autoriza pedidos, verba ou liberação financeira.</p>
            <p className="mt-1 text-[11px] text-slate-300">{manualMode?"Cenário carregado da tabela compartilhada do Supabase, com calendário datado e saldos por linha. Permanece sem aprovação real.":"Os campos abaixo são fictícios, locais à tela e não alteram o Supabase. O teto de caixa é repetido em cada vencimento apenas para simular K24; não substitui o calendário de 26 semanas da OTB."}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" onClick={()=>void loadManualInputsFromServer()} disabled={manualLoading} className="rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-xs font-bold text-cyan-100 disabled:opacity-40">{manualLoading?"Consultando Supabase...":"Carregar entradas manuais"}</button>
              <button type="button" onClick={()=>setManualMode(false)} className="rounded-lg border border-white/20 px-4 py-2 text-xs font-bold text-slate-100">Usar exemplo editável</button>
              <Link href="/compras/entradas-manuais" className="text-xs font-semibold text-cyan-300 underline">Abrir tabela de entradas</Link>
            </div>
            {manualLoadError&&<p role="alert" className="mt-3 text-xs text-amber-200">{manualLoadError}</p>}
            {manualMode&&<p className="mt-3 text-[11px] text-cyan-100">Cenário manual: {competencia.slice(0,7)} · {branch} · {manualRows.filter(r=>r.competencia===competencia.slice(0,7)&&r.filial===branch).length} entrada(s) · sem aprovação real.</p>}
            {!manualMode&&<div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs text-slate-200">Custo diário previsto (teste)
                <input type="number" min="0" step="0.01" value={testDailyCost} onChange={e=>setTestDailyCost(e.target.value)} className="erp-field mt-2 w-full px-3"/>
              </label>
              <label className="text-xs text-slate-200">Data de liberação (teste)
                <input type="date" value={testReleaseDate} onChange={e=>setTestReleaseDate(e.target.value)} className="erp-field mt-2 w-full px-3"/>
              </label>
              <label className="text-xs text-slate-200">Teto acumulado de caixa (teste)
                <input type="number" min="0" step="0.01" value={testAccumulatedCash} onChange={e=>setTestAccumulatedCash(e.target.value)} className="erp-field mt-2 w-full px-3"/>
              </label>
              {([1,2,3,4] as const).map(line=><label key={line} className="text-xs text-slate-200">Saldo da linha {line} (teste)
                <input type="number" min="0" step="0.01" value={testLineBudget[line]} onChange={e=>setTestLineBudget(old=>({...old,[line]:e.target.value}))} className="erp-field mt-2 w-full px-3"/>
              </label>)}
            </div>}
            {!testFinancialInputsValid&&<p role="alert" className="mt-3 text-xs text-amber-200">Revise as premissas: o custo diário deve ser positivo, e os saldos e a data precisam ser válidos.</p>}
          </div>}
        </section>
        <div className="mt-5 rounded-xl border border-white/10 bg-[#0a1c30] p-5">
          <h3 className="text-sm font-bold text-white">Verificação de pedido · K22 a K27</h3>
          <p className="mt-1 text-[11px] leading-5 text-slate-400">As cinco conferências usam as mesmas condições da planilha. Pendente indica uma fonte ainda não homologada no Supabase, nunca aprovação implícita. {testMode?"Resultados abaixo calculados somente com premissas de TESTE.":null}</p>
          <div className="mt-4 space-y-2">
            {conferencia.validacoes.map(c=><div key={c.celula} className="flex items-start gap-3 rounded-lg border border-white/10 px-3 py-2 text-xs">
              <span className="w-10 shrink-0 font-mono font-bold text-cyan-300">{c.celula}</span>
              <span className={c.estado==="erro"?"text-rose-300":c.estado==="pendente"?"text-amber-200":"text-emerald-200"}>{c.estado==="pendente"?"◷ ":null}{c.texto}</span>
            </div>)}
          </div>
          <div className="mt-4 border-t border-white/10 pt-4 text-sm font-bold">
            <span className={conferencia.podeGravar?"text-emerald-300":"text-amber-200"}>
              {testMode?(conferencia.podeGravar?"TESTE: as fórmulas permitiriam gravar — aprovação real bloqueada":"TESTE: revise as premissas; aprovação real bloqueada"):
                conferencia.decisao==="pode_gravar"?"✔ PODE GRAVAR O PEDIDO":conferencia.decisao==="sem_itens"?"Digite as quantidades":"✖ REVISAR ANTES DE GRAVAR"}
            </span>
          </div>
        </div>
        {mensagens&&<div className="mt-5 space-y-3 rounded-xl border border-cyan-300/20 bg-[#081e2f] p-4">
          <h3 className="text-sm font-bold text-cyan-200">Mensagens do pedido · AO6 / AW6 / AW8</h3>
          <p className="text-[11px] text-amber-200">Até a liberação de caixa e OTB, os textos são rascunhos de negociação, não pedidos autorizados.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={()=>copiar(mensagens.whatsapp)} className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-bold text-cyan-200">Copiar mensagem WhatsApp</button>
            <button type="button" onClick={()=>copiar(mensagens.email)} className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-bold text-cyan-200">Copiar corpo do e-mail</button>
            <button type="button" onClick={()=>copiar(mensagens.subject)} className="rounded-lg border border-white/20 px-4 py-2 text-xs font-bold text-white">Copiar assunto</button>
          </div>
          <details className="text-xs text-slate-300"><summary className="cursor-pointer font-semibold">Ver prévia do WhatsApp e assunto do e-mail</summary><p className="mt-3 font-semibold text-cyan-100">{mensagens.subject}</p><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-[#05101d] p-4 leading-6">{mensagens.whatsapp}</pre></details>
        </div>}
        <div className="mt-5 space-y-3 rounded-xl border border-cyan-300/20 bg-cyan-400/5 p-4">
          <label className="block text-xs font-semibold text-slate-300">Observações da negociação
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={500} rows={2} placeholder="Fornecedor, frete, carga, descontos ou próximos contatos..." className="erp-field mt-2 w-full resize-y px-3 py-2"/>
          </label>
          <button type="button" onClick={saveDraft} disabled={saving||invalid||!validDiscount||!prazoValido||chosen.length===0} className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{saving?"Salvando...":"Salvar rascunho no Supabase"}</button>
          {notice&&<p role="status" className="text-xs text-cyan-100">{notice}</p>}
          <p className="text-[11px] text-slate-400">Rascunho auditável de negociação. Não aprova verba, não grava pedido nem atualiza o SISCOM.</p>
        </div>
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-xs leading-6 text-amber-100"><AlertTriangle size={18} className="shrink-0"/> A Zacarini exige caixa disponível em cada vencimento, verba livre da linha e validação da Projeção 12M. Como essa homologação ainda está pendente no Supabase, esta simulação NÃO autoriza gravar pedidos no SISCOM.</div>
      </>}
      {drafts.length>0&&<div className="mt-5 border-t border-white/10 pt-4"><h3 className="text-xs font-bold text-slate-200">Últimos rascunhos salvos</h3><div className="mt-3 flex flex-wrap gap-2">{drafts.map(d=><div key={d.id} className="rounded-lg border border-white/10 bg-[#071625] p-3 text-xs"><p className="font-bold text-cyan-200">#{d.id} · {d.filial}</p><p className="mt-1">{money.format(Number(d.total))} · {d.itens_count} item(ns)</p><p className="mt-1 text-[11px] text-slate-400">{new Date(d.criado_em).toLocaleString("pt-BR",{timeZone:"America/Campo_Grande"})}</p></div>)}</div></div>}
      <p className="mt-4 flex items-center gap-2 text-[11px] text-slate-500"><CheckCircle2 size={14}/> Consulta limitada, somente Master, nenhuma gravação de pedidos ou alterações no SISCOM · {branch}.</p>
    </div>
  </section>
}
