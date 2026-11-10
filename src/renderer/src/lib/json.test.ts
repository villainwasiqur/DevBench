import { describe, expect, it } from 'vitest'
import { transformJson, validateJson } from './json'

describe('transformJson', () => {
  it('pretty-prints with the requested indent', () => {
    const result = transformJson('{"b":2,"a":1}', { indent: 2 })
    expect(result).toEqual({ ok: true, value: '{\n  "b": 2,\n  "a": 1\n}' })
  })

  it('supports string indentation', () => {
    const result = transformJson('{"a":1}', { indent: '\t' })
    expect(result).toEqual({ ok: true, value: '{\n\t"a": 1\n}' })
  })

  it('minifies when requested', () => {
    const result = transformJson('{ "a": 1, "b": [2, 3] }', { indent: 2, minify: true })
    expect(result).toEqual({ ok: true, value: '{"a":1,"b":[2,3]}' })
  })

  it('sorts keys deeply without reordering arrays', () => {
    const input = '{"b":{"z":1,"a":2},"a":[{"y":1,"x":2}]}'
    const expected = JSON.stringify({ a: [{ x: 2, y: 1 }], b: { a: 2, z: 1 } }, null, 2)
    const result = transformJson(input, { indent: 2, sortKeys: true })
    expect(result).toEqual({ ok: true, value: expected })
  })

  it('preserves key order when sorting is disabled', () => {
    const result = transformJson('{"b":1,"a":2}', { indent: 0 })
    expect(result.ok && result.value.indexOf('"b"') < result.value.indexOf('"a"')).toBe(true)
  })

  it('reports a position and line for invalid input', () => {
    const result = transformJson('{\n  "a": 1,\n  "b": 2,\n}', { indent: 2 })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.message.length).toBeGreaterThan(0)
    expect(result.error.line).toBe(4)
    expect(result.error.column).toBe(1)
    expect(result.error.position).toBe(22)
  })

  it('handles engine errors without position details', () => {
    const result = transformJson('{"a": }', { indent: 2 })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.message).toMatch(/not valid JSON/i)
    expect(result.error.line).toBeUndefined()
  })
})

describe('validateJson', () => {
  it('accepts valid JSON', () => {
    expect(validateJson('[1, true, null, "x"]')).toEqual({ ok: true })
  })

  it('rejects invalid JSON with details', () => {
    const result = validateJson('nope')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.message).toMatch(/not valid JSON/i)
  })
})
