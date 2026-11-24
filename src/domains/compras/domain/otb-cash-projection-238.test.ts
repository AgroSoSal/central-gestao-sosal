import { describe, expect, it } from "vitest"
import { calculateWorstCaseOtbCaps } from "./otb-cash-projection"

/**
 * Gestão Zacarini - Painel 2.3.8.xlsx, cached calculation values:
 * Projeção 12M!C613:N613, B615:B626, C630:N632, B638:B640, B652:D652.
 * 12 months Nov/2026–Oct/2027. They are ORIGINAL INPUTS FROM THE WORKBOOK,
 * not data for the real Só Sal purchasing approval.
 */
const worstFreeCash=[
  1000139.5784782581,3059721.9478265257,4987725.827537749,
  10029238.477071434,15899640.705463797,17997518.740842156,
  19593876.999745473,23303218.846609715,23790663.19584771,
  22856442.90289666,26885057.10017987,28410180.555847865,
] as const
const monthlyNeeds=[8381590.469645567,6387809.141332962,5917956.651622597] as const
const cumulativeDues=[
 [0,0,757524.7237443466,3361518.684423872,5042151.5968189435,5580770.769855496,8381590.469645567,8381590.469645567,8381590.469645567,8381590.469645567,8381590.469645567,8381590.469645567],
 [0,0,0,549625.5203218171,2587621.9839563766,3805539.657457588,4222034.735502003,6387809.141332962,6387809.141332962,6387809.141332962,6387809.141332962,6387809.141332962],
 [0,0,0,0,588590.4608537612,2788326.07953036,4139837.715846187,4393854.706671389,5917956.651622597,5917956.651622597,5917956.651622597,5917956.651622597],
] as const

describe("Trava PIOR CASO · Projeção 12M/OTB 2.3.8",()=>{
 it("reproduz R$ 8.381.590,47 / 6.387.809,14 / 5.917.956,65 sem inventar caixa",()=>{
  const result=calculateWorstCaseOtbCaps({
    source:"ZACARINI_238_FIXTURE_TEST_ONLY",
    forecastStart:"2026-11-01",
    cashBuffer:0, // OTB!B11
    worstFreeCash,
    monthlyNeeds,
    cumulativeDues,
  })
  expect(result.cashCaps[0]).toBeCloseTo(8381590.469645567,2)
  expect(result.cashCaps[1]).toBeCloseTo(6387809.141332962,2)
  expect(result.cashCaps[2]).toBeCloseTo(5917956.651622597,2)
  expect(result.factors).toEqual([1,1,1]) // Projeção 12M!B638:B640
  expect(result.cumulativeLimits[2]).toBeCloseTo(4987725.827537749,2)
 })
 it("falha fechada sem dados de 12 meses ou com vencimentos incoerentes",()=>{
  expect(()=>calculateWorstCaseOtbCaps({
    source:"TEST",forecastStart:"2026-11-01",cashBuffer:0,
    worstFreeCash:worstFreeCash.slice(0,11),monthlyNeeds,cumulativeDues,
  })).toThrow(/12 meses/)
  expect(()=>calculateWorstCaseOtbCaps({
    source:"TEST",forecastStart:"2026-11-01",cashBuffer:0,
    worstFreeCash,monthlyNeeds,
    cumulativeDues:[[0,100,80,...cumulativeDues[0].slice(3)],cumulativeDues[1],cumulativeDues[2]],
  })).toThrow(/não podem diminuir/)
 })
})
