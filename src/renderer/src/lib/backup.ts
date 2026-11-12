import { byteLength, clearStorageScope, STORAGE_PREFIX } from './storage'

export const BACKUP_KIND = 'devbench-settings'
export const BACKUP_VERSION = 1
export const MAX_BACKUP_ENTRIES = 200
export const MAX_BACKUP_BYTES = 512 * 1024
const MAX_ENTRY_LENGTH = 128 * 1024
const MAX_KEY_LENGTH = 200

export interface BackupPayload {
  kind: typeof BACKUP_KIND
  version: typeof BACKUP_VERSION
  app: string
  createdAt: string
  entries: Record<string, string>
}

export type BackupParseResult =
  | { ok: true; payload: BackupPayload }
  | { ok: false; error: string }

export type BackupApplyResult =
  | { ok: true; imported: number }
  | { ok: false; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readStoragePairs(): Array<[string, string]> {
  const pairs: Array<[string, string]> = []
  try {
    const storage = window.localStorage
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue
      const value = storage.getItem(key)
      if (value !== null) pairs.push([key, value])
    }
  } catch {
    // Storage is optional; an empty backup is still valid.
  }
  return pairs
}

export function backupFileName(version: string, now = new Date()): string {
  return `devbench-settings-${version}-${now.toISOString().slice(0, 10)}.json`
}

export function createBackup(version: string, now = new Date()): BackupPayload {
  const entries: Record<string, string> = {}
  for (const [key, value] of readStoragePairs()) entries[key] = value
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    app: version,
    createdAt: now.toISOString(),
    entries
  }
}

export function parseBackup(text: string): BackupParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'The selected file is not valid JSON.' }
  }

  if (!isRecord(data)) {
    return { ok: false, error: 'The selected file is not a settings backup.' }
  }
  if (data.kind !== BACKUP_KIND) {
    return { ok: false, error: 'This is not a DevBench settings file.' }
  }
  if (data.version !== BACKUP_VERSION) {
    return { ok: false, error: 'This settings file was created by an unsupported version.' }
  }
  if (!isRecord(data.entries)) {
    return { ok: false, error: 'The settings file has no entries.' }
  }

  const keys = Object.keys(data.entries)
  if (keys.length > MAX_BACKUP_ENTRIES) {
    return { ok: false, error: `The settings file has too many entries (limit ${MAX_BACKUP_ENTRIES}).` }
  }

  const entries: Record<string, string> = {}
  let bytes = 0
  for (const key of keys) {
    const value = data.entries[key]
    if (
      !key.startsWith(STORAGE_PREFIX) ||
      key.length <= STORAGE_PREFIX.length ||
      key.length > MAX_KEY_LENGTH
    ) {
      return { ok: false, error: 'The settings file contains an unrecognized entry.' }
    }
    if (typeof value !== 'string') {
      return { ok: false, error: 'The settings file contains an invalid value.' }
    }
    if (value.length > MAX_ENTRY_LENGTH) {
      return { ok: false, error: 'A settings entry is too large to import safely.' }
    }
    bytes += byteLength(value)
    entries[key] = value
  }
  if (bytes > MAX_BACKUP_BYTES) {
    return { ok: false, error: 'The settings file is too large to import safely.' }
  }

  return {
    ok: true,
    payload: {
      kind: BACKUP_KIND,
      version: BACKUP_VERSION,
      app: typeof data.app === 'string' ? data.app : 'unknown',
      createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
      entries
    }
  }
}

export function applyBackup(
  payload: BackupPayload,
  mode: 'replace' | 'merge' = 'replace'
): BackupApplyResult {
  try {
    const storage = window.localStorage
    if (mode === 'replace') clearStorageScope('all')
    let imported = 0
    for (const [key, value] of Object.entries(payload.entries)) {
      storage.setItem(key, value)
      imported += 1
    }
    return { ok: true, imported }
  } catch {
    return { ok: false, error: 'Saving the imported settings failed; storage may be full.' }
  }
}
