import { describe, expect, it } from 'vitest'
import { digestMatches, digestText, hmacBytes, toBase64, toHex } from './hash'

describe('digestText', () => {
  it('matches known SHA vectors', async () => {
    expect(toHex(await digestText('SHA-256', ''))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    )
    expect(toHex(await digestText('SHA-1', 'abc'))).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
    expect(toHex(await digestText('SHA-512', 'abc'))).toMatch(/^ddaf35a193617aba/)
  })

  it('encodes digests as Base64', async () => {
    const bytes = await digestText('SHA-256', 'abc')
    expect(toBase64(bytes)).toBe('ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=')
  })
})

describe('hmacBytes', () => {
  it('matches RFC 4231 test case 2', async () => {
    const bytes = await hmacBytes(
      'SHA-256',
      'Jefe',
      new TextEncoder().encode('what do ya want for nothing?')
    )
    expect(toHex(bytes)).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843'
    )
  })
})

describe('digestMatches', () => {
  it('compares case-insensitively and trims whitespace', () => {
    expect(digestMatches(' ABCDEF ', 'abcdef')).toBe(true)
    expect(digestMatches('abcdef', 'abcdee')).toBe(false)
    expect(digestMatches('', '')).toBe(false)
    expect(digestMatches('abc', 'abcd')).toBe(false)
  })
})
