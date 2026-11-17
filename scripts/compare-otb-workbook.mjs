import { execFileSync } from "node:child_process"
import assert from "node:assert/strict"
import { calculateOtb } from "../src/domains/compras/domain/otb-calculation.ts"

const file = process.argv[2]
if (!file) {
  process.stderr.write("Uso: node --experimental-strip-types scripts/compare-otb-workbook.mjs ARQUIVO.xlsx\n")
  process.exit(2)
}

// Não imprime valores sensíveis do XLSX: somente a contagem e maior diferença.
const json = execFileSync("python", ["scripts/extract-otb-reference.py", file], { maxBuffer: 4 * 1024 * 1024 }).toString("utf8")
const { input, expected } = JSON.parse(json)
const actual = calculateOtb(input)
let count = 0
let incorrect = 0
let maximum = 0
const differences = []

for (let monthIndex = 0; monthIndex < 3; monthIndex++) {
  for (const row of actual.months[monthIndex].subgroups) {
    const target = expected.rows[row.name][monthIndex]
    for (const field of ["need", "released", "freeBalance", "openingStock", "excess"]) {
      const diff = Math.abs(row[field] - target[field])
      count++
      maximum = Math.max(maximum, diff)
      if (diff > 0.01) {
        incorrect++
        if (differences.length < 6) differences.push({ line: row.line, name: row.name, month: monthIndex + 1, field, difference: Number(diff.toFixed(2)) })
      }
    }
  }
  const totalDifference = Math.abs(actual.months[monthIndex].totalNeed - expected.totalNeed[monthIndex])
  count++
  maximum = Math.max(maximum, totalDifference)
  if (totalDifference > 0.01) {
    incorrect++
    differences.push({ month: monthIndex + 1, field: "totalNeed", difference: totalDifference })
  }
}

process.stdout.write(`${count} comparações, ${incorrect} divergências > R$ 0,01. Maior diferença: R$ ${maximum.toFixed(4)}.\n`)
if (differences.length) process.stdout.write(`${JSON.stringify(differences, null, 2)}\n`)
assert.equal(incorrect, 0, "A implementação diverge da fotografia da aba OTB")
