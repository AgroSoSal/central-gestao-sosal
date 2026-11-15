import Link from "next/link"
import { MODULES, isModuleAvailable, type ModuleStatus } from "@/domains/shared/modules"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { BarChart, Building, CreditCard, Package, ShoppingCart, Store } from "lucide-react"

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
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center lg:text-left mb-12">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Central de Gestão <span className="text-primary">Só Sal</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto lg:mx-0">
              Plataforma empresarial modular para gestão integrada. Primeiro módulo:
              Pedidos de Compra. Módulos futuros: Estoque, Financeiro, Comercial,
              S&OP e Diretoria.
            </p>
          </div>

          <section className="grid gap-6 lg:grid-cols-3">
            {MODULES.map((module) => {
              const Icon = ModuleIcons[module.id] ?? Building
              const available = isModuleAvailable(module)
              const statusLabel: Record<ModuleStatus, string> = {
                disponível: "Disponível",
                "em-desenvolvimento": "Em desenvolvimento",
                "em-breve": "Em breve",
              }
              return (
                <Card key={module.id} className="flex flex-col h-full">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{module.label}</CardTitle>
                    <Badge variant={available ? "default" : "secondary"}>
                      {statusLabel[module.status]}
                    </Badge>
                  </CardHeader>
                  <CardDescription className="mt-2 text-sm text-muted-foreground line-clamp-2">
                    Módulo de {module.label.toLowerCase()}.
                    {available
                      ? " Acesso liberado."
                      : module.status === "em-desenvolvimento"
                        ? " Em desenvolvimento."
                        : " Funcionalidade em planejamento."}
                  </CardDescription>
                  <CardContent className="flex-1 pt-0">
                    <div className="flex items-center justify-between mt-auto">
                      <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      {available ? (
                        <Link
                          href={module.path}
                          className="text-sm font-medium transition-colors hover:underline"
                        >
                          Abrir
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">Acompanhar</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </section>

          <Separator className="my-12" />

          <section className="grid gap-6 lg:grid-cols-2">
            <Card className="flex flex-col h-full bg-accent/50 border-accent">
              <CardHeader>
                <CardTitle className="text-lg">Sobre a plataforma</CardTitle>
                <CardDescription>
                  Consulte os pedidos de compra do SISCOM importados para o Supabase.
                  A consulta permite filtrar por filial, fornecedor, pedido, produto e período.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>Histórico de pedidos de compra</li>
                  <li>Filtros por filial e período</li>
                  <li>Acesso com login e autorização de Master</li>
                  <li>Data da última importação na tela de Compras</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="flex flex-col h-full">
              <CardHeader>
                <CardTitle className="text-lg">Recursos de Compras</CardTitle>
                <CardDescription>
                  Consulta de pedidos integrada ao Supabase, com dados das extrações SISCOM.
                  Os demais módulos continuam em planejamento.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
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
