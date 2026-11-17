import { execFileSync } from "node:child_process"
import assert from "node:assert/strict"
import { calculateWorstCaseOtbCaps } from "../src/domains/compras/domain/otb-cash-projection.ts"

const file = process.argv[2]
if (!file) {
  process.stderr.write("Uso: node --experimental-strip-types scripts/compare-otb-cash-workbook.mjs arquivo.xlsx\n")
  process.exit(2)
}

const { input, expected } = JSON.parse(execFileSync("python", ["scripts/extract-otb-cash-reference.py", file], {
  maxBuffer: 2 * 1024 * 1024,
}).toString("utf8"))
const calculated = calculateWorstCaseOtbCaps(input)
let checked = 0
let maxDifference = 0
for (const field of ["factors", "cashCaps"]) {
  for (let i = 0; i < 3; i++) {
    const actual = calculated[field][i]
    const target = expected[field][i]
    const difference = Math.abs(actual - target)
    checked++
    maxDifference = Math.max(maxDifference, difference)
    assert.ok(difference < 0.01, `${field} do mês ${i + 1} divergiu da planilha.`)
  }
}
process.stdout.write(`${checked} valores da Projeção 12M conferidos. Maior diferença = ${maxDifference.toFixed(8)}.\n`)
