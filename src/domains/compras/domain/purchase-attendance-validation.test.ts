import { describe,expect,it } from "vitest"
import {validarAtendimento,ddePlanejado,PROGRESSO_DDE_ZACARINI_237,type AtendimentoInput} from "./purchase-attendance-validation"
const ok:AtendimentoInput={
 tipo:"Mercadoria",valor:300,diasPMP:45,custoDiarioPrevisto:10,
 primeiroVencimento:"2026-12-20",primeiraDataLiberada:"2026-12-01",
 parcelas:[{vencimento:"2026-12-20",valor:150},{vencimento:"2027-01-19",valor:150}],
 limitesAcumulados:[{data:"2026-12-01",limite:200},{data:"2027-01-01",limite:400}],
 verbasPorLinha:[{linha:"Saúde",valor:300,saldo:400}],quantidadeOrfa:false,itensInvalidos:false
}
const cel=(x:AtendimentoInput,id:string)=>validarAtendimento(x).validacoes.find(c=>c.celula===id)
describe("Atendimento Fornecedor 2.3.7 — fórmulas K21:K27",()=>{
 it("K27 sem valores exige quantidades",()=>expect(validarAtendimento({...ok,valor:0}).decisao).toBe("sem_itens"))
 it("K21 = valor / custo diário e K22 exige PMP maior ou igual ao giro",()=>{
  expect(validarAtendimento(ok).diasGiro).toBe(30)
  expect(cel(ok,"K22")?.estado).toBe("ok")
  expect(cel({...ok,diasPMP:29},"K22")?.texto).toMatch(/Paga antes de vender/)
 })
 it("K23 compara o primeiro vencimento com a liberação",()=>expect(cel({...ok,primeiraDataLiberada:"2026-12-21"},"K23")?.estado).toBe("erro"))
 it("K24 compara ACUMULADO de parcelas com ACUMULADO de caixa",()=>{
  expect(cel(ok,"K24")?.estado).toBe("ok")
  expect(cel({...ok,limitesAcumulados:[{data:"2026-12-01",limite:100},{data:"2027-01-01",limite:200}]},"K24")?.texto).toMatch(/2 parcela/)
 })
 it("K25 verifica linha, não total de rede",()=>expect(cel({...ok,verbasPorLinha:[{linha:"Saúde",valor:300,saldo:299}]},"K25")?.estado).toBe("erro"))
 it("K24 acumula parcelas por vencimento mesmo se a fonte vier fora de ordem",()=>{
  expect(cel({...ok,parcelas:[...ok.parcelas].reverse()},"K24")?.estado).toBe("ok")
 })
 it("K26 detecta quantidades órfãs",()=>expect(cel({...ok,quantidadeOrfa:true},"K26")?.estado).toBe("erro"))
 it("K27 PODE GRAVAR só quando todas as verificações concluídas",()=>{
  expect(validarAtendimento(ok).decisao).toBe("pode_gravar")
  expect(validarAtendimento(ok).podeGravar).toBe(true)
 })
 it("trava sem projeção, caixa, verba, sem inventar zero",()=>{
  const v=validarAtendimento({...ok,custoDiarioPrevisto:null,primeiraDataLiberada:null,limitesAcumulados:null,verbasPorLinha:null})
  expect(v.validacoes.filter(x=>x.estado==="pendente")).toHaveLength(4)
  expect(v.podeGravar).toBe(false)
 })
 it("despesas ficam fora da OTB de mercadorias, mas ainda precisam de caixa",()=>{
  expect(cel({...ok,tipo:"Despesa",verbasPorLinha:null},"K25")?.estado).toBe("nao_aplica")
  expect(validarAtendimento({...ok,tipo:"Despesa",limitesAcumulados:null}).podeGravar).toBe(false)
 })
})
describe("Plano de Estoque — OTB!P:U e AR:AT",()=>{
 it("meta de 60 com início 118.2108 reduz a 86/75/68 dias na Zacarini 2.3.7",()=>{
  const ini=118.21081273976269
  expect([1,2,3].map(i=>ddePlanejado(ini,60,PROGRESSO_DDE_ZACARINI_237[i]))).toEqual([86,75,68])
 })
 it("início acima de 365 vai direto à meta; combinado manual tem prioridade",()=>{
  expect(ddePlanejado(400,60,.55)).toBe(60)
  expect(ddePlanejado(118,60,.55,77)).toBe(77)
 })
})
