/**
 * Normalização de apresentação reutilizável por Server e Client Components.
 * Não colocar em um módulo com `"use client"`: o servidor também a utiliza.
 */
export function getBranchDisplayName(branch: string): string {
  return branch === "SO SAL" ? "BANDEIRANTES" : branch
}
