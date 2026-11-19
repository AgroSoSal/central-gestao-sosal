import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { ComprasExecutiveDashboard } from "./compras-executive-dashboard"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }))

describe("dashboard de caixa", () => {
  it("exibe metas do ano até a competência e o DDE mensal dos subgrupos da referência", () => {
    const month = "2026-02"
    const references = ["2026-01-01","2026-02-01"].flatMap(date => [
      ...[1,2,3,4].map(i => ({ codigo:`meta_linha_${i}`,valor:100 })),
      ...["AN","BDS","CG","CX","PG","RIO"].map(i => ({ codigo:`meta_loja_${i}`,valor:70 })),
      {codigo:"dre_receita_bruta",valor:date==="2026-02-01"?2000:1000},
      {codigo:"dre_ebitda",valor:date==="2026-02-01"?400:200},
    ].map(row => ({...row,grupo:"metas_linha",dimensao:null,competencia:date,rotulo:row.codigo,
      unidade:"R$",origem_aba:"Metas de Vendas",origem_celula:"D26",versao:"2.3.7" as const,
      situacao:"referencia" as const})))
    const html = renderToStaticMarkup(<ComprasExecutiveDashboard
      month={month} today="2026-02-19" email="master@example.com" referenceRows={references}
      salesRows={[{filial:"CG",loja:"Campo Grande",linha:1,visao:"vendido",vendido_mes:50,custo_mes:0,lucro_mes:0,vendido_ano:200}]}
      shopPositions={[]} stockRows={[]} bankRows={[]} contractedWeeks={[]} contractedMonths={[]}
      recoveryRows={[]} errors={{}} ddePlanRows={[{grupo_subgrupo:"1.LINHA NUTRIÇÃO / A",dde_meta:30,cmv_90d:900,valor_estoque:600}]}
    />)
    expect(html).toContain("Meta acumulada até fevereiro")
    expect(html).toContain("R$ 800")
    expect(html).toContain("DDE plano (subgrupos cobertos)")
    expect(html).toContain("30 d")
    expect(html).toContain("Orçado 2026 · referência da planilha")
    expect(html).toContain("R$ 3.000")
  })

  it("identifica títulos existentes como compromissos e não os chama de saldo final da projeção", () => {
    const today = "2026-11-19"
    const weeks = Array.from({ length: 26 }, (_, i) => {
      const d = new Date("2026-11-19T12:00:00Z")
      d.setUTCDate(d.getUTCDate() + i * 7)
      const e = new Date(d)
      e.setUTCDate(e.getUTCDate() + 6)
      return { inicio: d.toISOString().slice(0,10), fim: e.toISOString().slice(0,10),
        receber_identificado: 50, pagar_identificado: 100, titulos_receber: 1,
        titulos_pagar: 1, ultima_importacao_pagar: "2026-11-19T14:00:00Z" }
    })
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date("2026-11-01T12:00:00Z")
      d.setUTCMonth(d.getUTCMonth() + i)
      return { mes: d.toISOString().slice(0,10), receber_identificado: 100,
        pagar_identificado: 1000, titulos_receber: 1, titulos_pagar: 1,
        saldo_contratado_identificado: -900, ultima_importacao_pagar: "2026-11-19T14:00:00Z" }
    })
    const html = renderToStaticMarkup(<ComprasExecutiveDashboard
      month="2026-11" today={today} email="master@example.com" referenceRows={[]}
      salesRows={[]} shopPositions={[{filial:"BDS",estoque_custo:0,cmv_90d:0,dde_observado:0,
        carteira_aberta:320642006.46,carteira_vencida:320642006.46,percentual_vencido:1}]} stockRows={[]}
      recoveryRows={[
        {filial:"BDS",principal_carteira:4900000,principal_vencido:3500000,principal_recuperavel:2500000,titulos_vencidos:1200,titulos_recuperaveis:710,titulos_sem_principal:0},
        {filial:"CG",principal_carteira:500000,principal_vencido:200000,principal_recuperavel:150000,titulos_vencidos:100,titulos_recuperaveis:70,titulos_sem_principal:0},
        ...["RIO","CX","PG","AN"].map(filial=>({filial,principal_carteira:0,principal_vencido:0,principal_recuperavel:0,titulos_vencidos:0,titulos_recuperaveis:0,titulos_sem_principal:0})),
      ]}
      bankRows={[{ conta_ref:"BDS 1234", filial:"BANDEIRANTES", banco:"PENDENTE_IDENTIFICACAO",
        data_corte_comum:"2026-11-11",data_ultimo_saldo:"2026-11-18",ultimo_saldo:1900,
        data_saldo_base:"2026-11-11",saldo_base:1000,data_arquivo:"2026-11-18",
        diferenca_arquivo:0,conciliado:false }]}
      contractedWeeks={weeks} contractedMonths={months} errors={{}}
      pendingOrdersQuality={{ itens_pendentes:4864, pedidos_pendentes:1200,
        valor_pendente:62563205.79, itens_sem_grupo:1043, valor_sem_grupo:4239210.41,
        itens_sem_previsao:4864, itens_sem_condicao:1140, itens_com_previsao_futura:0,
        data_pedido_mais_antigo:"2025-01-02", ultima_conciliacao:"2026-11-19T14:22:05Z" }}
    />)
    expect(html).toContain("Títulos a receber · 13 semanas")
    expect(html).toContain("Fornecedores a pagar · 13 semanas")
    expect(html).toContain("Títulos a receber · 12 meses")
    expect(html).not.toContain("Saldo final · títulos 12M")
    expect(html).not.toContain("Menor saldo · títulos 12M")
    expect(html).toContain("Menor saldo · Pior caso correto 12M")
    expect(html).toContain("Pedidos pendentes sem previsão validada")
    expect(html).toContain("4.864")
    expect(html).toContain("62.563.206")
    expect(html).toContain("Carteira vencida · valor original")
    expect(html).toContain("3.700.000")
    expect(html).toContain("2.650.000")
    expect(html).not.toContain("320.642.006")
  })
})
