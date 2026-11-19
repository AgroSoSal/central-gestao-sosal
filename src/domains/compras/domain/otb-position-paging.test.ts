import { describe, expect, it } from "vitest"
import { pageOtbPositions } from "./otb-position-paging"

describe("paginação da posição OTB", () => {
  const rows = Array.from({ length: 110 }, (_, i) => ({ codigo: i + 1 }))

  it("permite visualizar a última página sem ocultar subgrupos", () => {
    const result = pageOtbPositions(rows, 3, 50)
    expect(result.items.map((row) => row.codigo)).toEqual(Array.from({ length: 10 }, (_, i) => i + 101))
    expect(result.total).toBe(110)
    expect(result.totalPages).toBe(3)
    expect(result.from).toBe(101)
    expect(result.to).toBe(110)
  })

  it("limita a página quando um filtro reduz os resultados", () => {
    const result = pageOtbPositions(rows.slice(0, 12), 3, 50)
    expect(result.page).toBe(1)
    expect(result.items).toHaveLength(12)
    expect(result.from).toBe(1)
  })

  it("não inventa posições quando a lista está vazia", () => {
    const result = pageOtbPositions([], 4, 50)
    expect(result).toMatchObject({ total: 0, page: 1, totalPages: 1, from: 0, to: 0, items: [] })
  })
})
