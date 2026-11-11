import { bytesToBase64Url, base64UrlToBytes, encodeBase64Url } from './base64'
import type { HashAlgorithm } from './hash'

export interface DecodedJwt {
  header: Record<string, unknown>
  payload: Record<string, unknown>
  signature: string
  headerSegment: string
  payloadSegment: string
}

export type JwtResult = { ok: true; token: DecodedJwt } | { ok: false; error: string }

function decodeJsonSegment(segment: string, name: string): Record<string, unknown> {
  if (!segment) throw new Error(`The ${name} segment is empty.`)

  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(base64UrlToBytes(segment))
  } catch {
    throw new Error(`The ${name} segment is not valid Base64URL.`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`The ${name} segment does not contain valid JSON.`)
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`The ${name} segment must be a JSON object.`)
  }

  return parsed as Record<string, unknown>
}

export function decodeJwt(raw: string): JwtResult {
  const token = raw.trim()
  if (!token) return { ok: false, error: 'Paste a JWT to inspect it.' }

  const segments = token.split('.')
  if (segments.length !== 3) {
    return {
      ok: false,
      error: 'A JWT needs exactly three dot-separated segments: header.payload.signature.'
    }
  }

  try {
    const header = decodeJsonSegment(segments[0], 'header')
    const payload = decodeJsonSegment(segments[1], 'payload')
    return {
      ok: true,
      token: {
        header,
        payload,
        signature: segments[2],
        headerSegment: segments[0],
        payloadSegment: segments[1]
      }
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to decode the token.'
    }
  }
}

export function jwtClaimDate(payload: Record<string, unknown>, key: string): Date | null {
  const value = payload[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return new Date(value * 1000)
}

export type JwtAlgorithm = 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'ES256'

export const JWT_ALGORITHMS: readonly JwtAlgorithm[] = [
  'HS256',
  'HS384',
  'HS512',
  'RS256',
  'ES256'
]

const HMAC_HASH: Record<string, HashAlgorithm> = {
  HS256: 'SHA-256',
  HS384: 'SHA-384',
  HS512: 'SHA-512'
}

const encoder = new TextEncoder()

function subtle(): SubtleCrypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto is not available in this environment.')
  }
  return crypto.subtle
}

type VerificationKey = JsonWebKey & { kid?: string }

export function parseJwks(
  input: string
): { ok: true; keys: VerificationKey[] } | { ok: false; error: string } {
  const trimmed = input.trim()
  if (!trimmed) return { ok: false, error: 'Paste a JWK or a JWKS document with a keys array.' }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return { ok: false, error: 'The key is not valid JSON. Paste a single JWK or a JWKS object.' }
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'The key must be a JWK object or a JWKS object with a keys array.' }
  }

  const record = parsed as Record<string, unknown>
  if (Array.isArray(record.keys)) {
    const keys = record.keys.filter(
      (key): key is VerificationKey => key !== null && typeof key === 'object'
    )
    if (keys.length === 0) return { ok: false, error: 'The JWKS document contains no keys.' }
    return { ok: true, keys }
  }

  if (typeof record.kty === 'string') {
    return { ok: true, keys: [record as unknown as VerificationKey] }
  }

  return { ok: false, error: 'The key must be a JWK object or a JWKS object with a keys array.' }
}

function keyFitsAlgorithm(key: VerificationKey, algorithm: JwtAlgorithm): boolean {
  if (algorithm === 'RS256') return key.kty === 'RSA'
  if (algorithm === 'ES256') return key.kty === 'EC' && key.crv === 'P-256'
  return false
}

async function importVerificationKey(
  key: VerificationKey,
  algorithm: JwtAlgorithm
): Promise<CryptoKey> {
  if (algorithm === 'RS256') {
    return subtle().importKey(
      'jwk',
      key,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    )
  }
  return subtle().importKey('jwk', key, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'verify'
  ])
}

async function verifyAsymmetric(
  algorithm: JwtAlgorithm,
  key: VerificationKey,
  signature: Uint8Array<ArrayBuffer>,
  signingInput: Uint8Array<ArrayBuffer>
): Promise<boolean> {
  const cryptoKey = await importVerificationKey(key, algorithm)
  if (algorithm === 'ES256') {
    if (signature.length !== 64) return false
    return subtle().verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      cryptoKey,
      signature,
      signingInput
    )
  }
  return subtle().verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    cryptoKey,
    signature,
    signingInput
  )
}

