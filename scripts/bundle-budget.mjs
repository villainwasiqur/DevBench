import { readdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const assetsDir = resolve(import.meta.dirname, '..', 'out', 'renderer', 'assets')
const BUDGETS = {
  totalJs: 1_600_000,
  largestChunk: 800_000,
  totalCss: 120_000
}

const files = await readdir(assetsDir).catch(() => {
  console.error(`Bundle budget: no build output at ${assetsDir}. Run "npm run build" first.`)
  process.exit(1)
})

const sized = await Promise.all(
  files
    .filter((name) => name.endsWith('.js') || name.endsWith('.css'))
    .map(async (name) => ({ name, bytes: (await stat(join(assetsDir, name))).size }))
)

const scripts = sized.filter((file) => file.name.endsWith('.js')).sort((a, b) => b.bytes - a.bytes)
const styles = sized.filter((file) => file.name.endsWith('.css'))

const totalJs = scripts.reduce((sum, file) => sum + file.bytes, 0)
const totalCss = styles.reduce((sum, file) => sum + file.bytes, 0)
const largestChunk = scripts[0]?.bytes ?? 0

const format = (bytes) => `${(bytes / 1024).toFixed(1)} kB`
const rows = [
  ['Total JS', totalJs, BUDGETS.totalJs],
  ['Largest JS chunk', largestChunk, BUDGETS.largestChunk],
  ['Total CSS', totalCss, BUDGETS.totalCss]
]

let failed = false
for (const [label, value, budget] of rows) {
  const ok = value <= budget
  if (!ok) failed = true
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${format(value)} (budget ${format(budget)})`)
}

console.log('\nLargest JS chunks:')
for (const file of scripts.slice(0, 5)) {
  console.log(`  ${format(file.bytes).padStart(10)}  ${file.name}`)
}

if (failed) {
  console.error('\nBundle budget exceeded.')
  process.exit(1)
}
console.log('\nBundle budget satisfied.')
