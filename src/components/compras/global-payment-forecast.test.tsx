import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mock = vi.hoisted(() => ({
  failSecond: false,
  specialTerms: false,
  arrival: "2026-11-20",
  pageCalls: [] as number[],
  keyCalls: [] as { name: string; size: number }[],
  classifications: {} as Record<string, string | null>,
}))

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    rpc: async (name: string, params: { p_pagina?: number; p_tamanho?: number; p_chaves?: { loja: string; pedido: string; produto_codigo: string }[]; p_loja?: string; p_pedido?: string; p_produto_codigo?: string; p_grupo_subgrupo?: string }) => {
      if (name === "fn_listar_pedidos_compra_conciliados") {
        const page = params.p_pagina ?? 1
        mock.pageCalls.push(page)
        if (mock.failSecond && page === 2) return { data: null, error: { message: "falha" } }
        const size = page === 1 ? 100 : 2
        return { data: Array.from({ length: size }, (_, index) => ({
          importacao_id: 100,
          linha_excel: (page - 1) * 100 + index + 1,
          loja: "SO SAL", pedido: String((page - 1) * 100 + index + 1),
          fornecedor_nome: "FORNECEDOR XYZ", produto_codigo: "1234", data_pedido: "2026-11-10",
          condicao_pagamento: mock.specialTerms && page === 1 && index === 0 ? null
            : mock.specialTerms && page === 2 && index === 0 ? "6x"
              : mock.specialTerms && page === 2 && index === 1 ? "CARTÃO" : "30",
          quantidade_pendente: 1, valor_pendente: 10, total_itens: 102,
        })), error: null }
      }
      if (name === "fn_registrar_classificacao_compra") {
        mock.classifications[params.p_pedido ?? ""] = params.p_grupo_subgrupo ?? null
        return { data: null, error: null }
      }
      if (name === "fn_listar_decisoes_compra" || name === "fn_listar_followup_compras" || name === "fn_listar_classificacao_compras") {
        const rows = params.p_chaves ?? []
        mock.keyCalls.push({ name, size: rows.length })
        if (rows.length > (name === "fn_listar_classificacao_compras" ? 100 : 50)) return { data: null, error: { message: "máximo de chaves excedido" } }
        if (name === "fn_listar_decisoes_compra") return { data: [], error: null }
        if (name === "fn_listar_followup_compras") return { data: rows.filter((row) => row.pedido === "1").map((row) => ({ ...row, previsao_entrega: mock.arrival })), error: null }
        return { data: rows.map((row) => ({ ...row, grupo_subgrupo: mock.classifications[row.pedido] ?? "1.MERCADORIAS", origem: mock.classifications[row.pedido] ? "manual" : "cadastro" })), error: null }
      }
      throw new Error(`RPC desconhecida ${name}`)
    },
  }),
}))

const props = { filters: { busca: "", loja: "", inicio: "", fim: "" }, dataBase: "2026-11-16", genericCodes: [] as string[], expectedTotal: 102, viewerId: "test-0" }
let viewerCounter = 0

beforeEach(() => { mock.failSecond = false; mock.specialTerms = false; mock.arrival = "2026-11-20"; mock.pageCalls = []; mock.keyCalls = []; mock.classifications = {}; props.viewerId = `test-${++viewerCounter}` })
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
    expect(mock.keyCalls.filter((call) => call.name === "fn_listar_decisoes_compra").map((call) => call.size).sort((a, b) => a - b)).toEqual([2, 50, 50])
    expect(mock.keyCalls.filter((call) => call.name === "fn_listar_followup_compras").map((call) => call.size).sort((a, b) => a - b)).toEqual([2, 50, 50])
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

  it("exibe condições ambíguas de páginas posteriores em uma tabela de auditoria, sem somá-las ao vencimento", async () => {
    mock.specialTerms = true
    const { GlobalPaymentForecast } = await import("./global-payment-forecast")
    render(<GlobalPaymentForecast {...props} />)
    await waitFor(() => expect(screen.getByText("102 de 102 itens conciliados")).toBeInTheDocument())
    const exceptions = screen.getByRole("region", { name: /Condições de pagamento a conferir/i })
    expect(within(exceptions).getByText("6x")).toBeInTheDocument()
    expect(within(exceptions).getByText("#101")).toBeInTheDocument()
    expect(within(exceptions).getByText("FORNECEDOR XYZ")).toBeInTheDocument()
    expect(within(exceptions).getAllByText(/R\$\s*10,00/)).toHaveLength(2)
    expect(screen.getByText(/2 item\(ns\) com prazo padrão de 30 dias/i)).toBeInTheDocument()
    const summary = screen.getByRole("group", { name: /Indicadores financeiros globais/i })
    expect(within(summary).getByText(/R\$\s*1\.010,00/)).toBeInTheDocument()
  })

  it("abre janela central para classificar item sem grupo 5 e refaz os valores elegíveis", async () => {
    mock.classifications["1"] = ""
    const { GlobalPaymentForecast } = await import("./global-payment-forecast")
    render(<GlobalPaymentForecast {...props} />)
    await waitFor(() => expect(screen.getByText("102 de 102 itens conciliados")).toBeInTheDocument())
    expect(screen.getByText(/1 item\(ns\) sem classificação/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Classificar pedido #1/i }))
    const modal = screen.getByRole("dialog", { name: /classificação financeira/i })
    fireEvent.change(within(modal).getByLabelText(/Grupo\/subgrupo/i), { target: { value: "5.DESPESAS / LOGISTICA / FRETE" } })
    fireEvent.change(within(modal).getByLabelText(/Motivo/i), { target: { value: "Despesa de frete confirmada pelo comprador" } })
    fireEvent.click(within(modal).getByRole("button", { name: /Salvar classificação/i }))
    await waitFor(() => expect(mock.classifications["1"]).toBe("5.DESPESAS / LOGISTICA / FRETE"))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByText("Despesas e investimentos (5 e 6)").parentElement).toHaveTextContent(/R\$\s*10,00/))
  })
})
