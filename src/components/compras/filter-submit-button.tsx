"use client"

import { useFormStatus } from "react-dom"
import { ArrowRight } from "lucide-react"
import { MascotAnimation } from "@/components/shared/mascot-loader"

export function FilterSubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 text-sm font-semibold text-white shadow-[0_8px_24px_-10px_rgba(34,211,238,.7)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-8px_rgba(34,211,238,.65)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? <><MascotAnimation compact /> Consultando...</> : <>Aplicar <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" /></>}
    </button>
  )
}
