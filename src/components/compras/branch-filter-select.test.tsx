import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { BranchFilterSelect } from "./branch-filter-select"

const branches = ["CAMPO GRANDE", "RIO VERDE", "COXIM"]
afterEach(cleanup)

describe("BranchFilterSelect", () => {
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
