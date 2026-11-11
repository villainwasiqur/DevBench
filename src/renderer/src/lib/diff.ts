export type DiffType = 'equal' | 'add' | 'remove'

export interface DiffRow {
  type: DiffType
  left?: string
  right?: string
  leftNumber?: number
  rightNumber?: number
}

export interface DiffOptions {
  ignoreCase?: boolean
  ignoreWhitespace?: boolean
}

export interface DiffSummary {
  added: number
  removed: number
  unchanged: number
  changed: boolean
}

const MAX_CELLS = 4_000_000

function splitLines(text: string): string[] {
  if (text === '') return []
  const trimmed = text.endsWith('\n') ? text.slice(0, -1) : text
  return trimmed.split('\n')
}

function normalize(line: string, options: DiffOptions): string {
  let value = line
  if (options.ignoreWhitespace) value = value.replace(/\s+/g, ' ').trim()
  if (options.ignoreCase) value = value.toLowerCase()
  return value
}

function buildTable(left: string[], right: string[], options: DiffOptions): Uint32Array[] {
  const rows = left.length + 1
  const columns = right.length + 1
  const table: Uint32Array[] = Array.from({ length: rows }, () => new Uint32Array(columns))

  for (let i = left.length - 1; i >= 0; i -= 1) {
    const current = table[i]
    const next = table[i + 1]
    const leftLine = normalize(left[i], options)
    for (let j = right.length - 1; j >= 0; j -= 1) {
      current[j] =
        leftLine === normalize(right[j], options)
          ? next[j + 1] + 1
          : Math.max(next[j], current[j + 1])
    }
  }

  return table
}

export function diffLines(
  leftText: string,
  rightText: string,
  options: DiffOptions = {}
): DiffRow[] {
  const left = splitLines(leftText)
  const right = splitLines(rightText)

  let start = 0
  while (
    start < left.length &&
    start < right.length &&
    normalize(left[start], options) === normalize(right[start], options)
  ) {
    start += 1
  }

  let leftEnd = left.length
  let rightEnd = right.length
  while (
    leftEnd > start &&
    rightEnd > start &&
    normalize(left[leftEnd - 1], options) === normalize(right[rightEnd - 1], options)
  ) {
    leftEnd -= 1
    rightEnd -= 1
  }

  const rows: DiffRow[] = []
  let leftNumber = 1
  let rightNumber = 1

  for (let index = 0; index < start; index += 1) {
    rows.push({ type: 'equal', left: left[index], right: right[index], leftNumber, rightNumber })
    leftNumber += 1
    rightNumber += 1
  }

  const leftMiddle = left.slice(start, leftEnd)
  const rightMiddle = right.slice(start, rightEnd)

  if (leftMiddle.length * rightMiddle.length > MAX_CELLS) {
    leftMiddle.forEach((line) => {
      rows.push({ type: 'remove', left: line, leftNumber })
      leftNumber += 1
    })
    rightMiddle.forEach((line) => {
      rows.push({ type: 'add', right: line, rightNumber })
      rightNumber += 1
    })
  } else if (leftMiddle.length > 0 || rightMiddle.length > 0) {
    const table = buildTable(leftMiddle, rightMiddle, options)
    let i = 0
    let j = 0

    while (i < leftMiddle.length && j < rightMiddle.length) {
      if (normalize(leftMiddle[i], options) === normalize(rightMiddle[j], options)) {
        rows.push({
          type: 'equal',
          left: leftMiddle[i],
          right: rightMiddle[j],
          leftNumber,
          rightNumber
        })
        leftNumber += 1
        rightNumber += 1
        i += 1
        j += 1
      } else if (table[i + 1][j] >= table[i][j + 1]) {
        rows.push({ type: 'remove', left: leftMiddle[i], leftNumber })
        leftNumber += 1
        i += 1
      } else {
        rows.push({ type: 'add', right: rightMiddle[j], rightNumber })
        rightNumber += 1
        j += 1
      }
    }

    while (i < leftMiddle.length) {
      rows.push({ type: 'remove', left: leftMiddle[i], leftNumber })
      leftNumber += 1
      i += 1
    }

    while (j < rightMiddle.length) {
      rows.push({ type: 'add', right: rightMiddle[j], rightNumber })
      rightNumber += 1
      j += 1
    }
  }

  for (let index = leftEnd; index < left.length; index += 1) {
    rows.push({ type: 'equal', left: left[index], right: right[index], leftNumber, rightNumber })
    leftNumber += 1
    rightNumber += 1
  }

  return rows
}

export function summarizeDiff(rows: readonly DiffRow[]): DiffSummary {
  let added = 0
  let removed = 0
  let unchanged = 0

  for (const row of rows) {
    if (row.type === 'add') added += 1
    else if (row.type === 'remove') removed += 1
    else unchanged += 1
  }

  return { added, removed, unchanged, changed: added > 0 || removed > 0 }
}
