/** Cadastro preparatório — nunca aprova custo de produção ou orçamento de compras. */
export function validateOwnProductionDraft(input: {
  produto_cod: string; peso_kg: string; industrializacao_rs_t: string;
  frete_rs_t: string; observacao: string
}) {
  const productCode = input.produto_cod.trim()
  const weight = Number(input.peso_kg.replace(",", "."))
  const industry = Number(input.industrializacao_rs_t.replace(",", "."))
  const freight = input.frete_rs_t.trim() === "" ? null : Number(input.frete_rs_t.replace(",", "."))
  if (!productCode || productCode.length > 60 || !/^[\w.-]+$/.test(productCode)) throw new Error("Código de produto inválido.")
  if (!input.peso_kg.trim() || !Number.isFinite(weight) || weight <= 0 || weight > 100000 || Math.abs(Math.round(weight * 1000) - weight * 1000) > 1e-6) throw new Error("Informe peso técnico válido em kg (até 3 casas decimais).")
  if (!input.industrializacao_rs_t.trim() || !Number.isFinite(industry) || industry < 0 || industry > 10000000 || Math.abs(Math.round(industry * 100) - industry * 100) > 1e-6) throw new Error("Informe custo de industrialização válido em R$/t.")
  if (freight !== null && (!Number.isFinite(freight) || freight < 0 || freight > 10000000 || Math.abs(Math.round(freight * 100) - freight * 100) > 1e-6)) throw new Error("Frete por tonelada inválido.")
  if (input.observacao.length > 500) throw new Error("Observação limitada a 500 caracteres.")
  return { productCode, weight, industry, freight, notes: input.observacao }
}
