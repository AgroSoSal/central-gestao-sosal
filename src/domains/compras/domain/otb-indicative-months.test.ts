import { describe, expect, it } from "vitest"
import { nextOtbPurchaseNeeds } from "./otb-indicative-months"

describe("OTB: horizonte de compras indicativas", () => {
  it("começa no mês seguinte ao início do fluxo, como OTB!B7, e lê três meses", () => {
    expect(nextOtbPurchaseNeeds("2026-11-19",
      ["2026-11-01","2026-12-01","2027-01-01","2027-02-01"], [100,200,300,400]))
      .toEqual([{month:"2026-12-01",amount:200},{month:"2027-01-01",amount:300},
        {month:"2027-02-01",amount:400}])
  })
  it("não preenche meses ausentes nem aceita números inválidos", () => {
    expect(nextOtbPurchaseNeeds("2026-11-19",["2026-11-01","2026-12-01","2027-02-01"],[0,100,200])).toBeNull()
    expect(nextOtbPurchaseNeeds("2026-11-19",["2026-12-01","2027-01-01","2027-02-01"],[0,-1,200])).toBeNull()
    expect(nextOtbPurchaseNeeds("invalid",[],[])).toBeNull()
  })
})
