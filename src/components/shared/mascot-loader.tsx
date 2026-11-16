import Image from "next/image"
import { cn } from "@/lib/utils"

const mascotPath = "/brand/farm-boi-loading.gif"

/** Mantém a animação original do GIF e enquadra o mascote sem alterar seus frames. */
export function MascotAnimation({ compact = false }: { compact?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-block shrink-0 overflow-hidden",
        compact ? "h-7 w-7" : "h-36 w-28",
      )}
    >
      <Image
        src={mascotPath}
        alt=""
        aria-hidden="true"
        width={480}
        height={480}
        unoptimized
        className="absolute left-1/2 top-1/2 h-auto w-[190%] max-w-none -translate-x-1/2 -translate-y-1/2"
      />
    </span>
  )
}

export function LoadingState({ label = "Carregando...", className }: {
  label?: string
  className?: string
}) {
  return (
    <div role="status" aria-live="polite" className={cn("flex min-h-[48vh] items-center justify-center px-4 py-12", className)}>
      <div className="erp-surface erp-reveal relative flex w-full max-w-[300px] flex-col items-center overflow-hidden rounded-3xl px-6 py-7 text-center">
        <div className="erp-glow pointer-events-none absolute -top-12 h-36 w-36 rounded-full bg-cyan-400/15 blur-[45px]" />
        <MascotAnimation />
        <p className="relative mt-2 text-sm font-semibold text-slate-100">{label}</p>
        <p className="relative mt-1 text-[10px] font-semibold uppercase tracking-[.2em] text-cyan-300/70">Só Sal · Gestão</p>
        <span className="mt-5 h-1 w-32 overflow-hidden rounded-full bg-slate-700/50" aria-hidden="true">
          <span className="block h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 motion-reduce:animate-none" />
        </span>
      </div>
    </div>
  )
}
