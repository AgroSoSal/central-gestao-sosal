/** Campos financeiros identificados; ainda não substituem a Projeção 12M completa. */
export type OtbPremises = {
  forecastStart: string
  openingCash: number
  cashBuffer: number
  notes: string
}

function amount(raw: string, field: string, nonnegative: boolean): number {
  const value = raw.trim()
  // Permite valores sem separador de milhar, nas convenções 1000.50 ou 1000,50.
  if (!/^-?\d+(?:[.,]\d{1,2})?$/.test(value)) throw new RangeError(`${field}: informe um valor monetário válido.`)
  const parsed = Number(value.replace(",", "."))
  if (!Number.isFinite(parsed) || Math.abs(parsed) > 1_000_000_000_000 || (nonnegative && parsed < 0)) {
    throw new RangeError(`${field}: valor fora do intervalo permitido.`)
  }
  return parsed
}

export function validateOtbPremises(raw: {
  mes: string; saldo: string; reserva: string; observacao: string
}): OtbPremises {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(raw.mes)) throw new RangeError("Competência inicial inválida.")
  const notes = raw.observacao.trim()
  if (notes.length > 500) throw new RangeError("Observação excede 500 caracteres.")
  return {
    forecastStart: `${raw.mes}-01`,
    openingCash: amount(raw.saldo, "Saldo inicial", false),
    cashBuffer: amount(raw.reserva, "Reserva de caixa", true),
    notes,
  }
}
