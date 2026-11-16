import Link from "next/link"
import Image from "next/image"
import { MODULES, isModuleAvailable, type ModuleStatus } from "@/domains/shared/modules"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowUpRight, BarChart, Building, CreditCard, Layers3, Package, ShieldCheck, ShoppingCart, Sparkles, Store } from "lucide-react"

const ModuleIcons: Record<string, React.ElementType> = {
  compras: ShoppingCart,
  estoque: Package,
  financeiro: CreditCard,
  comercial: Store,
  sop: BarChart,
  diretoria: Building,
  administracao: Building,
}

export default function Home() {
  return (
    <div className="flex flex-col flex-1">
      <div className="mx-auto w-full max-w-7xl py-5 sm:py-8">
          <div className="sosal-hero erp-reveal relative isolate mb-9 flex min-h-[315px] items-center overflow-hidden rounded-[28px] border border-cyan-400/15 bg-[#0a1828] px-6 py-10 shadow-[0_20px_80px_-50px_rgba(7,138,176,.4)] sm:px-9 sm:py-12">
            <div className="erp-glow pointer-events-none absolute -right-10 -top-20 h-72 w-72 rounded-full bg-cyan-500/15 blur-[65px]" aria-hidden="true" />
            <div className="relative z-10 grid w-full items-center gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(180px,230px)] lg:grid-cols-[minmax(0,1fr)_minmax(240px,300px)]">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.16em] text-cyan-300"><Sparkles size={13} /> Workspace empresarial</span>
                <h1 className="sosal-hero-title mt-6 max-w-[640px] text-3xl font-bold tracking-[-.045em] text-white sm:text-[44px]">
                  Central de Gestão <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">Só Sal</span>
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                  Inteligência e operação conectadas em um único ambiente. Acompanhe os módulos da plataforma e acesse suas ferramentas de gestão.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-4 text-xs text-slate-400"><span className="inline-flex items-center gap-2"><Layers3 size={14} className="text-cyan-400" /> Plataforma modular</span><span className="inline-flex items-center gap-2"><ShieldCheck size={14} className="text-emerald-400" /> Acesso protegido em Compras</span></div>
              </div>
              <div className="sosal-hero-mascot relative mx-auto h-[215px] w-[215px] sm:h-[240px] sm:w-[230px] lg:h-[270px] lg:w-[280px]">
                <Image src="/brand/sosal-mascot.png" alt="Mascote Só Sal" fill sizes="(max-width: 640px) 215px, (max-width: 1024px) 230px, 280px" className="object-contain object-bottom drop-shadow-[0_22px_28px_rgba(0,0,0,.42)]" priority />
              </div>
            </div>
          </div>

          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-cyan-400">Navegação principal</p>
              <h2 className="text-xl font-semibold tracking-tight text-white">Módulos da plataforma</h2>
            </div>
            <span className="text-xs text-slate-500">Gestão integrada</span>
          </div>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((module, index) => {
              const Icon = ModuleIcons[module.id] ?? Building
              const available = isModuleAvailable(module)
              const statusLabel: Record<ModuleStatus, string> = {
                disponível: "Disponível",
                "em-desenvolvimento": "Em desenvolvimento",
                "em-breve": "Em breve",
              }
              return (
                <Card key={module.id} className="sosal-module-card erp-surface erp-metric erp-reveal relative isolate flex h-full min-h-[202px] flex-col overflow-hidden rounded-2xl p-1"
                  style={{ "--reveal-delay": `${index * 75}ms` } as React.CSSProperties}>
                  <span className="sosal-module-art pointer-events-none absolute -bottom-7 -right-5 z-0 block h-36 w-36" aria-hidden="true">
                    <Image src="/brand/sosal-logo.png" alt="" fill sizes="144px" className="object-contain" />
                  </span>
                  <CardHeader className="relative z-10 flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-base font-semibold text-white">{module.label}</CardTitle>
                    <Badge variant={available ? "default" : "secondary"}>
                      {statusLabel[module.status]}
                    </Badge>
                  </CardHeader>
                  <CardDescription className="relative z-10 mt-2 min-h-16 line-clamp-3 text-sm leading-6 text-slate-400">
                    Módulo de {module.label.toLowerCase()}.
                    {available
                      ? " Acesso liberado."
                      : module.status === "em-desenvolvimento"
                        ? " Em desenvolvimento."
                        : " Funcionalidade em planejamento."}
                  </CardDescription>
                  <CardContent className="relative z-10 flex-1 pt-0">
                    <div className="mt-auto flex items-center justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/10 bg-cyan-400/10"><Icon className="h-5 w-5 text-cyan-300" aria-hidden="true" /></span>
                      {available ? (
                        <Link
                          href={module.path}
                          className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-300 transition-colors hover:text-cyan-100"
                        >
                          Abrir <ArrowUpRight size={14} />
                        </Link>
                      ) : (
                        <span className="text-xs font-medium text-slate-500">Em preparação</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </section>

          <Separator className="my-9 bg-[#25354e]" />

          <section className="grid gap-6 lg:grid-cols-2">
            <Card className="erp-surface relative flex h-full flex-col overflow-hidden rounded-2xl">
              <CardHeader className="relative z-10">
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5">
                    <Image src="/brand/sosal-logo.png" alt="" width={200} height={200} className="size-full object-contain" />
                  </span>
                  <CardTitle className="text-lg">Sobre a plataforma</CardTitle>
                </div>
                <CardDescription>
                  Consulte os pedidos de compra do SISCOM importados para o Supabase.
                  A consulta permite filtrar por filial, fornecedor, pedido, produto e período.
                </CardDescription>
              </CardHeader>
              <CardContent className="relative z-10 pt-0">
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>Histórico de pedidos de compra</li>
                  <li>Filtros por filial e período</li>
                  <li>Acesso com login e autorização de Master</li>
                  <li>Data da última importação na tela de Compras</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="erp-surface relative flex h-full flex-col overflow-hidden rounded-2xl">
              <Image src="/brand/sosal-logo.png" alt="" width={200} height={200} className="pointer-events-none absolute -bottom-8 -right-8 w-40 opacity-[.07]" />
              <CardHeader className="relative z-10">
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300"><ShoppingCart size={21}/></span>
                  <CardTitle className="text-lg">Recursos de Compras</CardTitle>
                </div>
                <CardDescription>
                  Consulta de pedidos integrada ao Supabase, com dados das extrações SISCOM.
                  Os demais módulos continuam em planejamento.
                </CardDescription>
              </CardHeader>
              <CardContent className="relative z-10 pt-0">
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
                    Consulta de pedidos no Supabase
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
                    Filtros e paginação de pedidos
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
                    Login com Supabase Auth
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
                    Dados SISCOM importados via RPA
                  </li>
                </ul>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
  )
}
