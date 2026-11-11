import { useMemo, useState, type ReactElement } from 'react'
import { Icon } from '../icons'
import { ToolPage } from '../components/ToolPage'
import { Button, IconButton } from '../components/ui/Button'
import { CopyButton } from '../components/ui/CopyButton'
import { Callout, Panel } from '../components/ui/Panel'
import { Segmented } from '../components/ui/Segmented'
import { Toggle } from '../components/ui/Toggle'
import { useCopy } from '../hooks/useCopy'
import { usePersistentState } from '../hooks/usePersistentState'
import { useToast } from '../components/ui/Toast'
import {
  UUID_NAMESPACES,
  formatIdExport,
  nanoid,
  ulid,
  uuidV3,
  uuidV4,
  uuidV5,
  uuidV7,
  type IdExportFormat,
  type UuidNamespace
} from '../lib/id'
import { getTool } from './registry'

const ID_KINDS = [
  { value: 'v4', label: 'UUID v4' },
  { value: 'v7', label: 'UUID v7' },
  { value: 'ulid', label: 'ULID' },
  { value: 'nanoid', label: 'nanoid' }
] as const

const EXPORT_FORMATS = [
  { value: 'txt', label: 'TXT' },
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' }
] as const

const NAMESPACES: { value: UuidNamespace | 'custom'; label: string }[] = [
  { value: 'dns', label: 'DNS' },
  { value: 'url', label: 'URL' },
  { value: 'oid', label: 'OID' },
  { value: 'x500', label: 'X.500' },
  { value: 'custom', label: 'Custom' }
]

const KIND_NOTES: Record<(typeof ID_KINDS)[number]['value'], string> = {
  v4: 'Version 4 · 122 bits of cryptographic randomness · RFC 9562',
  v7: 'Version 7 · time-ordered 48-bit timestamp + 74 random bits',
  ulid: 'ULID · 48-bit time + 80 random bits · Crockford Base32, sortable',
  nanoid: 'nanoid · URL-safe alphabet · compact unique identifier'
}

type IdKind = (typeof ID_KINDS)[number]['value']

function createIds(kind: IdKind, count: number, length: number): string[] {
  return Array.from({ length: count }, () => {
    if (kind === 'v4') return uuidV4()
    if (kind === 'v7') return uuidV7()
    if (kind === 'ulid') return ulid()
    return nanoid(length)
  })
}

