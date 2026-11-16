import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mock = vi.hoisted(() => ({
  failSecond: false,
  arrival: "2026-11-20",
  pageCalls: [] as number[],
}))

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    rpc: async (name: string, params: { p_pagina?: number; p_tamanho?: number }) => {
      if (name === "fn_listar_pedidos_compra_conciliados") {
        const page = params.p_pagina ?? 1
        mock.pageCalls.push(page)
        if (mock.failSecond && page === 2) return { data: null, error: { message: "falha" } }
        const size = page === 1 ? 100 : 2
        return { data: Array.from({ length: size }, (_, index) => ({
          importacao_id: 100,
          linha_excel: (page - 1) * 100 + index + 1,
          loja: "SO SAL", pedido: String((page - 1) * 100 + index + 1),
          produto_codigo: "1234", data_pedido: "2026-11-10", condicao_pagamento: "30",
          quantidade_pendente: 1, valor_pendente: 10, total_itens: 102,
        })), error: null }
      }
      if (name === "fn_listar_decisoes_compra") return { data: [], error: null }
      if (name === "fn_listar_followup_compras") return { data: [{ loja: "SO SAL", pedido: "1", produto_codigo: "1234", previsao_entrega: mock.arrival }], error: null }
      throw new Error(`RPC desconhecida ${name}`)
    },
  }),
}))

const props = { filters: { busca: "", loja: "", inicio: "", fim: "" }, dataBase: "2026-11-16", genericCodes: [] as string[], expectedTotal: 102, viewerId: "test-0" }
let viewerCounter = 0

beforeEach(() => { mock.failSecond = false; mock.arrival = "2026-11-20"; mock.pageCalls = []; props.viewerId = `test-${++viewerCounter}` })
afterEach(cleanup)

describe("resumo financeiro integral no cliente autenticado", () => {
  it("consulta todas as páginas, ultrapassa o lote de 50 e só então divulga totais consolidados", async () => {
    const { GlobalPaymentForecast } = await import("./global-payment-forecast")
    render(<GlobalPaymentForecast {...props} />)
    expect(screen.getByRole("status")).toHaveTextContent(/consolidando/i)
    await waitFor(() => expect(screen.getByText("102 de 102 itens conciliados")).toBeInTheDocument())
    const summary = screen.getByRole("group", { name: /Indicadores financeiros globais/i })
    expect(within(summary).getByText(/R\$\s*1\.020,00/)).toBeInTheDocument()
    expect(mock.pageCalls.sort()).toEqual([1, 2])
    expect(screen.getByText("Carteira completa · sem lote omitido")).toBeInTheDocument()
  })

  it("não mostra parcial como valor global quando alguma página falha e oferece recálculo", async () => {
    mock.failSecond = true
    const { GlobalPaymentForecast } = await import("./global-payment-forecast")
    render(<GlobalPaymentForecast {...props} />)
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Não foi possível consolidar/i))
    expect(screen.queryByRole("group", { name: /Indicadores financeiros globais/i })).not.toBeInTheDocument()
    mock.failSecond = false
    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }))
    await waitFor(() => expect(screen.getByText("102 de 102 itens conciliados")).toBeInTheDocument())
  })

  it("permite recálculo após alteração de previsão de entrega no Follow-up", async () => {
    const { GlobalPaymentForecast } = await import("./global-payment-forecast")
    render(<GlobalPaymentForecast {...props} />)
    await waitFor(() => expect(screen.getByText("102 de 102 itens conciliados")).toBeInTheDocument())
    mock.arrival = "2027-05-01"
    fireEvent.click(screen.getByRole("button", { name: /Recalcular carteira/i }))
    await waitFor(() => expect(screen.getByText(/102 de 102 itens conciliados/i)).toBeInTheDocument())
    const summary = screen.getByRole("group", { name: /Indicadores financeiros globais/i })
    expect(within(summary).getByText(/R\$\s*1\.010,00/)).toBeInTheDocument()
  })

  it("preserva o resumo por poucos minutos quando muda só a página detalhada", async () => {
    const { GlobalPaymentForecast } = await import("./global-payment-forecast")
    const first = render(<GlobalPaymentForecast {...props} />)
    await waitFor(() => expect(screen.getByText("102 de 102 itens conciliados")).toBeInTheDocument())
    expect(mock.pageCalls).toHaveLength(2)
    first.unmount()
    render(<GlobalPaymentForecast {...props} />)
    await waitFor(() => expect(screen.getByText("102 de 102 itens conciliados")).toBeInTheDocument())
    expect(mock.pageCalls).toHaveLength(2)
  })
})
