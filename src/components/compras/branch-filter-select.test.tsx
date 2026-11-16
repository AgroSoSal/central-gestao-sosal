import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { BranchFilterSelect, getBranchDisplayName } from "./branch-filter-select"

const branches = ["CAMPO GRANDE", "RIO VERDE", "COXIM"]
afterEach(cleanup)

describe("BranchFilterSelect", () => {
  it("mostra Bandeirantes para a filial interna SO SAL sem alterar o filtro enviado", () => {
    const { container } = render(
      <form>
        <BranchFilterSelect branches={["CAMPO GRANDE", "SO SAL"]} selectedBranch="SO SAL" />
      </form>,
    )

    expect(screen.getByRole("combobox", { name: "Filial" })).toHaveTextContent("BANDEIRANTES")
    expect(new FormData(container.querySelector("form")!).get("loja")).toBe("SO SAL")
    expect(getBranchDisplayName("SO SAL")).toBe("BANDEIRANTES")
    expect(getBranchDisplayName("CAMPO GRANDE")).toBe("CAMPO GRANDE")
  })
  it("mantém a filial selecionada no formulário de consulta", () => {
    const { container } = render(
      <form>
        <BranchFilterSelect branches={branches} selectedBranch="COXIM" />
      </form>,
    )

    expect(screen.getByRole("combobox", { name: "Filial" })).toHaveTextContent("COXIM")
    expect(new FormData(container.querySelector("form")!).get("loja")).toBe("COXIM")
  })

  it("oferece todas as filiais quando não há filtro", () => {
    const { container } = render(
      <form>
        <BranchFilterSelect branches={branches} selectedBranch="" />
      </form>,
    )

    expect(screen.getByRole("combobox", { name: "Filial" })).toHaveTextContent("Todas as filiais")
    expect(new FormData(container.querySelector("form")!).get("loja")).toBe("todas")
  })
})
