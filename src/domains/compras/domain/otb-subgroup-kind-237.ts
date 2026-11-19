/** OTB!C48:C173 (Zacarini 2.3.7): S = compra, P = produção própria,
 * M = núcleo/premix interno, N = sem classificação operacional segura.
 * Os prefixos agrupam variações da extração (especialmente nomes Só Sal).
 * Regra extraída da planilha, mas executada sem conexão com o Excel.
 */
export type OtbSubgroupKind237 = "S" | "P" | "M" | "N"

export function classifyOtbSubgroup237(rawName:string):OtbSubgroupKind237 {
  const name=rawName.trim().toUpperCase()
  const nutricao="1.LINHA NUTRIÇÃO / "
  if(name===`${nutricao}MATERIA PRIMA`)return "S"
  if(name===`${nutricao}NUCLEO E PREMIX`)return "M"
  if(name.startsWith(`${nutricao}NUCLEO E PREMIX /`))return "N"
  if(name.startsWith(nutricao))return "P"
  if(name.startsWith("3.OUTROS / PRODUTO ACABADO"))return "P"
  if(/^[234]\./.test(name))return "S"
  return "N"
}
