import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Sidebar } from "./sidebar"

vi.mock("next/navigation", () => ({ usePathname: () => "/" }))
afterEach(cleanup)

describe("Navegação da Só Sal", () => {
  it("exibe a marca oficial no menu persistente", () => {
    render(<Sidebar />)
    expect(screen.getByRole("img", { name: /só sal produtos agropecuários/i })).toBeVisible()
  })
})
