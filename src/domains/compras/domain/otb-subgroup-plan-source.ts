import type { PreviewDdePlan } from "./otb-subgroup-preview"

type ReadResult={data:unknown;error:unknown}
type ReadMonth=(month:string)=>Promise<ReadResult>
export type DdeReadResult=
  | {state:"conectado";plans:PreviewDdePlan[]}
  | {state:"indisponivel";reason:string}

/** Verifica os três resultados completos, sem esconder truncamento silencioso de página. */
export async function fetchOtbSubgroupPlans(months:readonly [string,string,string],read:ReadMonth):Promise<DdeReadResult>{
  if(months.length!==3||months.some(m=>!/^20\d\d-(0[1-9]|1[0-2])-01$/.test(m))||new Set(months).size!==3){
    return {state:"indisponivel",reason:"Competências inválidas para o plano de estoque."}
  }
  let results:ReadResult[]
  try{results=await Promise.all(months.map(read))}catch{
    return {state:"indisponivel",reason:"Falha de consulta ao Plano de Estoque."}
  }
  const plans:PreviewDdePlan[]=[]
  const seen=new Set<string>()
  let firstMonthGroups:Set<string>|null=null
  for(let monthIndex=0;monthIndex<3;monthIndex++){
    const result=results[monthIndex]
    if(result.error||!Array.isArray(result.data))return {state:"indisponivel",reason:"Plano de Estoque indisponível para uma competência."}
    const rows=result.data as Record<string,unknown>[]
    if(!rows.length)return {state:"indisponivel",reason:"Uma competência não possui metas de DDE registradas."}
    const total=Number(rows[0]?.total_itens)
    if(!Number.isSafeInteger(total)||total!==rows.length){
      return {state:"indisponivel",reason:"A consulta retornou apenas parte dos subgrupos."}
    }
    const monthGroups=new Set<string>()
    for(const row of rows){
      if(!row||typeof row.grupo_subgrupo!=="string"||!row.grupo_subgrupo.trim()||
        row.competencia!==months[monthIndex]){
        return {state:"indisponivel",reason:"Metas de DDE não correspondem à competência solicitada."}
      }
      const key=`${row.grupo_subgrupo}\0${row.competencia}`
      if(seen.has(key))return {state:"indisponivel",reason:"Plano contém subgrupo duplicado."}
      seen.add(key)
      monthGroups.add(row.grupo_subgrupo)
      plans.push({grupo_subgrupo:row.grupo_subgrupo,competencia:row.competencia as string,
        dde_meta:typeof row.dde_meta==="number"||typeof row.dde_meta==="string"?row.dde_meta:null})
    }
    if(firstMonthGroups===null)firstMonthGroups=monthGroups
    else if(monthGroups.size!==firstMonthGroups.size||[...monthGroups].some(name=>!firstMonthGroups!.has(name))){
      return {state:"indisponivel",reason:"O cadastro de metas varia entre as três competências."}
    }
  }
  return {state:"conectado",plans}
}
