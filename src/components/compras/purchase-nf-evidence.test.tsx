import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PurchaseNfEvidence } from "./purchase-nf-evidence"

const test = vi.hoisted(() => ({
  calls: [] as { name: string; args: Record<string, unknown> }[],
  denied: false,
  generic: false,
}))

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      test.calls.push({ name, args })
      if (test.denied) return { data: null, error: { code: "42501" } }
      if (test.generic) return { data: {
        source:"ZACARINI_238_NF_EVIDENCIAS",status:"codigo_generico",total:0,itens:[],
        descricao:"Código genérico excluído da conciliação de NFs pela planilha.",
      }, error:null }
      return { data: {
        source:"ZACARINI_238_NF_EVIDENCIAS",status:"disponivel",total:1,
        pedido:{ filial_nf:"CG",quantidade:60,quantidade_recebida:0,quantidade_pendente:60,calculado_em:null },
        itens:[{ data:"2026-11-13",nf:"205002",filial:"CG",produto_cod:"4189",
          fornecedor:"J.A AGRONEGOCIOS",operacao:"COMPRA DE MERCADORIA",qtde:60,valor:343.80,dev:false }],
      },error:null }
    },
  }),
}))

afterEach(() => { cleanup(); test.calls.length = 0; test.denied = false; test.generic = false })

describe("evidências fiscais Zacarini 2.3.8", () => {
  it("só consulta ao clicar e não assume vínculo NF-pedido", async () => {
    render(<PurchaseNfEvidence loja="CAMPO GRANDE" pedido="9215" produtoCodigo="4189"/>)
    expect(test.calls).toHaveLength(0)
    expect(screen.queryByText("205002")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Consultar NFs/i }))
    await waitFor(() => expect(screen.getByText("205002")).toBeInTheDocument())
    expect(test.calls).toEqual([{
      name:"fn_compras_evidencias_nf_238",
      args:{p_loja:"CAMPO GRANDE",p_pedido:"9215",p_produto_codigo:"4189",p_pagina:1,p_tamanho:20},
    }])
    expect(screen.getByText("R$ 343,80")).toBeInTheDocument()
    expect(screen.getByText(/Não comprovam vínculo exclusivo/i)).toBeInTheDocument()
    expect(screen.getByText(/Recebida no cálculo:/i)).toBeInTheDocument()
  })

  it("recusa retorno quando Master está ausente e não cria dados fictícios", async () => {
    test.denied = true
    render(<PurchaseNfEvidence loja="SO SAL" pedido="12" produtoCodigo="20"/>)
    fireEvent.click(screen.getByRole("button", { name: /Consultar NFs/i }))
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/exclusiva do perfil Master/i))
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("respeita exclusão dos códigos genéricos H5:H7", async () => {
    test.generic = true
    render(<PurchaseNfEvidence loja="SO SAL" pedido="12" produtoCodigo="545"/>)
    fireEvent.click(screen.getByRole("button", { name: /Consultar NFs/i }))
    await waitFor(() => expect(screen.getByText(/Código genérico excluído/i)).toBeInTheDocument())
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })
})
