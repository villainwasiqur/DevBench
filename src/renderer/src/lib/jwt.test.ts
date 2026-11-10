import { describe, expect, it } from 'vitest'
import { encodeBase64Url } from './base64'
import { decodeJwt, jwtClaimDate } from './jwt'

function token(header: unknown, payload: unknown, signature = 'signature'): string {
  return `${encodeBase64Url(JSON.stringify(header))}.${encodeBase64Url(JSON.stringify(payload))}.${signature}`
}

describe('decodeJwt', () => {
  it('decodes header and payload', () => {
    const raw = token({ alg: 'HS256', typ: 'JWT' }, { sub: '42', exp: 1700000000 })
    const result = decodeJwt(`  ${raw}  `)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.token.header).toEqual({ alg: 'HS256', typ: 'JWT' })
    expect(result.token.payload).toEqual({ sub: '42', exp: 1700000000 })
    expect(result.token.signature).toBe('signature')
  })

  it('accepts an empty signature segment', () => {
    const raw = token({ alg: 'none' }, { sub: '42' }, '')
    const result = decodeJwt(raw)
    expect(result.ok && result.token.signature).toBe('')
  })

  it('asks for input when the token is empty', () => {
    const result = decodeJwt('   ')
    expect(result).toEqual({ ok: false, error: 'Paste a JWT to inspect it.' })
  })

  it('requires exactly three segments', () => {
    const result = decodeJwt('abc.def')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/three dot-separated segments/)
  })

  it('reports an empty header segment', () => {
    const result = decodeJwt('.e30.signature')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('The header segment is empty.')
  })

  it('reports invalid Base64URL', () => {
    const result = decodeJwt('!!!.e30.signature')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('The header segment is not valid Base64URL.')
  })

  it('reports invalid JSON in a segment', () => {
    const result = decodeJwt(`${encodeBase64Url('not json')}.${encodeBase64Url('{}')}.sig`)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('The header segment does not contain valid JSON.')
  })

  it('requires segment JSON to be an object', () => {
    const result = decodeJwt(`${encodeBase64Url('{}')}.${encodeBase64Url('[1,2]')}.sig`)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('The payload segment must be a JSON object.')
  })
})

describe('jwtClaimDate', () => {
  it('converts numeric claims from seconds to a Date', () => {
    const date = jwtClaimDate({ exp: 1700000000 }, 'exp')
    expect(date?.getTime()).toBe(1700000000000)
  })

  it('ignores missing or non-numeric claims', () => {
    expect(jwtClaimDate({}, 'exp')).toBeNull()
    expect(jwtClaimDate({ exp: '1700000000' }, 'exp')).toBeNull()
    expect(jwtClaimDate({ exp: Number.NaN }, 'exp')).toBeNull()
  })
})
