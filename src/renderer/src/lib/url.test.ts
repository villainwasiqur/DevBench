import { describe, expect, it } from 'vitest'
import { convertUrl, MAX_QUERY_PARAMS, parseQueryParams } from './url'

function outputOf(value: string, mode: 'encode' | 'decode', scope: 'component' | 'form' | 'url') {
  const result = convertUrl(value, mode, scope)
  if (!result.ok) throw new Error(result.error)
  return result.output
}

describe('convertUrl', () => {
  it('encodes query components', () => {
    expect(outputOf('hello world & friends / 100% ready', 'encode', 'component')).toBe(
      'hello%20world%20%26%20friends%20%2F%20100%25%20ready'
    )
  })

  it('encodes form bodies with plus for spaces', () => {
    expect(outputOf('a b&c=d+e', 'encode', 'form')).toBe('a+b%26c%3Dd%2Be')
  })

  it('keeps full URL structure intact', () => {
    expect(outputOf('https://example.com/a b?x=1&y=2', 'encode', 'url')).toBe(
      'https://example.com/a%20b?x=1&y=2'
    )
  })

  it('decodes percent-encoding', () => {
    expect(outputOf('%E2%9C%93%20done', 'decode', 'component')).toBe('✓ done')
    expect(outputOf('https%3A%2F%2Fexample.com%2Fa%20b', 'decode', 'component')).toBe(
      'https://example.com/a b'
    )
    expect(outputOf('https%3A%2F%2Fexample.com%2Fa%20b', 'decode', 'url')).toBe(
      'https%3A%2F%2Fexample.com%2Fa b'
    )
  })

  it('decodes plus signs only in form scope', () => {
    expect(outputOf('a+b%26c', 'decode', 'form')).toBe('a b&c')
    expect(outputOf('a+b', 'decode', 'component')).toBe('a+b')
  })

  it('reports malformed percent-encoding', () => {
    expect(convertUrl('%E0%A4%A', 'decode', 'component')).toMatchObject({
      ok: false,
      error: expect.stringContaining('Malformed')
    })
    expect(convertUrl('%E0%A4%A', 'decode', 'form')).toMatchObject({ ok: false })
  })

  it('passes empty input through', () => {
    expect(convertUrl('', 'encode', 'component')).toEqual({ ok: true, output: '' })
  })
})

describe('parseQueryParams', () => {
  it('breaks a full URL into decoded parameters', () => {
    const result = parseQueryParams('https://example.com/search?q=hello+world&tag=a%26b&page=2#results')
    expect(result).toEqual({
      ok: true,
      base: 'https://example.com/search',
      hash: 'results',
      truncated: false,
      params: [
        { key: 'q', value: 'hello world', raw: 'q=hello+world', hasValue: true },
        { key: 'tag', value: 'a&b', raw: 'tag=a%26b', hasValue: true },
        { key: 'page', value: '2', raw: 'page=2', hasValue: true }
      ]
    })
  })

  it('keeps duplicate keys', () => {
    const result = parseQueryParams('?tag=a&tag=b')
    expect(result.ok && result.params.map((param) => param.value)).toEqual(['a', 'b'])
  })

  it('distinguishes empty values from flags', () => {
    const result = parseQueryParams('?empty=&flag')
    expect(result.ok && result.params).toEqual([
      { key: 'empty', value: '', raw: 'empty=', hasValue: true },
      { key: 'flag', value: '', raw: 'flag', hasValue: false }
    ])
  })

  it('ignores empty segments', () => {
    const result = parseQueryParams('?a=1&&b=2&')
    expect(result.ok && result.params).toHaveLength(2)
  })

  it('accepts a bare query string', () => {
    const result = parseQueryParams('a=1')
    expect(result.ok && result.base).toBe('')
    expect(result.ok && result.params[0]).toMatchObject({ key: 'a', value: '1' })
  })

  it('reports the malformed parameter position', () => {
    expect(parseQueryParams('?a=1&b=%ZZ')).toEqual({
      ok: false,
      error: 'Parameter 2 has malformed percent-encoding.'
    })
  })

  it('returns no parameters for blank input', () => {
    expect(parseQueryParams('  ')).toEqual({ ok: true, base: '', hash: '', params: [], truncated: false })
  })

  it('caps the parameter list', () => {
    const query = Array.from({ length: MAX_QUERY_PARAMS + 5 }, (_, index) => `k${index}=v`).join('&')
    const result = parseQueryParams(query)
    expect(result.ok && result.params).toHaveLength(MAX_QUERY_PARAMS)
    expect(result.ok && result.truncated).toBe(true)
  })
})
