"use client"

import { useEffect, useState } from "react"

const integerFormatter = new Intl.NumberFormat("pt-BR")
const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

type Props = { value: number; format: "integer" | "currency" }

export function AnimatedMetricValue({ value, format }: Props) {
  // O valor correto é exibido no SSR e para usuários com movimento reduzido.
  const [visibleValue, setVisibleValue] = useState(value)

  useEffect(() => {
    let frame = 0
    if (!Number.isFinite(value) || value === 0 || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      frame = requestAnimationFrame(() => setVisibleValue(value))
      return () => cancelAnimationFrame(frame)
    }

    let start: number | null = null
    const duration = 950

    function tick(time: number) {
      if (start === null) start = time
      const progress = Math.min((time - start) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setVisibleValue(value * ease)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  const formatted = format === "currency"
    ? currencyFormatter.format(visibleValue)
    : integerFormatter.format(Math.round(visibleValue))

  return <span className="tabular-nums" aria-label={format === "currency" ? currencyFormatter.format(value) : integerFormatter.format(value)}>{formatted}</span>
}
