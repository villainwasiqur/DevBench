import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { DEFAULT_THEME_ID, THEMES, type ThemeDefinition, type ThemeId } from '../hooks/useTheme'
import { Icon } from '../icons'
import { applyBackup, backupFileName, createBackup, parseBackup } from '../lib/backup'
import { clearPreferences, useFavorites, useRecentTools } from '../lib/prefs'
import {
  clearStorageScope,
  collectStorage,
  formatBytes,
  summarizeStorage,
  type StorageEntry
} from '../lib/storage'
import { Button, IconButton } from './ui/Button'
import { Callout, Panel } from './ui/Panel'
import { useToast } from './ui/Toast'

interface SettingsPageProps {
  theme: ThemeId
  onSelectTheme: (id: ThemeId) => void
  onShowShortcuts: () => void
}

function swatch(definition: ThemeDefinition): string {
  const [base, mid, glow] = definition.swatches
  return `linear-gradient(135deg, ${base} 0%, ${mid} 54%, ${glow} 100%)`
}

function Metric({ value, label }: { value: string; label: string }): ReactElement {
  return (
    <div className="settings-metric">
      <span className="settings-metric-value">{value}</span>
      <span className="settings-metric-label">{label}</span>
    </div>
  )
}

export function SettingsPage({
  theme,
  onSelectTheme,
  onShowShortcuts
}: SettingsPageProps): ReactElement {
  const [entries, setEntries] = useState<StorageEntry[]>(() => collectStorage())
  const [version, setVersion] = useState('—')
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const favorites = useFavorites()
  const recent = useRecentTools()
  const toast = useToast()

  const refresh = useCallback(() => setEntries(collectStorage()), [])

  useEffect(() => {
    const api = window.devkit?.app
    if (!api) return
    let active = true
    void api
      .version()
      .then((value) => {
        if (active) setVersion(value)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const summary = summarizeStorage(entries)

  const clearToolData = (): void => {
    const count = clearStorageScope('tool')
    refresh()
    toast.show(
      count > 0 ? `${count} saved tool input${count === 1 ? '' : 's'} cleared.` : 'No saved tool inputs.',
      count > 0 ? 'success' : 'info'
    )
  }

  const clearPinned = (): void => {
    clearPreferences()
    refresh()
    toast.show('Favorites and recent tools cleared.', 'success')
  }

  const resetAll = (): void => {
    const confirmed = window.confirm(
      'Reset all saved data? This removes tool inputs, favorites, recents, and the theme choice.'
    )
    if (!confirmed) return
    clearPreferences()
    clearStorageScope('all')
    onSelectTheme(DEFAULT_THEME_ID)
    refresh()
    toast.show('All saved data reset.', 'success')
  }

  const appVersion = version === '—' ? '0.0.0' : version

  const exportSettings = (): void => {
    const payload = createBackup(appVersion)
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = backupFileName(appVersion)
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.show(
      `${Object.keys(payload.entries).length} setting${Object.keys(payload.entries).length === 1 ? '' : 's'} exported.`,
      'success'
    )
  }

  const importSettings = async (file: File): Promise<void> => {
    setImporting(true)
    try {
      const parsed = parseBackup(await file.text())
      if (!parsed.ok) {
        toast.show(parsed.error, 'error')
        return
      }
      const count = Object.keys(parsed.payload.entries).length
      const confirmed = window.confirm(
        `Replace all saved data with ${count} entr${count === 1 ? 'y' : 'ies'} from “${file.name}”?`
      )
      if (!confirmed) return
      const applied = applyBackup(parsed.payload, 'replace')
      if (!applied.ok) {
        toast.show(applied.error, 'error')
        return
      }
      toast.show(`${applied.imported} settings imported. Reloading…`, 'success')
      window.setTimeout(() => window.location.reload(), 600)
    } catch {
      toast.show('The selected file could not be read.', 'error')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="page settings-page">
      <header className="settings-head">
        <span className="eyebrow">
          <Icon name="settings" size={14} />
          Preferences
        </span>
        <h1>Settings</h1>
        <p>Choose how the toolkit looks, review what it remembers, and clear it any time.</p>
      </header>

      <Panel
        title="Appearance"
        footer={`Active theme: ${THEMES.find((item) => item.id === theme)?.name ?? 'Cyber Blue'}. Themes apply instantly and are remembered on this device.`}
      >
        <div className="theme-card-grid" role="group" aria-label="Color theme">
          {THEMES.map((definition) => {
            const selected = definition.id === theme
            return (
              <button
                key={definition.id}
                type="button"
                className={`theme-card${selected ? ' is-selected' : ''}`}
                aria-pressed={selected}
                onClick={() => onSelectTheme(definition.id)}
              >
                <span className="theme-card-swatch" style={{ background: swatch(definition) }} />
                <span className="theme-card-body">
                  <span className="theme-card-name">{definition.name}</span>
                  <span className="theme-card-tagline">{definition.tagline}</span>
                </span>
                <span className="theme-card-meta">
                  <span className="pill pill-muted">
                    {definition.scheme === 'light' ? 'Light' : 'Dark'}
                  </span>
                  {selected && <Icon name="check" size={15} className="theme-card-check" />}
                </span>
              </button>
            )
          })}
        </div>
      </Panel>

      <Panel
        title="Saved data"
        actions={
          <IconButton label="Refresh saved data" onClick={refresh}>
            <Icon name="refresh" size={15} />
          </IconButton>
        }
        footer="Sensitive values — JWT tokens, HMAC keys, and signing secrets — are never written to storage."
      >
        <div className="settings-metrics">
          <Metric value={String(summary.total)} label="Saved entries" />
          <Metric value={String(summary.tools)} label="Tool inputs" />
          <Metric value={String(favorites.length)} label="Favorites" />
          <Metric value={String(recent.length)} label="Recent tools" />
          <Metric value={formatBytes(summary.bytes)} label="Storage used" />
        </div>

        <div className="settings-actions">
          <div className="settings-action">
            <div className="settings-action-copy">
              <strong>Clear saved tool inputs</strong>
              <span>Forget the text and options entered in every tool. Favorites stay put.</span>
            </div>
            <Button variant="secondary" size="sm" onClick={clearToolData} disabled={summary.tools === 0}>
              Clear inputs
            </Button>
          </div>

          <div className="settings-action">
            <div className="settings-action-copy">
              <strong>Clear favorites and recent tools</strong>
              <span>Reset the pinned list and the palette&apos;s recent history.</span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={clearPinned}
              disabled={favorites.length === 0 && recent.length === 0}
            >
              Clear pins
            </Button>
          </div>

          <div className="settings-action is-danger">
            <div className="settings-action-copy">
              <strong>Reset all saved data</strong>
              <span>Removes tool inputs, favorites, recents, and the theme choice.</span>
            </div>
            <Button variant="danger" size="sm" onClick={resetAll}>
              Reset everything
            </Button>
          </div>
        </div>
      </Panel>

      <Panel
        title="Backup & restore"
        footer="Exports include preferences, favorites, and saved tool inputs. Importing replaces saved data after confirmation."
      >
        <div className="settings-action">
          <div className="settings-action-copy">
            <strong>Portable settings file</strong>
            <span>Download a JSON copy, or restore one on another machine.</span>
          </div>
          <div className="settings-backup-actions">
            <Button
              variant="secondary"
              size="sm"
              icon={<Icon name="download" size={14} />}
              onClick={exportSettings}
            >
              Export JSON
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Icon name="upload" size={14} />}
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              Import JSON
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Import settings file"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void importSettings(file)
              }}
            />
          </div>
        </div>
      </Panel>

      <Panel title="About">
        <dl className="about-list">
          <div>
            <dt>Version</dt>
            <dd>v{version}</dd>
          </div>
          <div>
            <dt>Platform</dt>
            <dd>{window.devkit?.platform ?? 'web'}</dd>
          </div>
          <div>
            <dt>Storage</dt>
            <dd>Local to this device</dd>
          </div>
        </dl>

        <div className="settings-about-actions">
          <Button
            variant="secondary"
            icon={<Icon name="keyboard" size={15} />}
            onClick={onShowShortcuts}
          >
            Keyboard shortcuts
          </Button>
        </div>

        <Callout tone="info" title="Local-first by design">
          No uploads, no accounts, no telemetry. Everything you type stays in this window, and the
          only network request the app can make is the opt-in JWKS fetch in the JWT tool.
        </Callout>
      </Panel>
    </div>
  )
}
