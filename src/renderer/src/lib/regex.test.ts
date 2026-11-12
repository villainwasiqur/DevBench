import { describe, expect, it } from 'vitest'
import {
  MAX_INPUT_LENGTH,
  buildFlagString,
  compileRegex,
  escapeRegExp,
  findMatches,
  replaceMatches
} from './regex'

describe('buildFlagString', () => {
  it('is global by default', () => {
    expect(buildFlagString()).toBe('g')
  })

  it('includes enabled flags in a stable order', () => {
    expect(buildFlagString({ ignoreCase: true, multiline: true, unicode: true })).toBe('gimu')
    expect(buildFlagString({ global: false, dotAll: true })).toBe('s')
  })
})

describe('compileRegex', () => {
  it('builds a working expression', () => {
    const regex = compileRegex('a+', { ignoreCase: true })
    expect(regex.test('AAA')).toBe(true)
  })

  it('throws for an empty pattern', () => {
    expect(() => compileRegex('')).toThrow(/Enter a regular expression/)
  })

  it('throws for invalid syntax', () => {
    expect(() => compileRegex('[unclosed')).toThrow()
  })
})

describe('findMatches', () => {
  it('finds every match with its index and capture groups', () => {
    const result = findMatches('(\\w+)@(\\w+)', {}, 'a@b c@d')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.matches).toHaveLength(2)
    expect(result.matches[0]).toMatchObject({ index: 0, value: 'a@b', length: 3 })
    expect(result.matches[0].groups.map((group) => group.value)).toEqual(['a', 'b'])
    expect(result.matches[1].index).toBe(4)
    expect(result.truncated).toBe(false)
  })

  it('exposes named groups in their capture positions', () => {
    const result = findMatches('(?<user>\\w+)@(?<host>[a-z.]+)', {}, 'jane@example.com')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.matches[0].groups).toEqual([
      { name: 'user', value: 'jane' },
      { name: 'host', value: 'example.com' }
    ])
  })

  it('mixes named and unnamed captures without duplicating them', () => {
    const result = findMatches('(\\w+)@(?<host>[a-z.]+):(\\d+)', {}, 'jane@example.com:8080')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.matches[0].groups).toEqual([
      { value: 'jane' },
      { name: 'host', value: 'example.com' },
      { value: '8080' }
    ])
  })

  it('does not treat lookbehind groups as named captures', () => {
    const result = findMatches('(?<=@)(?<domain>[a-z.]+)', {}, 'jane@example.com')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.matches[0].groups).toEqual([{ name: 'domain', value: 'example.com' }])
  })

  it('stops after the first match when global is disabled', () => {
    const result = findMatches('x', { global: false }, 'x x x')
    expect(result.ok && result.matches).toHaveLength(1)
  })

  it('returns an error for invalid patterns', () => {
    const result = findMatches('(unclosed', {}, 'text')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.length).toBeGreaterThan(0)
  })

  it('rejects empty patterns', () => {
    expect(findMatches('', {}, 'text')).toEqual({
      ok: false,
      error: 'Enter a regular expression to test.'
    })
  })

  it('advances past zero-length matches without looping forever', () => {
    const result = findMatches('\\b', {}, 'ab cd')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.matches.map((match) => match.index)).toEqual([0, 2, 3, 5])
  })

  it('rejects oversized input', () => {
    const result = findMatches('a', {}, 'a'.repeat(MAX_INPUT_LENGTH + 1))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/too large/i)
  })

  it('caps the match list and marks it truncated', () => {
    const result = findMatches('a', {}, 'a'.repeat(10), 4)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.matches).toHaveLength(4)
    expect(result.truncated).toBe(true)
  })
})

describe('escapeRegExp', () => {
  it('escapes metacharacters so they match literally', () => {
    const literal = 'a+b.c(d)[e]'
    expect(new RegExp(escapeRegExp(literal)).test(literal)).toBe(true)
  })
})

describe('replaceMatches', () => {
  it('replaces every match and reports the count', () => {
    const result = replaceMatches('cat', {}, 'cat cat catalog', 'dog')
    expect(result).toEqual({ ok: true, output: 'dog dog dogalog', replacements: 3 })
  })

  it('expands numbered and named captures', () => {
    const result = replaceMatches(
      '(?<user>[\\w.]+)@(?<host>\\w+)',
      {},
      'dev@toolkit',
      '$<user> at $2 ($1)'
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.output).toBe('dev at toolkit (dev)')
    expect(result.replacements).toBe(1)
  })

  it('supports deleting matches with an empty replacement', () => {
    const result = replaceMatches('\\s+', {}, 'a  b\n c', '')
    expect(result).toEqual({ ok: true, output: 'abc', replacements: 2 })
  })

  it('handles zero-width matches without looping forever', () => {
    const result = replaceMatches('^', { multiline: true }, 'a\nb', '> ')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.output).toBe('> a\n> b')
    expect(result.replacements).toBe(2)
  })

  it('returns pattern errors instead of throwing', () => {
    const result = replaceMatches('([', {}, 'text', 'x')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.length).toBeGreaterThan(0)
  })

  it('rejects oversized input', () => {
    const result = replaceMatches('a', {}, 'a'.repeat(MAX_INPUT_LENGTH + 1), 'b')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/too large/i)
  })
})
