"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, User, Command } from "lucide-react"
import { cn } from "@/lib/utils"
import { MODULES, isModuleAvailable } from "@/domains/shared/modules"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet"

export interface HeaderProps {
  mobileOpen: boolean
  onToggleMobile: () => void
}

export function Header({ mobileOpen, onToggleMobile }: HeaderProps) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-10 flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-[#21324b] bg-[#0a1220]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-9">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleMobile}
          className="-ml-1 flex h-8 items-center rounded-md text-muted-foreground lg:hidden"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Fechar menu" : "Abrir menu de navegação"}
        >
          <span className="sr-only">
            {mobileOpen ? "Fechar menu de navegação" : "Abrir menu de navegação"}
          </span>
          {mobileOpen ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <MenuIcon className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
        <Link href="/" className="flex items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-cyan-300 lg:hidden" aria-label="Página inicial Só Sal">
          <span className="flex size-9 items-center justify-center overflow-hidden rounded-lg bg-white p-0.5">
            <Image src="/brand/sosal-logo.png" alt="" width={200} height={200} className="size-full object-contain" />
          </span>
          <span className="hidden text-xs font-bold text-slate-100 sm:inline">Só Sal</span>
        </Link>
        <div className="mr-5 hidden items-center gap-2 border-r border-slate-700/50 pr-5 text-xs font-semibold text-slate-400 xl:flex"><Command size={15} className="text-cyan-400" /> Workspace</div>
        <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
          {MODULES.filter((m) => ["compras", "estoque", "financeiro", "comercial"].includes(m.id)).map((m) => {
            const available = isModuleAvailable(m)
            const isActive = pathname === m.path
            if (!available) {
              return (
                <span
                  key={m.id}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 opacity-60 pointer-events-none cursor-not-allowed"
                >
                  {m.label}
                </span>
              )
            }
            return (
              <Link
                key={m.id}
                href={m.path}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                  isActive ? "bg-cyan-400/10 text-cyan-300" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {m.label}
              </Link>
            )
          })}
        </nav>
      </div>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-full border border-[#25435a] bg-cyan-400/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-cyan-300 sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-cyan-400" /> ERP Web</span>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="relative border-[#2a3c54] bg-[#132036] text-slate-300 hover:bg-[#1a3049]">
                <span className="sr-only">Notificações</span>
                <Bell className="h-5 w-5" aria-label="Notificações" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-64" side="right">
              <SheetHeader>
                <SheetTitle>Notificações</SheetTitle>
              </SheetHeader>
              <div className="p-4">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Hoje
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger className="w-full">...</DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem>Sem notificações novas</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </SheetContent>
          </Sheet>

          <div className="hidden lg:flex items-center gap-2 rounded-lg border border-[#2b3f59] bg-[#152239] px-3 py-2 text-slate-300">
            <User className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs font-medium">Usuário</span>
          </div>
        </div>
    </header>
  )
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function X({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
