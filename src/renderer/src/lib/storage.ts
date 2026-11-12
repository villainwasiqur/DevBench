export const STORAGE_PREFIX = 'devkit:'

const PREFERENCE_KEYS = new Set(['theme', 'favorites', 'recent', 'history'])

export type StorageScope = 'preference' | 'tool'

export interface StorageEntry {
  key: string
  bytes: number
}

export interface StorageSummary {
  total: number
  preferences: number
  tools: number
  bytes: number
}

export function scopeForKey(key: string): StorageScope {
  return PREFERENCE_KEYS.has(key) ? 'preference' : 'tool'
}

export function byteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

export function summarizeStorage(entries: StorageEntry[]): StorageSummary {
  return entries.reduce<StorageSummary>(
    (summary, entry) => {
      summary.total += 1
      summary.bytes += entry.bytes
      if (scopeForKey(entry.key) === 'preference') summary.preferences += 1
      else summary.tools += 1
      return summary
    },
    { total: 0, preferences: 0, tools: 0, bytes: 0 }
  )
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function collectStorage(): StorageEntry[] {
  try {
    const entries: StorageEntry[] = []
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const rawKey = window.localStorage.key(index)
      if (!rawKey?.startsWith(STORAGE_PREFIX)) continue
      const value = window.localStorage.getItem(rawKey) ?? ''
      entries.push({ key: rawKey.slice(STORAGE_PREFIX.length), bytes: byteLength(value) })
    }
    return entries
  } catch {
    return []
  }
}

export function clearStorageScope(scope: StorageScope | 'all'): number {
  const removed = collectStorage().filter(
    (entry) => scope === 'all' || scopeForKey(entry.key) === scope
  )
  try {
    removed.forEach((entry) => window.localStorage.removeItem(STORAGE_PREFIX + entry.key))
  } catch {
    return 0
  }
  return removed.length
}
