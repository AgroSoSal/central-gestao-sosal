import { AlertTriangle, FileCheck2 } from "lucide-react"

export type BankReference238Row = {
  linha_excel:number
  filial:string
  banco:string
  conta_planilha:string
  conta_siscom:string|null
  data_origem_referencia:string
  saldo_referencia:number|string
  saldo_siscom:number|string|null
  data_siscom:string|null
  diferenca:number|string|null
  resultado:string
  criterio:string
}
export type BankReference238 = {
  arquivo:string
  sha256:string
  fonte:string
  saldo_referencia:number|string
  contas_referencia:number
  contas_identificadas:number
  contas_nao_identificadas:number
  linhas_iguais:number
  linhas_diferentes:number
  posicao_siscom_atual:number|string|null
  mesma_data_referencia:boolean
  autoriza_compras:false
  observacao:string
  linhas:BankReference238Row[]
}
const money = new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"})
const formatted=(value:number|string|null)=>value===null?"—":money.format(Number(value))
const dateBR=(value:string|null)=>value?value.slice(8,10)+"/"+value.slice(5,7)+"/"+value.slice(0,4):"—"
const status=(value:string)=>({
 CONFERE_NA_DATA_DE_ORIGEM:"Confere na data",
 DIFERENCA_DOCUMENTADA_A_CONFERIR:"Ajuste histórico a conferir",
 CONTA_SEM_CORRESPONDENCIA_VALIDADA:"Conta sem vínculo validado",
 SEM_HISTORICO_NA_DATA:"Sem histórico na data",
}[value]??"Não classificado")

export function Zacarini238BankPanel({source,error}:{
  source:BankReference238|null
  error:boolean
}) {
 return <section className="erp-surface overflow-hidden rounded-2xl" aria-label="Comparação com Zacarini 2.3.8">
  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 p-6">
   <div>
    <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-cyan-300"><FileCheck2 size={15}/> Comprovação histórica · Excel 2.3.8</p>
    <h2 className="mt-2 text-xl font-bold">Zacarini × Supabase: os mesmos saldos nas mesmas datas</h2>
    <p className="mt-2 max-w-4xl text-xs leading-6 text-slate-400">
     Compara Extratos_Bancos!K5:K15 com o saldo SISCOM existente na data exata de origem de cada linha.
     Não compara diretamente os R$ 2,18 milhões de 17/11 com os saldos das 14 contas em 23/11, pois são períodos e escopos diferentes.
    </p>
   </div>
   <span className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[11px] font-bold text-amber-200">Referência histórica · não homologada</span>
  </div>
  {error||!source?
   <p role="alert" className="p-6 text-xs text-amber-200">Não foi possível consultar o comparativo protegido da planilha com o Supabase. Nenhum saldo foi presumido.</p>:
   <>
    <div className="grid gap-3 border-b border-slate-800 p-5 sm:grid-cols-2 xl:grid-cols-4">
     <div className="rounded-xl border border-slate-700 p-4"><p className="text-xs text-slate-400">Saldo da referência Excel</p><p className="mt-2 text-lg font-bold">{formatted(source.saldo_referencia)}</p><p className="mt-1 text-[11px] text-slate-500">11 contas · datas de origem anteriores</p></div>
     <div className="rounded-xl border border-slate-700 p-4"><p className="text-xs text-slate-400">Saldo parcial atual SISCOM</p><p className="mt-2 text-lg font-bold">{formatted(source.posicao_siscom_atual)}</p><p className="mt-1 text-[11px] text-slate-500">14 contas · outro escopo e período</p></div>
     <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4"><p className="text-xs text-slate-400">Conferem na data correspondente</p><p className="mt-2 text-lg font-bold tabular-nums text-cyan-200">{source.linhas_iguais}/{source.contas_referencia}</p></div>
     <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4"><p className="text-xs text-slate-400">Ajustes / cadastros a esclarecer</p><p className="mt-2 text-lg font-bold tabular-nums text-amber-100">{source.linhas_diferentes} + {source.contas_nao_identificadas}</p><p className="mt-1 text-[11px] text-slate-500">Não altera contas nem histórico</p></div>
    </div>
    <div className="overflow-x-auto"><table className="erp-table w-full min-w-[1100px] text-left text-xs">
     <thead className="bg-[#121e30] uppercase tracking-wide text-slate-400"><tr>
      <th className="p-4">Loja e banco</th><th className="p-4">Conta na planilha</th><th className="p-4">Data de origem</th><th className="p-4 text-right">Zacarini R$</th><th className="p-4 text-right">Supabase mesma data R$</th><th className="p-4 text-right">Ajuste da planilha R$</th><th className="p-4">Verificação</th>
     </tr></thead>
     <tbody className="divide-y divide-slate-800">{source.linhas.map(row=><tr key={row.linha_excel}>
      <td className="p-4"><strong className="block text-slate-100">{row.filial}</strong><span className="text-slate-400">{row.banco}</span></td>
      <td className="p-4 font-semibold text-cyan-300">{row.conta_planilha}</td>
      <td className="p-4">{dateBR(row.data_origem_referencia)}</td>
      <td className="p-4 text-right tabular-nums">{formatted(row.saldo_referencia)}</td>
      <td className="p-4 text-right tabular-nums">{formatted(row.saldo_siscom)}</td>
      <td className="p-4 text-right tabular-nums">{formatted(row.diferenca)}</td>
      <td className="p-4"><span className={row.resultado==="CONFERE_NA_DATA_DE_ORIGEM"?"font-semibold text-emerald-200":"font-semibold text-amber-200"}>{status(row.resultado)}</span><p className="mt-1 max-w-sm text-[11px] leading-5 text-slate-500">{row.criterio}</p></td>
     </tr>)}</tbody>
    </table></div>
    <p className="flex items-start gap-2 p-5 text-[11px] leading-6 text-amber-200">
      <AlertTriangle size={15} className="mt-1 shrink-0"/> A planilha documenta conciliações históricas em 13/11, mas não anexa os 11 PDFs bancários originais nem comprova o saldo em 23/11. A diferença da 29255-4 é um ajuste de referência de R$ 12.591,52; a conta 5831-9 (Sicoob) não está no escopo SISCOM e a conta Itaú CG 31531-9 não deve ser confundida com 315131-9. Nenhuma dessas referências foi lançada no razão bancário nem libera limite OTB.
    </p>
   </>}
 </section>
}
