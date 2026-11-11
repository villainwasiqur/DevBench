import { useCallback, useState } from 'react'

const PREFIX = 'devkit:'
const MAX_CHARS = 64 * 1024

export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeStored(key: string, value: unknown): void {
  try {
    const serialized = JSON.stringify(value)
    if (serialized.length > MAX_CHARS) return
    window.localStorage.setItem(PREFIX + key, serialized)
  } catch {
    // Storage can be unavailable or full; persistence is best-effort.
  }
}

export function removeStored(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key)
  } catch {
    // Ignore storage failures.
  }
}

export function usePersistentState<T>(
  key: string,
  initial: T | (() => T)
): [T, (value: T | ((previous: T) => T)) => void] {
  const [value, setValue] = useState<T>(() =>
    readStored(key, typeof initial === 'function' ? (initial as () => T)() : initial)
  )

  const set = useCallback(
    (next: T | ((previous: T) => T)) => {
      setValue((previous) => {
        const resolved =
          typeof next === 'function' ? (next as (value: T) => T)(previous) : next
        writeStored(key, resolved)
        return resolved
      })
    },
    [key]
  )

  return [value, set]
}
