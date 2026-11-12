import { useSyncExternalStore } from 'react'
import { readStored, writeStored } from '../hooks/usePersistentState'

const MAX_RECENT = 6

interface Store<T> {
  get: () => T
  set: (next: T) => void
  subscribe: (listener: () => void) => () => void
}

function createStore<T>(key: string, initial: T): Store<T> {
  let value = readStored(key, initial)
  const listeners = new Set<() => void>()

  return {
    get: () => value,
    set: (next: T) => {
      value = next
      writeStored(key, value)
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
}

const favoritesStore = createStore<string[]>('favorites', [])
const recentStore = createStore<string[]>('recent', [])

export function useFavorites(): string[] {
  return useSyncExternalStore(favoritesStore.subscribe, favoritesStore.get)
}

export function useRecentTools(): string[] {
  return useSyncExternalStore(recentStore.subscribe, recentStore.get)
}

export function toggleFavorite(id: string): boolean {
  const current = favoritesStore.get()
  const exists = current.includes(id)
  favoritesStore.set(exists ? current.filter((item) => item !== id) : [...current, id])
  return !exists
}

export function recordRecent(id: string): void {
  const current = recentStore.get()
  if (current[0] === id) return
  recentStore.set([id, ...current.filter((item) => item !== id)].slice(0, MAX_RECENT))
}

export function clearPreferences(): void {
  favoritesStore.set([])
  recentStore.set([])
}
