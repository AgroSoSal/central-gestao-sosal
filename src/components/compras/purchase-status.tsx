type Props = { status: string | null }

/** Nunca transforma ausência de conciliação em "Em aberto". */
export function PurchaseStatus({ status }: Props) {
  const label = status || "Não conciliado"
  const tone = status === "Já chegou – conferir/baixar"
    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
    : status === "Chegada parcial"
      ? "border-amber-400/25 bg-amber-400/10 text-amber-200"
      : status === "Em aberto"
        ? "border-rose-400/25 bg-rose-400/10 text-rose-200"
        : "border-slate-400/20 bg-slate-400/10 text-slate-300"

  return <span className={`inline-flex max-w-52 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold leading-snug ${tone}`}>{label}</span>
}
