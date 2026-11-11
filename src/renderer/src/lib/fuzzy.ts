export function fuzzyScore(text: string, query: string): number | null {
  const haystack = text.toLowerCase()
  const needle = query.trim().toLowerCase()
  if (!needle) return 0

  const direct = haystack.indexOf(needle)
  if (direct >= 0) {
    const startsWord = direct === 0 || /[\s\-_/]/.test(haystack[direct - 1])
    return 1000 - direct * 2 + (startsWord ? 25 : 0) + needle.length * 4
  }

  let score = 0
  let index = 0
  let previous = -1
  for (const character of needle) {
    const found = haystack.indexOf(character, index)
    if (found < 0) return null
    if (found === previous + 1) score += 8
    else if (found === 0 || /[\s\-_/]/.test(haystack[found - 1])) score += 6
    else score += 1
    previous = found
    index = found + 1
  }
  return score
}

export function bestFuzzyScore(values: string[], query: string): number | null {
  let best: number | null = null
  for (const value of values) {
    const score = fuzzyScore(value, query)
    if (score !== null && (best === null || score > best)) best = score
  }
  return best
}
