import { beforeEach, describe, expect, it } from 'vitest'
import {
  addHistoryEntry,
  canSaveToHistory,
  clearAllHistory,
  clearHistoryTool,
  clearToolHistory,
  getHistory,
  MAX_HISTORY_ENTRIES,
  MAX_HISTORY_VALUE,
  removeHistory,
  removeHistoryEntry,
  sanitizeHistory,
  saveToHistory,
  toggleHistoryPin,
  togglePin,
  type HistoryEntry
} from './history'

function entry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: Math.random().toString(36).slice(2),
    toolId: 'json-formatter',
    label: 'Formatted JSON',
    value: '{"a":1}',
    createdAt: 1_700_000_000_000,
    pinned: false,
    ...overrides
  }
}

describe('canSaveToHistory', () => {
  it('denies tools that handle secrets', () => {
    expect(canSaveToHistory('jwt-decoder')).toBe(false)
    expect(canSaveToHistory('hash-generator')).toBe(false)
    expect(canSaveToHistory('json-formatter')).toBe(true)
  })
})

describe('addHistoryEntry', () => {
  it('prepends new entries with a unique id', () => {
    const first = addHistoryEntry([], { toolId: 'json-formatter', label: 'JSON', value: 'a', now: 1 })
    expect(first).not.toBeNull()
    const second = addHistoryEntry(first!, {
      toolId: 'sql-formatter',
      label: 'SQL',
      value: 'b',
      now: 2
    })
    expect(second?.[0].toolId).toBe('sql-formatter')
    expect(second?.[1].id).toBe(first?.[0].id)
  })

  it('rejects empty, oversized, and denied values', () => {
    expect(addHistoryEntry([], { toolId: 'json-formatter', label: 'x', value: '' })).toBeNull()
    expect(
      addHistoryEntry([], {
        toolId: 'json-formatter',
        label: 'x',
        value: 'a'.repeat(MAX_HISTORY_VALUE + 1)
      })
    ).toBeNull()
    expect(addHistoryEntry([], { toolId: 'jwt-decoder', label: 'x', value: 'token' })).toBeNull()
  })

  it('caps the list at thirty entries, evicting the oldest unpinned first', () => {
    let entries: HistoryEntry[] = []
    for (let index = 0; index < MAX_HISTORY_ENTRIES; index += 1) {
      entries = addHistoryEntry(entries, {
        toolId: 'json-formatter',
        label: `run ${index}`,
        value: `value ${index}`,
        now: index
      })!
    }
    entries = toggleHistoryPin(entries, entries[0].id)
    entries = addHistoryEntry(entries, {
      toolId: 'sql-formatter',
      label: 'newest',
      value: 'newest',
      now: 999
    })!
    expect(entries).toHaveLength(MAX_HISTORY_ENTRIES)
    expect(entries[0].label).toBe('newest')
    expect(entries.some((item) => item.label === 'run 0')).toBe(false)
    expect(entries.some((item) => item.label === `run ${MAX_HISTORY_ENTRIES - 1}` && item.pinned)).toBe(
      true
    )
  })
})

describe('sanitizeHistory', () => {
  it('drops malformed, oversized, and secret-handling entries', () => {
    const valid = entry()
    const result = sanitizeHistory([
      valid,
      { ...valid, id: 5 },
      { ...valid, value: '' },
      { ...valid, value: 'a'.repeat(MAX_HISTORY_VALUE + 1) },
      { ...valid, toolId: 'jwt-decoder' },
      null
    ])
    expect(result).toEqual([valid])
  })

  it('returns an empty list for non-arrays', () => {
    expect(sanitizeHistory(null)).toEqual([])
    expect(sanitizeHistory({})).toEqual([])
  })
})

describe('entry operations', () => {
  const first = entry({ id: 'a', toolId: 'json-formatter' })
  const second = entry({ id: 'b', toolId: 'sql-formatter' })

  it('toggles pins without mutating the input', () => {
    const next = toggleHistoryPin([first, second], 'a')
    expect(next[0].pinned).toBe(true)
    expect(first.pinned).toBe(false)
  })

  it('removes entries and clears a single tool', () => {
    expect(removeHistoryEntry([first, second], 'a')).toEqual([second])
    expect(clearHistoryTool([first, second], 'sql-formatter')).toEqual([first])
  })
})

describe('history store', () => {
  beforeEach(() => clearAllHistory())

  it('saves, pins, removes, and clears entries', () => {
    expect(saveToHistory('json-formatter', 'JSON', '{"a":1}')).toBe(true)
    expect(saveToHistory('jwt-decoder', 'JWT', 'token')).toBe(false)
    let entries = getHistory()
    expect(entries).toHaveLength(1)
    togglePin(entries[0].id)
    expect(getHistory()[0].pinned).toBe(true)
    removeHistory(entries[0].id)
    expect(getHistory()).toEqual([])
    saveToHistory('sql-formatter', 'SQL', 'SELECT 1')
    saveToHistory('json-formatter', 'JSON', '{"b":2}')
    clearToolHistory('json-formatter')
    expect(getHistory().map((item) => item.toolId)).toEqual(['sql-formatter'])
    clearAllHistory()
    expect(getHistory()).toEqual([])
  })
})
