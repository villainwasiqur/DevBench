export interface RegexFlagOptions {
  global?: boolean
  ignoreCase?: boolean
  multiline?: boolean
  dotAll?: boolean
  unicode?: boolean
}

export interface RegexGroup {
  name?: string
  value?: string
}

export interface RegexMatch {
  index: number
  length: number
  value: string
  groups: RegexGroup[]
}

export type RegexMatchesResult =
  | { ok: true; matches: RegexMatch[]; truncated: boolean }
  | { ok: false; error: string }

export const MAX_INPUT_LENGTH = 200_000
export const MAX_MATCHES = 500

export function buildFlagString(options: RegexFlagOptions = {}): string {
  let flags = ''
  if (options.global !== false) flags += 'g'
  if (options.ignoreCase) flags += 'i'
  if (options.multiline) flags += 'm'
  if (options.dotAll) flags += 's'
  if (options.unicode) flags += 'u'
  return flags
}

export function compileRegex(source: string, options: RegexFlagOptions = {}): RegExp {
  if (!source) throw new Error('Enter a regular expression to test.')
  return new RegExp(source, buildFlagString(options))
}

function collectGroups(match: RegExpExecArray): RegexGroup[] {
  return match.slice(1).map((value) => ({
    value: value === undefined ? undefined : value
  }))
}

function namedGroupPositions(source: string): Map<string, number> {
  const positions = new Map<string, number>()
  let groupIndex = 0
  let inCharacterClass = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]

    if (char === '\\') {
      index += 1
      continue
    }
    if (inCharacterClass) {
      if (char === ']') inCharacterClass = false
      continue
    }
    if (char === '[') {
      inCharacterClass = true
      continue
    }
    if (char !== '(') continue

    if (source[index + 1] !== '?') {
      groupIndex += 1
      continue
    }

    if (source[index + 2] === '<' && source[index + 3] !== '=' && source[index + 3] !== '!') {
      const end = source.indexOf('>', index + 3)
      if (end !== -1) {
        groupIndex += 1
        positions.set(source.slice(index + 3, end), groupIndex)
        index = end
      }
    }
  }

  return positions
}

function labelGroups(groups: RegexGroup[], pattern: string): RegexGroup[] {
  const namesByPosition = new Map<number, string>()
  for (const [name, position] of namedGroupPositions(pattern)) {
    namesByPosition.set(position, name)
  }

  return groups.map((group, index) => {
    const name = namesByPosition.get(index + 1)
    return name ? { ...group, name } : group
  })
}

export function findMatches(
  source: string,
  options: RegexFlagOptions,
  input: string,
  limit = MAX_MATCHES
): RegexMatchesResult {
  if (!source) return { ok: false, error: 'Enter a regular expression to test.' }
  if (input.length > MAX_INPUT_LENGTH) {
    return {
      ok: false,
      error: `Input is too large to test safely (${input.length.toLocaleString()} characters). Keep it under ${MAX_INPUT_LENGTH.toLocaleString()}.`
    }
  }

  let regex: RegExp
  try {
    regex = new RegExp(source, buildFlagString({ ...options, global: true }))
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'This regular expression is not valid.'
    }
  }

  const matches: RegexMatch[] = []
  let truncated = false
  let guard = 0

  while (guard <= input.length + 1) {
    const match = regex.exec(input)
    if (!match) break

    matches.push({
      index: match.index,
      length: match[0].length,
      value: match[0],
      groups: labelGroups(collectGroups(match), source)
    })

    if (match[0].length === 0) {
      const codePoint = input.codePointAt(regex.lastIndex)
      regex.lastIndex += codePoint !== undefined && codePoint > 0xffff ? 2 : 1
      if (regex.lastIndex > input.length) break
    }

    if (options.global === false) break
    if (matches.length >= limit) {
      truncated = regex.lastIndex < input.length
      break
    }

    guard += 1
  }

  return { ok: true, matches, truncated }
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export type RegexReplaceResult =
  | { ok: true; output: string; replacements: number }
  | { ok: false; error: string }

function countMatches(regex: RegExp, input: string): number {
  regex.lastIndex = 0
  let count = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(input)) !== null) {
    count += 1
    if (match[0].length === 0) {
      const codePoint = input.codePointAt(regex.lastIndex)
      regex.lastIndex += codePoint !== undefined && codePoint > 0xffff ? 2 : 1
      if (regex.lastIndex > input.length) break
    }
  }

  return count
}

export function replaceMatches(
  source: string,
  options: RegexFlagOptions,
  input: string,
  replacement: string
): RegexReplaceResult {
  if (!source) return { ok: false, error: 'Enter a regular expression to test.' }
  if (input.length > MAX_INPUT_LENGTH) {
    return {
      ok: false,
      error: `Input is too large to replace safely (${input.length.toLocaleString()} characters). Keep it under ${MAX_INPUT_LENGTH.toLocaleString()}.`
    }
  }

  try {
    const flags = buildFlagString({ ...options, global: true })
    const output = input.replace(new RegExp(source, flags), replacement)
    const replacements = countMatches(new RegExp(source, flags), input)
    return { ok: true, output, replacements }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'This regular expression is not valid.'
    }
  }
}
