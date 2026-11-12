import { useSyncExternalStore } from 'react'

export const HISTORY_STORAGE_KEY = 'devkit:history'
export const MAX_HISTORY_ENTRIES = 30
export const MAX_HISTORY_VALUE = 20_000
export const HISTORY_DENYLIST: ReadonlySet<string> = new Set(['jwt-decoder', 'hash-generator'])

export interface HistoryEntry {
  id: string
  toolId: string
  label: string
  value: string
  createdAt: number
  pinned: boolean
}

export interface HistoryInput {
  toolId: string
  label: string
  value: string
  now?: number
}

export function canSaveToHistory(toolId: string): boolean {
  return !HISTORY_DENYLIST.has(toolId)
}

function isEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.id === 'string' &&
    typeof entry.toolId === 'string' &&
    typeof entry.label === 'string' &&
    typeof entry.value === 'string' &&
    typeof entry.createdAt === 'number' &&
    Number.isFinite(entry.createdAt) &&
    typeof entry.pinned === 'boolean'
  )
}

export function sanitizeHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(isEntry)
    .filter(
      (entry) =>
        entry.value.length > 0 &&
        entry.value.length <= MAX_HISTORY_VALUE &&
        canSaveToHistory(entry.toolId)
    )
    .slice(0, MAX_HISTORY_ENTRIES)
}

function trim(entries: HistoryEntry[]): HistoryEntry[] {
  const result = [...entries]
  while (result.length > MAX_HISTORY_ENTRIES) {
    const unpinned = result.map((entry) => entry.pinned).lastIndexOf(false)
    result.splice(unpinned === -1 ? result.length - 1 : unpinned, 1)
  }
  return result
}

function createId(now: number): string {
  const random = Math.random().toString(36).slice(2, 8)
  return `${now.toString(36)}-${random}`
}

export function addHistoryEntry(
  entries: HistoryEntry[],
  input: HistoryInput
): HistoryEntry[] | null {
  const value = input.value
  if (!value || value.length > MAX_HISTORY_VALUE || !canSaveToHistory(input.toolId)) return null
  const now = input.now ?? Date.now()
  return trim([
    {
      id: createId(now),
      toolId: input.toolId,
      label: input.label.trim() || input.toolId,
      value,
      createdAt: now,
      pinned: false
    },
    ...entries
  ])
}

export function toggleHistoryPin(entries: HistoryEntry[], id: string): HistoryEntry[] {
  return entries.map((entry) =>
    entry.id === id ? { ...entry, pinned: !entry.pinned } : entry
  )
}

export function removeHistoryEntry(entries: HistoryEntry[], id: string): HistoryEntry[] {
  return entries.filter((entry) => entry.id !== id)
}

export function clearHistoryTool(entries: HistoryEntry[], toolId: string): HistoryEntry[] {
  return entries.filter((entry) => entry.toolId !== toolId)
}

function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    return sanitizeHistory(JSON.parse(window.localStorage.getItem(HISTORY_STORAGE_KEY) ?? 'null'))
  } catch {
    return []
  }
}

let history = loadHistory()
const listeners = new Set<() => void>()

function commit(next: HistoryEntry[]): void {
  history = next
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // History is best-effort; the working set still works for this session.
    }
  }
  listeners.forEach((listener) => listener())
}

export function getHistory(): HistoryEntry[] {
  return history
}

export function useHistory(): HistoryEntry[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => history
  )
}

export function saveToHistory(toolId: string, label: string, value: string): boolean {
  const next = addHistoryEntry(history, { toolId, label, value })
  if (!next) return false
  commit(next)
  return true
}

export function togglePin(id: string): void {
  commit(toggleHistoryPin(history, id))
}

export function removeHistory(id: string): void {
  commit(removeHistoryEntry(history, id))
}

export function clearToolHistory(toolId: string): void {
  commit(clearHistoryTool(history, toolId))
}

export function clearAllHistory(): void {
  commit([])
}
