import { describe, expect, it } from "vitest"
import { classifyOtbSubgroup237 } from "./otb-subgroup-kind-237"

describe("OTB!C48:C173 — classes S/P/M/N da Zacarini 2.3.7", () => {
  it.each([
    ["1.LINHA NUTRIÇÃO / MINERAL E PROTEICO", "P"],
    ["1.LINHA NUTRIÇÃO / RAÇÃO SÓ SAL", "P"],
    ["1.LINHA NUTRIÇÃO / NUCLEO E PREMIX", "M"],
    ["1.LINHA NUTRIÇÃO / MATERIA PRIMA", "S"],
    ["3.OUTROS / PRODUTO ACABADO", "P"],
    ["3.OUTROS / PRODUTO ACABADO INSUMOS (SÓ SA", "P"],
    ["2.LINHA SAÚDE / VACINAS / RAIVA", "S"],
    ["3.OUTROS / FERRAMENTAS", "S"],
    ["4.PASTAGEM / ADUBO / INSUMOS", "S"],
    ["SEM SUBGRUPO", "N"],
    ["1.LINHA NUTRIÇÃO / NUCLEO E PREMIX / INEXISTENTE", "N"],
  ] as const)("classifica %s como %s, sem incluir produção própria em compras novas", (name, expected) => {
    expect(classifyOtbSubgroup237(name)).toBe(expected)
  })
})
