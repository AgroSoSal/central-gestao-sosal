import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import Home from "./page"
import { MODULES } from "@/domains/shared/modules"

afterEach(cleanup)

describe("Workspace Só Sal", () => {
  it("destaca a identidade oficial da Só Sal no banner principal", () => {
    const { container } = render(<Home />)

    expect(screen.getByRole("img", { name: /só sal produtos agropecuários/i })).toBeVisible()
    expect(screen.getByRole("heading", { level: 1, name: /central de gestão só sal/i })).toBeVisible()
    expect(container.querySelector(".sosal-hero-watermark img")).toHaveAttribute("src", expect.stringContaining("sosal-logo.png"))
    expect(container.querySelector(".sosal-brand-stage")).toBeNull()
    expect(container.querySelector('img[src*="sosal-mascot"]')).toBeNull()
  })

  it("mantém todos os módulos e inclui uma assinatura visual da marca em cada card", () => {
    const { container } = render(<Home />)
    const cards = container.querySelectorAll(".erp-metric")

    expect(cards).toHaveLength(MODULES.length)
    for (const [index, card] of Array.from(cards).entries()) {
      expect(within(card as HTMLElement).getByText(MODULES[index].label)).toBeVisible()
      expect(card.querySelector('img[src*="sosal-logo.png"]')).not.toBeNull()
      expect(card.querySelector('img[src*="sosal-mascot.png"]')).toBeNull()
    }
    expect(screen.getByRole("link", { name: /abrir/i })).toHaveAttribute("href", "/compras")
  })
})
