import { describe, expect, it } from "vitest"
import { parseOwnProductionReferences237 } from "./own-production-reference-237"

const row = (codigo: string, valor: number, origem_celula: string, dimensao = "373") => ({
  codigo, grupo: "producao_referencia", dimensao, competencia: null,
  valor, texto: "SAL SO SAL EQUINOS 30 KG SO SAL", origem_aba: "Produção Própria",
  origem_celula, versao: "2.3.7", situacao: "referencia",
})

describe("referências da Produção Própria 2.3.7", () => {
  it("reúne peso e custo adicional do mesmo SKU preservando a origem", () => {
    expect(parseOwnProductionReferences237([
      row("producao_peso_kg_373", 30, "C5"),
      row("producao_custo_extra_un_373", 6, "D5"),
    ])).toEqual([{
      produto_cod: "373", descricao: "SAL SO SAL EQUINOS 30 KG SO SAL",
      peso_kg: 30, custo_extra_unidade: 6, origem_peso: "C5", origem_custo: "D5",
    }])
  })
  it("não inventa valores para produto incompleto nem usa versões diferentes", () => {
    expect(parseOwnProductionReferences237([row("producao_peso_kg_373", 30, "C5")])).toEqual([])
    expect(parseOwnProductionReferences237([
      row("producao_peso_kg_373", 30, "C5"),
      { ...row("producao_custo_extra_un_373", 6, "D5"), versao: "2.3.6" },
    ])).toEqual([])
  })
  it("ignora origens inconsistentes, custos negativos e duplicatas ambíguas", () => {
    const peso = row("producao_peso_kg_373", 30, "C5")
    const custo = row("producao_custo_extra_un_373", 6, "D5")
    expect(parseOwnProductionReferences237([peso, { ...custo, valor: -6 }])).toEqual([])
    expect(parseOwnProductionReferences237([peso, { ...custo, origem_celula: "D6" }])).toEqual([])
    expect(parseOwnProductionReferences237([peso, peso, custo])).toEqual([])
    expect(parseOwnProductionReferences237([peso, { ...custo, situacao: "invalido" }])).toEqual([])
  })
})
