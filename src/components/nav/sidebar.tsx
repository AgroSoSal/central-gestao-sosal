"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ShoppingCart,
  Package,
  CreditCard,
  Store,
  BarChart,
  Building,
  Settings,
  X,
  ChevronsRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { MODULES, isModuleAvailable } from "@/domains/shared/modules"

const Icons: Record<string, React.ElementType> = {
  ShoppingCart,
  Package,
  CreditCard,
  Store,
  BarChart,
  Building,
  Settings,
}

export interface SidebarProps {
  open?: boolean
  onToggle?: () => void
}

export function Sidebar({ open = false, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const isMobileOpen = open

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-30 h-screen border-r border-[#203047] bg-[#09111e] shadow-[20px_0_70px_-45px_rgba(0,0,0,.9)] transition-transform duration-300",
        isMobileOpen ? "translate-x-0 lg:translate-x-0" : "-translate-x-full lg:translate-x-0",
        "w-64 lg:w-64",
      )}
      aria-label="Menu principal de navegação"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 h-[86px] px-5 border-b border-[#1e3049]">
          <button
            onClick={onToggle}
            className="-mr-2 lg:hidden p-1 rounded-md text-muted-foreground hover:bg-accent"
            aria-label="Fechar menu"
            aria-expanded={isMobileOpen}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <Link href="/" onClick={open ? onToggle : undefined} className="group flex flex-1 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-cyan-300" aria-label="Página inicial da Central de Gestão Só Sal">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1 shadow-[0_0_24px_-7px_rgba(34,211,238,.45)] transition-transform duration-300 group-hover:rotate-[-4deg] group-hover:scale-105">
              <Image src="/brand/sosal-logo.png" alt="Só Sal Produtos Agropecuários" width={200} height={200} className="h-full w-full object-contain" />
            </div>
            <div>
              <span className="block text-[17px] font-bold tracking-tight text-white">Só Sal</span>
              <span className="block text-[9px] font-bold uppercase tracking-[.18em] text-cyan-400/80">Central de Gestão</span>
            </div>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-7">
          <p className="mb-4 px-4 text-[10px] font-bold uppercase tracking-[.22em] text-slate-500">Workspace / Módulos</p>
          <nav className="flex flex-col gap-1.5">
            {MODULES.map((module) => {
              const Icon = Icons[module.icon] || Settings
              const available = isModuleAvailable(module)
              const isActive = pathname === module.path || pathname.startsWith(`${module.path}/`)
              if (!available) {
                return (
                  <div
                    key={module.id}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-medium text-slate-500 opacity-50 pointer-events-none cursor-not-allowed"
                  >
                    <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    <span>{module.label}</span>
                  </div>
                )
              }
              return (
                <Link
                  key={module.id}
                  href={module.path}
                  onClick={onToggle}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl border px-4 py-3 text-[13px] font-semibold transition-all duration-300",
                    isActive
                      ? "border-cyan-400/25 bg-gradient-to-r from-cyan-400/15 to-blue-500/5 text-cyan-100 shadow-[inset_3px_0_#22d3ee,0_4px_25px_-15px_#0891b2]"
                      : "border-transparent text-slate-400 hover:border-slate-700 hover:bg-[#132139] hover:text-slate-100",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon
                    className={cn("h-[18px] w-[18px] transition-transform duration-300 group-hover:scale-110", isActive && "text-cyan-300")}
                    aria-hidden="true"
                  />
                  <span>{module.label}</span>
                  {isActive && <ChevronsRight size={15} className="ml-auto text-cyan-400" aria-hidden="true" />}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="border-t border-[#1e3049] p-5">
          <div className="rounded-xl border border-[#243750] bg-[#111d2e] px-4 py-3">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-slate-400"><span className="h-1.5 w-1.5 rounded-full bg-cyan-400" /> Plataforma</p>
            <p className="mt-1.5 text-xs font-semibold text-slate-200">Ambiente corporativo</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

export function MobileBackdrop({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-20 bg-black/70 lg:hidden backdrop-blur-sm"
      onClick={onToggle}
      aria-hidden="true"
    />
  )
}
