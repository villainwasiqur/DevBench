import { md5 } from './md5'

export const UUID_NAMESPACES = {
  dns: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  url: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
  oid: '6ba7b812-9dad-11d1-80b4-00c04fd430c8',
  x500: '6ba7b814-9dad-11d1-80b4-00c04fd430c8'
} as const

export type UuidNamespace = keyof typeof UUID_NAMESPACES

const encoder = new TextEncoder()

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const NANOID_ALPHABET = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20
  )}-${hex.slice(20, 32)}`
}

export function uuidToBytes(uuid: string): Uint8Array | null {
  const compact = uuid.replace(/-/g, '').toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(compact)) return null

  const bytes = new Uint8Array(16)
  for (let index = 0; index < 16; index += 1) {
    bytes[index] = Number.parseInt(compact.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

export function uuidV4(): string {
  const bytes = randomBytes(16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  return bytesToUuid(bytes)
}

export function uuidV7(timestamp = Date.now()): string {
  const bytes = randomBytes(16)
  let time = timestamp
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = time % 256
    time = Math.floor(time / 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  return bytesToUuid(bytes)
}

function encodeCrockfordTime(timestamp: number): string {
  let time = timestamp
  let output = ''
  for (let index = 0; index < 10; index += 1) {
    output = CROCKFORD[time % 32] + output
    time = Math.floor(time / 32)
  }
  return output
}

function randomCrockfordChars(count: number): string {
  let output = ''
  while (output.length < count) {
    for (const byte of randomBytes(count * 2)) {
      if (byte >= 224) continue
      output += CROCKFORD[byte % 32]
      if (output.length === count) break
    }
  }
  return output
}

export function ulid(timestamp = Date.now()): string {
  return encodeCrockfordTime(timestamp) + randomCrockfordChars(16)
}

export function isUlid(value: string): boolean {
  return /^[0-9A-HJKMNP-TV-Z]{26}$/.test(value)
}

export function ulidTime(value: string): number | null {
  if (!isUlid(value)) return null
  let time = 0
  for (const character of value.slice(0, 10)) {
    time = time * 32 + CROCKFORD.indexOf(character)
  }
  return time
}

export function nanoid(size = 21, alphabet = NANOID_ALPHABET): string {
  const safeSize = Math.min(64, Math.max(4, Math.trunc(size)))
  const symbols = alphabet.length > 0 ? alphabet : NANOID_ALPHABET
  let output = ''
  while (output.length < safeSize) {
    for (const byte of randomBytes(safeSize * 2)) {
      if (byte >= 256 - (256 % symbols.length)) continue
      output += symbols[byte % symbols.length]
      if (output.length === safeSize) break
    }
  }
  return output
}

async function namespacedUuid(
  version: 3 | 5,
  name: string,
  namespace: string
): Promise<string> {
  const namespaceBytes = uuidToBytes(namespace)
  if (!namespaceBytes) throw new Error('The namespace must be a valid UUID.')

  const nameBytes = encoder.encode(name)
  const input = new Uint8Array(namespaceBytes.length + nameBytes.length)
  input.set(namespaceBytes)
  input.set(nameBytes, namespaceBytes.length)

  let digest: Uint8Array
  if (version === 3) {
    digest = md5(input)
  } else {
    if (!globalThis.crypto?.subtle) throw new Error('Web Crypto is not available.')
    digest = new Uint8Array(await crypto.subtle.digest('SHA-1', input))
  }

  const bytes = digest.slice(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | (version === 3 ? 0x30 : 0x50)
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  return bytesToUuid(bytes)
}

export function uuidV3(name: string, namespace: string): Promise<string> {
  return namespacedUuid(3, name, namespace)
}

export function uuidV5(name: string, namespace: string): Promise<string> {
  return namespacedUuid(5, name, namespace)
}

export type IdExportFormat = 'txt' | 'csv' | 'json'

export function formatIdExport(ids: string[], format: IdExportFormat): string {
  if (format === 'csv') {
    return ['index,id', ...ids.map((id, index) => `${index + 1},${id}`)].join('\n')
  }
  if (format === 'json') {
    return JSON.stringify(ids, null, 2)
  }
  return ids.join('\n')
}