export default function UuidGenerator(): ReactElement {
  const tool = getTool('uuid-generator')!
  const { show } = useToast()
  const { copy } = useCopy()
  const [kind, setKind] = usePersistentState<IdKind>('uuid:kind', 'v4')
  const [count, setCount] = usePersistentState('uuid:count', '5')
  const [length, setLength] = usePersistentState('uuid:length', '21')
  const [uppercase, setUppercase] = useState(false)
  const [hyphens, setHyphens] = useState(true)
  const [exportFormat, setExportFormat] = usePersistentState<IdExportFormat>('uuid:export', 'txt')
  const [ids, setIds] = useState<string[]>(() => createIds('v4', 5, 21))
  const [namespace, setNamespace] = useState<UuidNamespace | 'custom'>('dns')
  const [customNamespace, setCustomNamespace] = useState('')
  const [namespaceVersion, setNamespaceVersion] = useState<'v3' | 'v5'>('v5')
  const [name, setName] = useState('')
  const [namespaceError, setNamespaceError] = useState('')

  const displayed = useMemo(
    () =>
      ids.map((id) => {
        if (kind === 'ulid' || kind === 'nanoid') return id
        const cased = uppercase ? id.toUpperCase() : id
        return hyphens ? cased : cased.replace(/-/g, '')
      }),
    [ids, kind, uppercase, hyphens]
  )

  const allText = formatIdExport(displayed, exportFormat)

  const generate = (): void => {
    const parsed = Number.parseInt(count, 10)
    const safeCount = Number.isFinite(parsed) ? Math.min(100, Math.max(1, parsed)) : 5
    const parsedLength = Number.parseInt(length, 10)
    const safeLength = Number.isFinite(parsedLength) ? Math.min(64, Math.max(4, parsedLength)) : 21
    setCount(String(safeCount))
    setLength(String(safeLength))
    setIds(createIds(kind, safeCount, safeLength))
    show(`Generated ${safeCount} identifier${safeCount === 1 ? '' : 's'}`, 'success')
  }

  const addNamespacedId = async (): Promise<void> => {
    const namespaceId =
      namespace === 'custom' ? customNamespace.trim() : UUID_NAMESPACES[namespace]
    if (!name.trim()) {
      setNamespaceError('Enter a name to hash into the identifier.')
      return
    }
    if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(namespaceId)) {
      setNamespaceError('Enter a namespace UUID in 8-4-4-4-12 form.')
      return
    }

    setNamespaceError('')
    try {
      const created =
        namespaceVersion === 'v3'
          ? await uuidV3(name, namespaceId)
          : await uuidV5(name, namespaceId)
      setIds((current) => [created, ...current])
      show(`Added ${namespaceVersion.toUpperCase()} identifier`, 'success')
    } catch (reason) {
      setNamespaceError(reason instanceof Error ? reason.message : 'Could not create the identifier.')
    }
  }

  const download = (): void => {
    const extensions: Record<IdExportFormat, string> = { txt: 'txt', csv: 'csv', json: 'json' }
    const types: Record<IdExportFormat, string> = {
      txt: 'text/plain',
      csv: 'text/csv',
      json: 'application/json'
    }
    const blob = new Blob([allText], { type: types[exportFormat] })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `identifiers.${extensions[exportFormat]}`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const isUuidKind = kind === 'v4' || kind === 'v7'

  return (
    <ToolPage tool={tool}>
      <div className="toolbar">
        <Segmented
          options={ID_KINDS}
          value={kind}
          onChange={setKind}
          ariaLabel="Identifier type"
        />
        <div className="toolbar-group">
          <label className="toolbar-label" htmlFor="uuid-count">
            Count
          </label>
          <input
            id="uuid-count"
            className="text-input number-input"
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(event) => setCount(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') generate()
            }}
          />
        </div>
        {kind === 'nanoid' && (
          <div className="toolbar-group">
            <label className="toolbar-label" htmlFor="uuid-length">
              Length
            </label>
            <input
              id="uuid-length"
              className="text-input number-input"
              type="number"
              min={4}
              max={64}
              value={length}
              onChange={(event) => setLength(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') generate()
              }}
            />
          </div>
        )}
        {isUuidKind && (
          <>
            <Toggle checked={uppercase} onChange={setUppercase} label="Uppercase" />
            <Toggle checked={hyphens} onChange={setHyphens} label="Hyphens" />
          </>
        )}
        <div className="toolbar-group is-push">
          <span className="toolbar-hint">1–100 per batch</span>
          <Button variant="primary" icon={<Icon name="refresh" size={14} />} onClick={generate}>
            Generate
          </Button>
        </div>
      </div>

      <Panel
        title={`${displayed.length} identifier${displayed.length === 1 ? '' : 's'}`}
        actions={
          <div className="panel-action-row">
            <Segmented
              options={EXPORT_FORMATS}
              value={exportFormat}
              onChange={setExportFormat}
              ariaLabel="Export format"
            />
            <Button
              variant="secondary"
              icon={<Icon name="download" size={14} />}
              onClick={download}
            >
              Download
            </Button>
            <CopyButton value={allText} label="Copy all" />
          </div>
        }
        footer={KIND_NOTES[kind]}
      >
        <div className="uuid-list">
          {displayed.map((id, index) => (
            <div className="uuid-row" key={`${ids[index]}-${index}`}>
              <span className="uuid-index">{String(index + 1).padStart(2, '0')}</span>
              <code className="uuid-value">{id}</code>
              <IconButton
                label={`Copy identifier ${index + 1}`}
                onClick={() => {
                  void copy(id, 'Identifier copied')
                }}
              >
                <Icon name="copy" size={14} />
              </IconButton>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Namespaced identifier"
        footer="Deterministic IDs hash a namespace UUID with your name · RFC 9562 §5.3 and §5.5"
      >
        <div className="namespaced-form">
          <div className="namespaced-row">
            <label className="toolbar-label" htmlFor="uuid-namespace">
              Namespace
            </label>
            <select
              id="uuid-namespace"
              className="text-input select-input"
              value={namespace}
              onChange={(event) => {
                setNamespace(event.target.value as UuidNamespace | 'custom')
                setNamespaceError('')
              }}
            >
              {NAMESPACES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
            {namespace === 'custom' && (
              <input
                className="text-input mono namespaced-grow"
                aria-label="Custom namespace UUID"
                placeholder="00000000-0000-0000-0000-000000000000"
                value={customNamespace}
                onChange={(event) => {
                  setCustomNamespace(event.target.value)
                  setNamespaceError('')
                }}
              />
            )}
          </div>
          <div className="namespaced-row">
            <span className="toolbar-label">Version</span>
            <Segmented
              options={[
                { value: 'v3', label: 'v3 · MD5' },
                { value: 'v5', label: 'v5 · SHA-1' }
              ]}
              value={namespaceVersion}
              onChange={setNamespaceVersion}
              ariaLabel="Namespaced version"
            />
          </div>
          <div className="namespaced-row">
            <input
              className="text-input namespaced-grow"
              aria-label="Name to hash"
              placeholder="example.com or app/user/42"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setNamespaceError('')
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void addNamespacedId()
              }}
            />
            <Button variant="secondary" icon={<Icon name="plus" size={14} />} onClick={() => void addNamespacedId()}>
              Add
            </Button>
          </div>
          {namespaceError && <p className="field-error">{namespaceError}</p>}
        </div>
      </Panel>

      <Callout tone="info" title="Cryptographically random">
        Random kinds use the system CSPRNG, so collisions are practically impossible. Version 7
        UUIDs and ULIDs are time-ordered for sortable keys, while namespaced IDs stay stable for
        the same name and namespace.
      </Callout>
    </ToolPage>
  )
}
