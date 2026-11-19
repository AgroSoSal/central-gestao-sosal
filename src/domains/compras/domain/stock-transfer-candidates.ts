/** Indicações não vinculantes: falta frete, alçada, transporte e custo de transferência. */
type Row = { filial:string; produto_cod:string; situacao:string;
  qtde_estoque:string|number|null; dde_previsto:string|number|null;
  previsto_90d:string|number|null }

export function findStockTransferCandidates(rows:Row[]):{produto:string;origem:string;destino:string}[] {
  const candidates:{produto:string;origem:string;destino:string}[]=[]
  const branches=rows.filter(r=>r.filial!=="REDE")
  for (const origin of branches) {
    if(!["excesso","sem_giro"].includes(origin.situacao)||Number(origin.qtde_estoque??0)<=0)continue
    for (const target of branches) {
      if(origin.produto_cod!==target.produto_cod||origin.filial===target.filial||target.situacao==="excluido")continue
      const demand=Number(target.previsto_90d??0)
      const days=target.dde_previsto===null?null:Number(target.dde_previsto)
      if(!(demand>0) || days!==null&&(!Number.isFinite(days)||days>=30))continue
      candidates.push({produto:origin.produto_cod,origem:origin.filial,destino:target.filial})
    }
  }
  return candidates
}
