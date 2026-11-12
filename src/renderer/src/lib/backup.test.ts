import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyBackup,
  BACKUP_KIND,
  BACKUP_VERSION,
  backupFileName,
  createBackup,
  MAX_BACKUP_ENTRIES,
  parseBackup,
  type BackupPayload
} from './backup'

function fakeStorage(initial: Record<string, string>): Storage {
  const data = new Map(Object.entries(initial))
  return {
    get length() {
      return data.size
    },
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
    removeItem: (key: string) => {
      data.delete(key)
    },
    clear: () => data.clear()
  } as Storage
}

function payload(entries: Record<string, string>): BackupPayload {
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    app: '0.8.0',
    createdAt: '2026-11-12T00:00:00.000Z',
    entries
  }
}

describe('backupFileName', () => {
  it('includes the version and UTC date', () => {
    expect(backupFileName('0.8.0', new Date('2026-11-12T15:30:00Z'))).toBe(
      'devbench-settings-0.8.0-2026-11-12.json'
    )
  })
})

describe('createBackup', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('captures only devkit entries', () => {
    vi.stubGlobal('window', {
      localStorage: fakeStorage({
        'devkit:theme': '"cyber-blue"',
        'devkit:json-formatter:input': '{}',
        unrelated: 'skip me'
      })
    })
    const backup = createBackup('0.8.0', new Date('2026-11-12T00:00:00Z'))
    expect(backup.kind).toBe(BACKUP_KIND)
    expect(backup.entries).toEqual({
      'devkit:theme': '"cyber-blue"',
      'devkit:json-formatter:input': '{}'
    })
  })
})

describe('parseBackup', () => {
  it('accepts a well-formed backup', () => {
    const result = parseBackup(JSON.stringify(payload({ 'devkit:theme': '"solar-flare"' })))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload.entries['devkit:theme']).toBe('"solar-flare"')
  })

  it('rejects invalid JSON, foreign files, and bad versions', () => {
    expect(parseBackup('{').ok).toBe(false)
    expect(parseBackup(JSON.stringify({ kind: 'other', version: 1, entries: {} })).ok).toBe(false)
    expect(
      parseBackup(JSON.stringify({ kind: BACKUP_KIND, version: 99, entries: {} })).ok
    ).toBe(false)
  })

  it('rejects unrecognized keys and non-string values', () => {
    expect(parseBackup(JSON.stringify(payload({ theme: '"dark"' }))).ok).toBe(false)
    const badValue = payload({}) as unknown as { entries: Record<string, unknown> }
    badValue.entries['devkit:theme'] = 42
    expect(parseBackup(JSON.stringify(badValue)).ok).toBe(false)
  })

  it('rejects oversized entry counts', () => {
    const entries: Record<string, string> = {}
    for (let index = 0; index <= MAX_BACKUP_ENTRIES; index += 1) {
      entries[`devkit:key-${index}`] = '1'
    }
    expect(parseBackup(JSON.stringify(payload(entries))).ok).toBe(false)
  })
})

describe('applyBackup', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('replaces saved data and leaves unrelated keys alone', () => {
    vi.stubGlobal('window', {
      localStorage: fakeStorage({
        'devkit:theme': '"cyber-blue"',
        'devkit:old': '1',
        unrelated: 'keep'
      })
    })
    const result = applyBackup(payload({ 'devkit:theme': '"arctic-frost"' }), 'replace')
    expect(result).toEqual({ ok: true, imported: 1 })
    expect(window.localStorage.getItem('devkit:theme')).toBe('"arctic-frost"')
    expect(window.localStorage.getItem('devkit:old')).toBeNull()
    expect(window.localStorage.getItem('unrelated')).toBe('keep')
  })

  it('merges without clearing existing entries', () => {
    vi.stubGlobal('window', {
      localStorage: fakeStorage({ 'devkit:favorites': '["hash"]' })
    })
    expect(applyBackup(payload({ 'devkit:theme': '"solar-flare"' }), 'merge')).toEqual({
      ok: true,
      imported: 1
    })
    expect(window.localStorage.getItem('devkit:favorites')).toBe('["hash"]')
    expect(window.localStorage.getItem('devkit:theme')).toBe('"solar-flare"')
  })
})
