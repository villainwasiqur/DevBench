import { describe, expect, it } from 'vitest'
import {
  UUID_NAMESPACES,
  formatIdExport,
  isUlid,
  nanoid,
  ulid,
  ulidTime,
  uuidV3,
  uuidV4,
  uuidV5,
  uuidV7
} from './id'
import { md5Hex } from './md5'

const encoder = new TextEncoder()

describe('md5', () => {
  it('matches known vectors', () => {
    expect(md5Hex(encoder.encode(''))).toBe('d41d8cd98f00b204e9800998ecf8427e')
    expect(md5Hex(encoder.encode('abc'))).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect(md5Hex(encoder.encode('The quick brown fox jumps over the lazy dog'))).toBe(
      '9e107d9d372bb6826bd81d3542a419d6'
    )
  })
})

describe('uuid generators', () => {
  it('creates RFC-shaped version 4 and 7 values', () => {
    const v4 = uuidV4()
    expect(v4).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)

    const timestamp = 1767225600123
    const v7 = uuidV7(timestamp)
    expect(v7).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(Number.parseInt(v7.replace(/-/g, '').slice(0, 12), 16)).toBe(timestamp)
  })

  it('produces spec-compliant namespaced identifiers', async () => {
    expect(await uuidV3('www.example.com', UUID_NAMESPACES.dns)).toBe(
      '5df41881-3aed-3515-88a7-2f4a814cf09e'
    )
    expect(await uuidV5('www.example.com', UUID_NAMESPACES.dns)).toBe(
      '2ed6657d-e927-568b-95e1-2665a8aea6a2'
    )
  })
})

describe('ulid', () => {
  it('encodes the timestamp in the first 10 characters', () => {
    const timestamp = 1767225600123
    const value = ulid(timestamp)
    expect(isUlid(value)).toBe(true)
    expect(ulidTime(value)).toBe(timestamp)
    expect(ulidTime('not-a-ulid')).toBeNull()
  })
})

describe('nanoid', () => {
  it('honours length and alphabet', () => {
    const id = nanoid(21)
    expect(id).toHaveLength(21)
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/)

    expect(nanoid(8, 'abc')).toMatch(/^[abc]{8}$/)
  })
})

describe('formatIdExport', () => {
  it('renders TXT, CSV, and JSON', () => {
    const ids = ['one', 'two']
    expect(formatIdExport(ids, 'txt')).toBe('one\ntwo')
    expect(formatIdExport(ids, 'csv')).toBe('index,id\n1,one\n2,two')
    expect(formatIdExport(ids, 'json')).toBe('[\n  "one",\n  "two"\n]')
  })
})
