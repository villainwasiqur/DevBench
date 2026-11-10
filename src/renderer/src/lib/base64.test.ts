import { describe, expect, it } from 'vitest'
import {
  base64UrlToBytes,
  bytesToBase64Url,
  decodeBase64,
  encodeBase64,
  encodeBase64Url,
  fromBase64Url,
  textByteLength,
  toBase64Url
} from './base64'

describe('encodeBase64', () => {
  it('encodes ASCII with padding', () => {
    expect(encodeBase64('hello')).toBe('aGVsbG8=')
  })

  it('encodes UTF-8 content', () => {
    expect(encodeBase64('✓', true)).toBe('4pyT')
  })

  it('produces URL-safe output on request', () => {
    expect(encodeBase64('😀', true)).toBe('8J-YgA')
  })
})

describe('decodeBase64', () => {
  it('returns an empty string for empty input', () => {
    expect(decodeBase64('')).toBe('')
  })

  it('ignores whitespace', () => {
    expect(decodeBase64(' aGVs\nbG8= ')).toBe('hello')
  })

  it('round-trips Unicode text', () => {
    const text = 'Hello, 世界 ✓'
    expect(decodeBase64(encodeBase64(text))).toBe(text)
  })

  it('rejects characters outside the Base64 alphabet', () => {
    expect(() => decodeBase64('a$b')).toThrow(/not valid Base64/)
  })

  it('rejects impossible lengths', () => {
    expect(() => decodeBase64('a')).toThrow(/length is invalid/)
  })

  it('rejects bytes that are not valid UTF-8', () => {
    expect(() => decodeBase64('/w==')).toThrow(/not valid UTF-8/)
  })
})

describe('Base64URL helpers', () => {
  it('converts to and from the URL-safe alphabet', () => {
    expect(toBase64Url('a+b/cA==')).toBe('a-b_cA')
    expect(fromBase64Url('a-b_cA')).toBe('a+b/cA==')
  })

  it('restores missing padding', () => {
    expect(fromBase64Url('YQ')).toBe('YQ==')
  })

  it('encodes bytes without padding', () => {
    expect(bytesToBase64Url(new Uint8Array([0xfb, 0xff]))).toBe('-_8')
    expect([...base64UrlToBytes('-_8')]).toEqual([0xfb, 0xff])
  })

  it('encodes text as Base64URL', () => {
    expect(encodeBase64Url('hello')).toBe('aGVsbG8')
  })
})

describe('textByteLength', () => {
  it('counts UTF-8 bytes rather than characters', () => {
    expect(textByteLength('✓')).toBe(3)
    expect(textByteLength('abc')).toBe(3)
  })
})
