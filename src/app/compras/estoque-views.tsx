import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"
import { AlertTriangle } from "lucide-react"
import { ComprasLogin } from "@/components/compras/compras-auth"
import { LoadingState } from "@/components/shared/mascot-loader"
import { StockLiquidationDashboard, type StockLiquidationFilters, type StockLiquidationRow } from "@/components/compras/stock-liquidation-dashboard"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type SearchParams = Record<string, string | string[] | undefined>
type Variant = "parado" | "lojas" | "linhas"
const branches = ["BDS","CG","RIO","CX","PG","AN"]
const situations = ["todos","sem_giro","excesso","regular","excluido"]
function first(value: string | string[] | undefined) { return typeof value === "string" ? value : Array.isArray(value) ? value[0] ?? "" : "" }
export function parseStockFilters(params: SearchParams, variant: Variant): StockLiquidationFilters {
  const linha = first(params.linha)
  const situacao = first(params.situacao)
  const dde = Number(first(params.dde))
  const pagina = Number(first(params.pagina))
  return {
    busca: first(params.busca).trim().slice(0,80),
    filial: variant === "lojas" && branches.includes(first(params.filial)) ? first(params.filial) : "",
    linha: ["0","1","2","3","4"].includes(linha) ? linha : "",
    situacao: situations.includes(situacao) ? situacao : "todos",
    dde: Number.isInteger(dde) && dde >= 1 && dde <= 365 ? dde : 60,
    pagina: Number.isInteger(pagina) && pagina >= 1 && pagina <= 500 ? pagina : 1,
  }
}

export function StockView({ variant, searchParams }: { variant: Variant; searchParams: Promise<SearchParams> }) {
  return <Suspense fallback={<LoadingState label="Analisando giro e estoque..."/>}><Content variant={variant} searchParams={searchParams}/></Suspense>
}

async function Content({ variant, searchParams }: { variant: Variant; searchParams: Promise<SearchParams> }) {
  await connection()
  const supabase = await createSupabaseServerClient()
  if (!supabase) return <ComprasLogin configured={false}/>
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return <ComprasLogin configured/>
  const { error: authz } = await supabase.rpc("fn_listar_decisoes_compra", { p_chaves: [] })
  if (authz) return <main role="alert" className="mx-auto max-w-xl rounded-2xl border border-amber-400/30 bg-amber-400/10 p-7 text-amber-100"><AlertTriangle/><h1 className="mt-4 font-bold">Acesso restrito ao Master ativo</h1><p>Não foi possível validar seu perfil de compras.</p><Link href="/compras" className="mt-4 inline-block text-cyan-300">Voltar</Link></main>

  const filters = parseStockFilters(await searchParams, variant)
  const { data, error } = await supabase.rpc("fn_compras_liquidacao_237", {
    p_escopo: variant === "lojas" ? "lojas" : "rede",
    p_filial: filters.filial || null,
    p_linha: filters.linha ? Number(filters.linha) : null,
    p_busca: filters.busca || null,
    p_situacao: filters.situacao,
    p_dde_limite: filters.dde,
    p_pagina: filters.pagina,
    p_tamanho: 40,
  })
  return <StockLiquidationDashboard variant={variant} rows={error ? [] : (data ?? []) as StockLiquidationRow[]} error={error?.code ?? null} filters={filters}/>
}
