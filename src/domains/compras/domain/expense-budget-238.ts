/** Zacarini 2.3.8: Cad_Despesas!F/H => Atendimento Fornecedor!E/I.
 * H é o Grupo de Orçamento ("Logística"), não a conta da coluna G.
 * A coluna I compara o grupo com Orc_Dados!tbOrc[Grupo], tipo "Replanejado".
 */
export const EXPENSE_BUDGET_GROUPS_238 = [
  "Administrativo","Industrial","Investimento","Logística","Marketing","Pessoal",
] as const
export type ExpenseBudgetGroup238 = typeof EXPENSE_BUDGET_GROUPS_238[number]
const byArea:Record<string,ExpenseBudgetGroup238> = {
  ADMINISTRATIVO:"Administrativo",
  INDUSTRIAL:"Industrial",
  INVESTIMENTO:"Investimento",
  LOGISTICA:"Logística",
  MARKETING:"Marketing",
  PESSOAL:"Pessoal",
}
export function budgetGroupForArea238(area:string|null|undefined):ExpenseBudgetGroup238|null {
  return area ? (byArea[area.trim().toLocaleUpperCase("pt-BR")]??null) : null
}
export type ExpenseBudgetSnapshot238 = {
  source:"ORC_DADOS_REPLANEJADO_238"
  status:"manual_sem_homologacao"
  competencia:string
  authorizesPurchases:false
  grupos: Array<{grupo:string; qtd_itens:number; orcamento:number|string|null; saldo_assinado:number|string|null}>
  itens: Array<{id:number; grupo:string; item:string; valor:number|string; atualizado_em:string}>
}
export function parseExpenseBudget238(value:unknown,month:string):ExpenseBudgetSnapshot238|null {
  if(!value||typeof value!=="object"||Array.isArray(value))return null
  const x=value as Partial<ExpenseBudgetSnapshot238>
  if(x.source!=="ORC_DADOS_REPLANEJADO_238"||
     x.status!=="manual_sem_homologacao"||x.authorizesPurchases!==false||
     x.competencia!==month||!Array.isArray(x.grupos)||x.grupos.length!==6||
     !Array.isArray(x.itens))return null
  if(x.grupos.some(g=>!g||!EXPENSE_BUDGET_GROUPS_238.some(name=>name===g.grupo)||
    !Number.isSafeInteger(g.qtd_itens)||g.qtd_itens<0||
    (g.orcamento!==null&&(!Number.isFinite(Number(g.orcamento))||Number(g.orcamento)<0))||
    (g.qtd_itens===0 && g.orcamento!==null)||
    (g.qtd_itens>0 && g.orcamento===null)))return null
  return x as ExpenseBudgetSnapshot238
}
export function budgetForExpense238(snapshot:ExpenseBudgetSnapshot238|null,area:string|null|undefined):number|null {
  const group=budgetGroupForArea238(area)
  if(!snapshot||!group)return null
  const row=snapshot.grupos.find(x=>x.grupo===group)
  return row&&row.qtd_itens>0&&row.orcamento!==null?Number(row.orcamento):null
}
