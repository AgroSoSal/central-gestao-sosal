import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { PurchaseStatus } from "./purchase-status"

describe("PurchaseStatus", () => {
  it("apresenta as três classificações calculadas no banco", () => {
    const { rerender } = render(<PurchaseStatus status="Em aberto" />)
    expect(screen.getByText("Em aberto")).toBeInTheDocument()
    rerender(<PurchaseStatus status="Chegada parcial" />)
    expect(screen.getByText("Chegada parcial")).toBeInTheDocument()
    rerender(<PurchaseStatus status="Já chegou – conferir/baixar" />)
    expect(screen.getByText("Já chegou – conferir/baixar")).toBeInTheDocument()
  })

  it("nunca interpreta uma conciliação indisponível como pedido em aberto", () => {
    render(<PurchaseStatus status={null} />)
    expect(screen.getByText("Não conciliado")).toBeInTheDocument()
    expect(screen.queryByText("Em aberto")).not.toBeInTheDocument()
  })
})
