import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("Histórico do OTB no Supabase", () => {
  it("usa resumo diário existente sem refresh pesado e mantém ajustes de classificação por produto", () => {
    const sql = readFileSync(resolve(process.cwd(), "docs/compras/otb_historico_mensal_resumo_237.sql"), "utf8")

    expect(sql).toContain("painel.mv_venda_dia_linha")
    expect(sql).toContain("otb_classificacao_complementar_produto")
    expect(sql).toContain("linha_original")
    expect(sql).toContain("linha_otb")
    expect(sql).toContain("auth.uid()")
    expect(sql).not.toMatch(/refresh\s+materialized\s+view/i)
    expect(sql).not.toMatch(/\b(update|delete|truncate)\s+painel\.vendas\b/i)
  })
})
