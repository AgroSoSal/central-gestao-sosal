import { describe, expect, it } from "vitest"
import { validateOwnProductionDraft } from "./own-production-draft"

const input = { produto_cod: "123", peso_kg: "25.5", industrializacao_rs_t: "200", frete_rs_t: "50", observacao: "Conferir com indústria" }
describe("cadastro técnico de produção própria", () => {
  it("converte os parâmetros para rascunho sem homologação financeira", () => {
    expect(validateOwnProductionDraft(input)).toEqual({ productCode: "123", weight: 25.5, industry: 200, freight: 50, notes: "Conferir com indústria" })
  })
  it("aceita frete ausente, sem atribuir custo aprovado", () => {
    expect(validateOwnProductionDraft({ ...input, frete_rs_t: "" }).freight).toBeNull()
  })
  it("rejeita pesos ausentes, negativos e precisão excessiva", () => {
    for (const peso_kg of ["", "-1", "0", "20.0009", "invalido"]) {
      expect(() => validateOwnProductionDraft({ ...input, peso_kg })).toThrow()
    }
  })
  it("rejeita códigos inválidos, custos negativos e observação excessiva", () => {
    expect(() => validateOwnProductionDraft({ ...input, produto_cod: "" })).toThrow()
    expect(() => validateOwnProductionDraft({ ...input, industrializacao_rs_t: "-20" })).toThrow()
    expect(() => validateOwnProductionDraft({ ...input, frete_rs_t: "x" })).toThrow()
    expect(() => validateOwnProductionDraft({ ...input, observacao: "X".repeat(501) })).toThrow()
  })
})
