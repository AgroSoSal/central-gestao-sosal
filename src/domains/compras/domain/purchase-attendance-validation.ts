/** Equivalência das regras Atendimento Fornecedor!K22:K27, Zacarini 2.3.7.
 * Fontes financeiras ausentes não são tratadas como verba zero ou aprovação. */
export type AtendimentoCheck = { celula: "K22"|"K23"|"K24"|"K25"|"K26"; estado: "ok"|"erro"|"pendente"|"nao_aplica"; texto: string }
export type AtendimentoInput = {
  tipo: "Mercadoria"|"Despesa"; valor: number; diasPMP: number|null; custoDiarioPrevisto: number|null;
  primeiroVencimento: string|null; primeiraDataLiberada: string|null;
  parcelas: { vencimento:string; valor:number }[];
  limitesAcumulados: { data:string; limite:number }[]|null;
  verbasPorLinha: { linha:string; valor:number; saldo:number|null }[]|null;
  quantidadeOrfa: boolean; itensInvalidos: boolean
}
export type AtendimentoResultado = {
  validacoes: AtendimentoCheck[]; decisao: "sem_itens"|"revisar"|"pode_gravar";
  podeGravar: boolean; diasGiro: number|null
}
const centavos = (x:number)=>Math.round(x*100)
const dataValida=(s:unknown):s is string=>typeof s==="string" && /^\d{4}-\d{2}-\d{2}$/.test(s)
  && !Number.isNaN(Date.parse(s+"T00:00:00Z")) && new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s
const linha=(celula:AtendimentoCheck["celula"],estado:AtendimentoCheck["estado"],texto:string):AtendimentoCheck=>({celula,estado,texto})
/** K27 reproduz COUNTIF(K22:K26,"✖*") com guarda adicional de fontes oficiais incompletas. */
export function validarAtendimento(input:AtendimentoInput):AtendimentoResultado {
  const base={validacoes:[] as AtendimentoCheck[],decisao:"sem_itens" as const,podeGravar:false,diasGiro:null as number|null}
  if(!Number.isFinite(input.valor)||input.valor<=0||input.itensInvalidos){
    if(input.itensInvalidos) return {...base,validacoes:[linha("K26","erro","✖ Quantidade ou custo inválido")],decisao:"revisar"}
    return base
  }
  const v:AtendimentoCheck[]=[]
  const giro=input.custoDiarioPrevisto!==null&&Number.isFinite(input.custoDiarioPrevisto)&&input.custoDiarioPrevisto>0
    ? input.valor/input.custoDiarioPrevisto : null
  // K21 = K20 / SUMIFS(AD63:AD562;S63:S562;">0"); K22 = PMP >= giro.
  if(input.tipo==="Despesa") v.push(linha("K22","nao_aplica","— despesa: não se aplica"))
  else if(giro===null||input.diasPMP===null||!Number.isFinite(input.diasPMP))
    v.push(linha("K22","pendente","PMP × giro: falta custo diário previsto (AD63:AD562)"))
  else v.push(input.diasPMP>=giro
    ?linha("K22","ok","✔ PMP cobre o giro do pedido")
    :linha("K22","erro","✖ Paga antes de vender – pedir mais prazo ou menos quantidade"))
  // K23 = primeiro vencimento >= OTB!B17 (data liberada na Projeção 12M).
  if(!dataValida(input.primeiroVencimento)||!dataValida(input.primeiraDataLiberada))
    v.push(linha("K23","pendente","1ª parcela: falta data liberada (OTB!B17)"))
  else v.push(input.primeiroVencimento>=input.primeiraDataLiberada
    ?linha("K23","ok","✔ 1ª parcela depois da data liberada")
    :linha("K23","erro","✖ 1ª parcela antes de "+input.primeiraDataLiberada))
  // K24 = parcelas acumuladas <= LOOKUP(vencimento, OTB!B33:AA33, OTB!B41:AA41)
  if(!input.limitesAcumulados?.length||!input.parcelas.length
    ||input.limitesAcumulados.some(c=>!dataValida(c.data)||!Number.isFinite(c.limite)||c.limite<0)
    ||input.parcelas.some(p=>!dataValida(p.vencimento)||!Number.isFinite(p.valor)||p.valor<0))
    v.push(linha("K24","pendente","Parcelas × caixa: falta calendário acumulado OTB!B33:AA41"))
  else {
    const limites=[...input.limitesAcumulados].sort((a,b)=>a.data.localeCompare(b.data))
    let soma=0,acima=0
    for(const p of input.parcelas){
      soma+=centavos(p.valor)
      const limite=limites.filter(c=>c.data<=p.vencimento).at(-1)?.limite??0
      if(soma>centavos(limite))acima++
    }
    v.push(acima===0?linha("K24","ok","✔ Todas as parcelas cabem no caixa")
      :linha("K24","erro","✖ "+acima+" parcela(s) acima do limite"))
  }
  // K25 = V7:V10 <= S7:S10, já deduzidos os excessos por linha.
  if(input.tipo==="Despesa") v.push(linha("K25","nao_aplica","✔ Fora da verba OTB – conferir orçado do bloco ⑨"))
  else if(!input.verbasPorLinha?.length||input.verbasPorLinha.some(x=>!Number.isFinite(x.valor)||x.saldo===null||!Number.isFinite(x.saldo)))
    v.push(linha("K25","pendente","Verba por linha: falta saldo OTB deduzido de excesso"))
  else v.push(input.verbasPorLinha.some(x=>centavos(x.valor)>centavos(x.saldo!))
    ?linha("K25","erro","✖ Estoura a verba – ver bloco ④")
    :linha("K25","ok","✔ Cabe na verba da(s) linha(s)"))
  // K26 = produtos vazios com quantidade digitada.
  v.push(input.quantidadeOrfa?linha("K26","erro","✖ Quantidade em linha sem produto – limpe a coluna S")
    :linha("K26","ok","OK"))
  const pronto=v.every(x=>x.estado==="ok"||x.estado==="nao_aplica")
  return {validacoes:v,decisao:pronto?"pode_gravar":"revisar",podeGravar:pronto,diasGiro:giro}
}
/** OTB!P188:U188: descida do DDE por subgrupo, com teto de início 365 dias. */
export function ddePlanejado(inicio:number|null,meta:number,progresso:number,metaCombinada?:number|null):number {
  if(metaCombinada!==null&&metaCombinada!==undefined)return metaCombinada
  if(!Number.isFinite(meta)||meta<0||!Number.isFinite(progresso)||progresso<0||progresso>1)
    throw new RangeError("Plano de DDE inválido")
  if(inicio===null||!Number.isFinite(inicio)||inicio>365)return meta
  return Math.round(inicio-(inicio-meta)*progresso)
}
export const PROGRESSO_DDE_ZACARINI_237=[0.30,0.55,0.75,0.87,0.95,1] as const
