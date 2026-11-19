import Link from "next/link"
import { ArrowUpRight, CheckCircle2, CircleAlert, Clock3 } from "lucide-react"

type Coverage = {
  title: string
  workbook: string
  state: "operacional" | "parcial" | "pendente"
  details: string
  href?: string
  action?: string
}

/** Auditoria funcional da Gestão Zacarini 2.3.7. Status de implementação, não de saúde da conexão. */
const coverage: readonly Coverage[] = [
  { title: "Dashboard de Compras", workbook: "Dashboard", state: "parcial", details: "Sete blocos replicados: metas de vendas por linha/loja, margem operacional, DDE, carteira, bancos, DRE e tendências. Fluxo projetado e DRE oficial aguardam premissas homologadas.", href: "/compras/dashboard", action: "Abrir dashboard" },
  { title: "Pedidos de compra", workbook: "Pedidos de Compra", state: "operacional", details: "Consulta, NFs recebidas, saldo e filtros por filial, fornecedor, produto e data.", href: "/compras", action: "Consultar pedidos" },
  { title: "Gerenciamento e decisão", workbook: "Pedidos de Compra · AP/AQ", state: "operacional", details: "Aprovar, segurar, cancelar e registrar observações com histórico de decisões.", href: "/compras/gerenciar", action: "Gerenciar pedidos" },
  { title: "Follow-up de entregas", workbook: "Pedidos de Compra · entregas", state: "operacional", details: "Previsão, cobrança, situação logística e rastreio em pedidos aprovados e pendentes.", href: "/compras/follow-up", action: "Acompanhar entregas" },
  { title: "Previsão de parcelas", workbook: "Pedidos de Compra · P:AL", state: "parcial", details: "Simulação de 26 semanas; falta integrar títulos reais e classificação completa ao caixa.", href: "/compras/previsao", action: "Consultar previsão" },
  { title: "Atendimento ao fornecedor", workbook: "Atendimento Fornecedor", state: "parcial", details: "Catálogo, quantidade sugerida, descontos, rateio, parcelas e rascunho. Não emite pedido no SISCOM.", href: "/compras/atendimento", action: "Abrir negociação" },
  { title: "Despesas e investimentos", workbook: "Cad_Despesas · Atendimento", state: "parcial", details: "Catálogo e rascunhos cadastrados; ainda sem liberação do orçamento ou emissão.", href: "/compras/atendimento", action: "Ver despesas" },
  { title: "OTB por subgrupo", workbook: "Painel OTB · OTB", state: "parcial", details: "Estoque, CMV e DDE observado conectados. Teto de caixa e verba liberada pendentes de cenário financeiro homologado.", href: "/compras/otb", action: "Ver posição operacional do OTB" },
  { title: "Verba do comprador", workbook: "Verba Comprador", state: "parcial", details: "OTB!R24 usa 90%/10%; proteção por DDE e corte testados; sem saldo financeiro oficial por linha.", href: "/compras/otb", action: "Conferir OTB" },
  { title: "Plano de estoque", workbook: "Plano de Estoque", state: "parcial", details: "Painel de seis meses com 56 metas versionadas, estoque e CMV a custo reais. Faltam conciliar divergências literais de nomes, previsões e aprovar alçadas.", href: "/compras/plano-estoque", action: "Abrir plano mensal" },
  { title: "Projeção financeira 12M", workbook: "Projeção 12M · Premissas 12M", state: "pendente", details: "Modelo matemático conferido; faltam cenários futuros, obrigações reconciliadas e homologação. Atualizar extratos ajuda, mas não basta." },
  { title: "Produção própria", workbook: "Produção Própria", state: "parcial", details: "Catálogo real SO SAL e calculadora de industrialização por kg/un e R$/t. Peso, frete e preço final aguardam cadastro homologado.", href: "/compras/producao-propria", action: "Simular fabricação" },
  { title: "Estoque parado", workbook: "Estoque Parado · Liq_Rede", state: "parcial", details: "Radar da rede por SKU, sem giro e excesso com estimativa sazonal. Marcadores internos de comparabilidade do Excel ainda não têm fonte equivalente.", href: "/compras/estoque-parado", action: "Ver estoque parado" },
  { title: "Liquidação por filial", workbook: "Liquidação Lojas · Liq_Base", state: "parcial", details: "Excesso e sem giro por SKU/filial, comparação de posições e navegação entre lojas. Transferências não são efetivadas.", href: "/compras/liquidacao-lojas", action: "Consultar filiais" },
  { title: "Liquidação por linha", workbook: "Liquidação Linhas", state: "parcial", details: "Ranking de valor parado por produto/linha com filtros gerenciais; responsáveis e metas de transferência aguardam cadastro.", href: "/compras/liquidacao-linhas", action: "Consultar por linha" },
]

const badge = {
  operacional: { label: "Disponível", Icon: CheckCircle2, classes: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200" },
  parcial: { label: "Parcial", Icon: CircleAlert, classes: "border-amber-300/20 bg-amber-400/10 text-amber-200" },
  pendente: { label: "Integração pendente", Icon: Clock3, classes: "border-slate-400/20 bg-slate-300/5 text-slate-300" },
} as const

export function PurchaseModuleMap() {
  return <section aria-label="Cobertura da planilha Zacarini" className="space-y-5">
    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[.06] p-5 text-sm leading-6 text-slate-300">
      <p className="font-bold text-cyan-100">Referência: Gestão Zacarini 2.3.7</p>
      <p className="mt-1">Conferência das funções de Compras com as abas da planilha. Os cálculos usam dados operacionais do Supabase, nunca números históricos importados do Excel. O status abaixo indica a cobertura implementada, não a disponibilidade momentânea de cada consulta.</p>
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {coverage.map((entry) => {
        const state = badge[entry.state]
        return <article key={entry.title} className="erp-surface flex flex-col rounded-2xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${state.classes}`}><state.Icon size={13} /> {state.label}</span>
          </div>
          <h3 className="mt-4 text-base font-bold text-white">{entry.title}</h3>
          <p className="mt-1 text-[11px] text-cyan-300">Planilha: {entry.workbook}</p>
          <p className="mt-3 flex-1 text-xs leading-6 text-slate-400">{entry.details}</p>
          {entry.href && entry.action && <Link href={entry.href} className="mt-5 inline-flex items-center gap-1.5 self-start text-xs font-bold text-cyan-200 hover:text-cyan-100">{entry.action} <ArrowUpRight size={14} /></Link>}
        </article>
      })}
    </div>
  </section>
}
