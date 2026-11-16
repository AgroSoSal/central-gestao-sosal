import { describe, expect, it } from "vitest"
import { getBranchDisplayName } from "./branches"

describe("filiais compartilhadas entre servidor e navegador", () => {
  it("exibe a filial correta sem modificar o identificador do banco", () => {
    expect(getBranchDisplayName("SO SAL")).toBe("BANDEIRANTES")
    expect(getBranchDisplayName("CAMPO GRANDE")).toBe("CAMPO GRANDE")
    expect(getBranchDisplayName("RIO VERDE")).toBe("RIO VERDE")
  })
})
