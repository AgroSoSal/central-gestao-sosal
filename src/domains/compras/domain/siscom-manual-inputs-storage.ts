import { parseManualInputBackup, type ManualInput } from "./siscom-manual-inputs"

/** Armazenamento temporário no navegador, segregado por identidade autenticada.
 * Nunca é usado como autorização financeira ou fonte SISCOM oficial. */
export function manualInputsStorageKey(userId: string) {
  if (!userId || userId.length > 150) throw new RangeError("Usuário não identificado.")
  return `sosal.compras.siscom-pendente.v1.${userId}`
}

export function loadManualInputs(userId: string): ManualInput[] {
  const content = window.localStorage.getItem(manualInputsStorageKey(userId))
  return content ? parseManualInputBackup(content) : []
}

export function saveManualInputs(userId: string, records: readonly ManualInput[]) {
  if (records.length > 500) throw new RangeError("O limite é de 500 lançamentos por navegador.")
  // Validação antes de persistir, inclusive após importação.
  const json = JSON.stringify({ versao: 1, registros: records })
  parseManualInputBackup(json)
  window.localStorage.setItem(manualInputsStorageKey(userId), json)
}
