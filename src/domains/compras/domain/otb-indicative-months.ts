/** OTB!B7 começa no primeiro dia do MÊS SEGUINTE à data-base do fluxo.
 * A série de compras prevista é apenas operacional; não substitui o teto B21:D21.
 */
export function nextOtbPurchaseNeeds(
  today: string, months: readonly string[], amounts: readonly number[],
): {month:string;amount:number}[] | null {
  if (!/^20\d\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(today) ||
      Number.isNaN(Date.parse(today+"T00:00:00Z")) || months.length !== amounts.length) return null
  const [year,month] = today.split("-").map(Number)
  const expected = [1,2,3].map(offset => new Date(Date.UTC(year,month-1+offset,1)).toISOString().slice(0,10))
  const result = expected.map(next => {
    const i = months.indexOf(next)
    const amount = amounts[i]
    return i>=0 && Number.isFinite(amount) && amount >= 0 ? {month:next,amount} : null
  })
  return result.some(item=>item===null) ? null : result as {month:string;amount:number}[]
}
