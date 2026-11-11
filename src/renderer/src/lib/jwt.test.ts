import { describe, expect, it } from 'vitest'
import { bytesToBase64Url, encodeBase64Url } from './base64'
import { createJwt, decodeJwt, jwtClaimDate, parseJwks, verifyJwt } from './jwt'

const encoder = new TextEncoder()

async function signToken(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  key: CryptoKey,
  algorithm: 'RSASSA-PKCS1-v1_5' | 'ECDSA'
): Promise<string> {
  const headerSegment = encodeBase64Url(JSON.stringify(header))
  const payloadSegment = encodeBase64Url(JSON.stringify(payload))
  const input = encoder.encode(`${headerSegment}.${payloadSegment}`)

  const params =
    algorithm === 'ECDSA'
      ? ({ name: 'ECDSA', hash: 'SHA-256' } as const)
      : ({ name: 'RSASSA-PKCS1-v1_5' } as const)

  const signature = new Uint8Array(await crypto.subtle.sign(params, key, input))
  const signatureSegment = bytesToBase64Url(signature)
  return `${headerSegment}.${payloadSegment}.${signatureSegment}`
}

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

describe('verifyJwt', () => {
  it('verifies the standard HS256 example from jwt.io', async () => {
    const raw =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    const result = await verifyJwt(raw, { secret: 'your-256-bit-secret' })
    expect(result).toEqual({ ok: true, algorithm: 'HS256' })
  })

  it('rejects a wrong secret and tampered payloads', async () => {
    const raw =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    expect((await verifyJwt(raw, { secret: 'wrong' })).ok).toBe(false)

    const [header, , signature] = raw.split('.')
    const tampered = `${header}.${encodeBase64Url(JSON.stringify({ sub: 'admin' }))}.${signature}`
    const result = await verifyJwt(tampered, { secret: 'your-256-bit-secret' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/does not match/)
  })

  it('refuses unsigned tokens', async () => {
    const raw = token({ alg: 'none', typ: 'JWT' }, { sub: '42' }, '')
    const result = await verifyJwt(raw, { secret: 'anything' })
    expect(result).toEqual({
      ok: false,
      error: 'Tokens with alg "none" are unsigned and cannot be trusted.'
    })
  })

  it('reports unsupported algorithms', async () => {
    const raw = token({ alg: 'PS512' }, { sub: '42' }, 'sig')
    const result = await verifyJwt(raw, { secret: 'anything' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/Unsupported algorithm/)
  })

  it('verifies tokens signed with your generated secret', async () => {
    const created = await createJwt({
      algorithm: 'HS512',
      secret: 'super-secret',
      payload: '{"sub":"42","role":"admin"}'
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    expect(await verifyJwt(created.token, { secret: 'super-secret' })).toEqual({
      ok: true,
      algorithm: 'HS512'
    })
  })

  it('verifies RS256 tokens against a public JWK', async () => {
    const pair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256'
      },
      true,
      ['sign', 'verify']
    )
    const publicKey = await crypto.subtle.exportKey('jwk', pair.publicKey)
    const raw = await signToken(
      { alg: 'RS256', typ: 'JWT', kid: 'rsa-1' },
      { sub: '42' },
      pair.privateKey,
      'RSASSA-PKCS1-v1_5'
    )

    const result = await verifyJwt(raw, {
      jwks: JSON.stringify({ keys: [{ ...publicKey, kid: 'rsa-1' }] })
    })
    expect(result).toEqual({ ok: true, algorithm: 'RS256', kid: 'rsa-1' })

    const missingKid = await verifyJwt(raw, {
      jwks: JSON.stringify({ keys: [{ ...publicKey, kid: 'other' }] })
    })
    expect(missingKid.ok).toBe(false)
    if (!missingKid.ok) expect(missingKid.error).toMatch(/kid "rsa-1"/)
  })

  it('verifies ES256 tokens against a public JWK', async () => {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify'
    ])
    const publicKey = await crypto.subtle.exportKey('jwk', pair.publicKey)
    const raw = await signToken(
      { alg: 'ES256', typ: 'JWT' },
      { sub: '42' },
      pair.privateKey,
      'ECDSA'
    )

    const result = await verifyJwt(raw, { jwks: JSON.stringify(publicKey) })
    expect(result).toEqual({ ok: true, algorithm: 'ES256', kid: undefined })
  })
})

describe('createJwt', () => {
  it('rejects invalid claims and missing secrets', async () => {
    expect(await createJwt({ algorithm: 'HS256', secret: 's', payload: '{oops' })).toEqual({
      ok: false,
      error: 'Claims must be valid JSON.'
    })
    expect(await createJwt({ algorithm: 'HS256', secret: 's', payload: '[1]' })).toEqual({
      ok: false,
      error: 'Claims must be a JSON object.'
    })
    expect(await createJwt({ algorithm: 'HS256', secret: '', payload: '{}' })).toEqual({
      ok: false,
      error: 'Enter a signing secret.'
    })
  })
})

describe('parseJwks', () => {
  it('accepts a single JWK or a key set', () => {
    expect(parseJwks('{"kty":"oct"}')).toEqual({ ok: true, keys: [{ kty: 'oct' }] })
    expect(parseJwks('{"keys":[{"kty":"RSA"}]}')).toEqual({ ok: true, keys: [{ kty: 'RSA' }] })
  })

  it('reports invalid documents', () => {
    expect(parseJwks('').ok).toBe(false)
    expect(parseJwks('nope').ok).toBe(false)
    expect(parseJwks('[]').ok).toBe(false)
    expect(parseJwks('{"keys":[]}').ok).toBe(false)
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
