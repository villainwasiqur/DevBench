import { bytesToBase64 } from './base64'

export const HASH_ALGORITHMS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const

export type HashAlgorithm = (typeof HASH_ALGORITHMS)[number]

const encoder = new TextEncoder()

function subtle(): SubtleCrypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto is not available in this environment.')
  }
  return crypto.subtle
}

export async function digestBytes(
  algorithm: HashAlgorithm,
  data: Uint8Array<ArrayBuffer>
): Promise<Uint8Array> {
  const buffer = await subtle().digest(algorithm, data)
  return new Uint8Array(buffer)
}

export async function digestText(algorithm: HashAlgorithm, text: string): Promise<Uint8Array> {
  return digestBytes(algorithm, encoder.encode(text))
}

export async function hmacBytes(
  algorithm: HashAlgorithm,
  key: string,
  data: Uint8Array<ArrayBuffer>
): Promise<Uint8Array> {
  const cryptoKey = await subtle().importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign']
  )
  const signature = await subtle().sign('HMAC', cryptoKey, data)
  return new Uint8Array(signature)
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function toBase64(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
}

export function digestMatches(expected: string, actual: string): boolean {
  const left = expected.trim().toLowerCase()
  const right = actual.trim().toLowerCase()
  if (!left || !right || left.length !== right.length) return false

  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}
