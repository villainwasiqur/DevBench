import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  byteLength,
  clearStorageScope,
  collectStorage,
  formatBytes,
  scopeForKey,
  summarizeStorage,
  type StorageEntry
} from './storage'

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

describe('scopeForKey', () => {
  it('treats theme, favorites, recent, and history as preferences', () => {
    expect(scopeForKey('theme')).toBe('preference')
    expect(scopeForKey('favorites')).toBe('preference')
    expect(scopeForKey('recent')).toBe('preference')
    expect(scopeForKey('history')).toBe('preference')
  })

  it('treats per-tool entries as tool data', () => {
    expect(scopeForKey('json-formatter:input')).toBe('tool')
    expect(scopeForKey('hash:algorithm')).toBe('tool')
  })
})

describe('byteLength', () => {
  it('counts UTF-8 bytes rather than code units', () => {
    expect(byteLength('abc')).toBe(3)
    expect(byteLength('é')).toBe(2)
    expect(byteLength('🧪')).toBe(4)
  })
})

describe('summarizeStorage', () => {
  it('totals entries and bytes by scope', () => {
    const entries: StorageEntry[] = [
      { key: 'theme', bytes: 10 },
      { key: 'favorites', bytes: 20 },
      { key: 'json-formatter:input', bytes: 30 }
    ]
    expect(summarizeStorage(entries)).toEqual({ total: 3, preferences: 2, tools: 1, bytes: 60 })
  })

  it('returns zeroed totals for no entries', () => {
    expect(summarizeStorage([])).toEqual({ total: 0, preferences: 0, tools: 0, bytes: 0 })
  })
})

describe('formatBytes', () => {
  it('scales units for readable output', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB')
  })
})

describe('clearStorageScope', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('clears only tool entries and reports the count', () => {
    vi.stubGlobal('window', {
      localStorage: fakeStorage({
        'devkit:theme': '"cyber-blue"',
        'devkit:favorites': '["hash"]',
        'devkit:json-formatter:input': '{}'
      })
    })
    expect(collectStorage()).toHaveLength(3)
    expect(clearStorageScope('tool')).toBe(1)
    expect(collectStorage().map((entry) => entry.key)).toEqual(['theme', 'favorites'])
  })

  it('clears every devkit entry for a full reset but leaves other keys alone', () => {
    vi.stubGlobal('window', {
      localStorage: fakeStorage({
        'devkit:theme': '"cyber-blue"',
        'devkit:hash:string': '"abc"',
        unrelated: 'keep me'
      })
    })
    expect(clearStorageScope('all')).toBe(2)
    expect(collectStorage()).toEqual([])
    expect(window.localStorage.getItem('unrelated')).toBe('keep me')
  })
})