export type JwtVerification =
  | { ok: true; algorithm: JwtAlgorithm; kid?: string }
  | { ok: false; error: string }

export interface JwtVerifyOptions {
  secret?: string
  jwks?: string
}

export async function verifyJwt(raw: string, options: JwtVerifyOptions): Promise<JwtVerification> {
  const decoded = decodeJwt(raw)
  if (!decoded.ok) return { ok: false, error: decoded.error }

  const { header, signature, headerSegment, payloadSegment } = decoded.token
  const algorithmName = String(header.alg ?? '')

  if (algorithmName === 'none') {
    return { ok: false, error: 'Tokens with alg "none" are unsigned and cannot be trusted.' }
  }
  if (!JWT_ALGORITHMS.includes(algorithmName as JwtAlgorithm)) {
    return {
      ok: false,
      error: `Unsupported algorithm "${algorithmName || 'missing'}". Supported: ${JWT_ALGORITHMS.join(', ')}.`
    }
  }
  const algorithm = algorithmName as JwtAlgorithm

  let signatureBytes: Uint8Array<ArrayBuffer>
  try {
    signatureBytes = new Uint8Array(base64UrlToBytes(signature))
  } catch {
    return { ok: false, error: 'The signature segment is not valid Base64URL.' }
  }

  const signingInput = encoder.encode(`${headerSegment}.${payloadSegment}`)

  try {
    if (HMAC_HASH[algorithm]) {
      const secret = options.secret ?? ''
      if (!secret) return { ok: false, error: 'Enter the HMAC secret used to sign the token.' }

      const cryptoKey = await subtle().importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: HMAC_HASH[algorithm] },
        false,
        ['verify']
      )
      const valid = await subtle().verify('HMAC', cryptoKey, signatureBytes, signingInput)
      return valid
        ? { ok: true, algorithm }
        : { ok: false, error: 'The signature does not match the secret.' }
    }

    const parsed = parseJwks(options.jwks ?? '')
    if (!parsed.ok) return parsed

    const kid = typeof header.kid === 'string' ? header.kid : undefined
    let candidates = parsed.keys.filter((key) => keyFitsAlgorithm(key, algorithm))
    if (kid) candidates = candidates.filter((key) => key.kid === kid)
    if (candidates.length === 0) {
      return {
        ok: false,
        error: kid
          ? `No ${algorithm} key with kid "${kid}" was found in the provided JWKS.`
          : `The provided key is not compatible with ${algorithm}.`
      }
    }

    for (const key of candidates) {
      if (await verifyAsymmetric(algorithm, key, signatureBytes, signingInput)) {
        return { ok: true, algorithm, kid: key.kid }
      }
    }

    return { ok: false, error: 'The signature does not match any provided key.' }
  } catch (reason) {
    return {
      ok: false,
      error: reason instanceof Error ? reason.message : 'Signature verification failed.'
    }
  }
}

export interface JwtCreateOptions {
  algorithm: 'HS256' | 'HS384' | 'HS512'
  secret: string
  payload: string
}

export async function createJwt(
  options: JwtCreateOptions
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const secret = options.secret
  if (!secret) return { ok: false, error: 'Enter a signing secret.' }

  let payload: unknown
  try {
    payload = JSON.parse(options.payload)
  } catch {
    return { ok: false, error: 'Claims must be valid JSON.' }
  }
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'Claims must be a JSON object.' }
  }

  const headerSegment = encodeBase64Url(
    JSON.stringify({ alg: options.algorithm, typ: 'JWT' })
  )
  const payloadSegment = encodeBase64Url(JSON.stringify(payload))
  const signingInput = encoder.encode(`${headerSegment}.${payloadSegment}`)

  try {
    const cryptoKey = await subtle().importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: HMAC_HASH[options.algorithm] },
      false,
      ['sign']
    )
    const signature = new Uint8Array(
      await subtle().sign('HMAC', cryptoKey, signingInput)
    )
    return {
      ok: true,
      token: `${headerSegment}.${payloadSegment}.${bytesToBase64Url(signature)}`
    }
  } catch (reason) {
    return {
      ok: false,
      error: reason instanceof Error ? reason.message : 'Could not sign the token.'
    }
  }
}
