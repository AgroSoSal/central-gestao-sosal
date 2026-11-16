import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { LoadingState, MascotAnimation } from "./mascot-loader"

afterEach(cleanup)

describe("Mascot loader", () => {
  it("anuncia o carregamento e exibe o GIF da Só Sal", () => {
    const { container } = render(<LoadingState label="Carregando pedidos" />)

    expect(screen.getByRole("status")).toHaveTextContent("Carregando pedidos")
    expect(container.querySelector("img")).toHaveAttribute("src", "/brand/farm-boi-loading.gif")
  })

  it("permite usar o mascote em botões sem criar outro status", () => {
    const { container } = render(<MascotAnimation compact />)

    expect(container.querySelector("img")).toHaveAttribute("alt", "")
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })
})
