import { useMemo, type ReactElement } from 'react'
import { Icon } from '../icons'
import { ToolPage } from '../components/ToolPage'
import { Button } from '../components/ui/Button'
import { CodeArea } from '../components/ui/CodeArea'
import { CopyButton } from '../components/ui/CopyButton'
import { SaveToHistory } from '../components/ui/SaveToHistory'
import { Callout } from '../components/ui/Panel'
import { Segmented } from '../components/ui/Segmented'
import { Toggle } from '../components/ui/Toggle'
import { usePersistentState } from '../hooks/usePersistentState'
import { jsonToYaml, yamlToJson } from '../lib/yaml'
import { getTool } from './registry'

type Mode = 'json-to-yaml' | 'yaml-to-json'

const MODES: ReadonlyArray<{ value: Mode; label: string }> = [
  { value: 'json-to-yaml', label: 'JSON → YAML' },
  { value: 'yaml-to-json', label: 'YAML → JSON' }
]

type IndentOption = '2' | '4'

const INDENT_OPTIONS: ReadonlyArray<{ value: IndentOption; label: string }> = [
  { value: '2', label: '2 spaces' },
  { value: '4', label: '4 spaces' }
]

const JSON_SAMPLE = `{
  "name": "all-in-one-dev-toolkit",
  "version": "0.3.0",
  "offline": true,
  "tools": ["json", "yaml", "diff", "regex"],
  "build": { "target": "nsis", "arch": ["x64"] },
  "features": { "theme": "cyber-blue", "telemetry": false }
}`

const YAML_SAMPLE = `name: all-in-one-dev-toolkit
version: 0.3.0
offline: true
tools:
  - json
  - yaml
  - diff
  - regex
build:
  target: nsis
  arch:
    - x64
`

export default function JsonYaml(): ReactElement {
  const tool = getTool('json-yaml')!
  const [mode, setMode] = usePersistentState<Mode>('json-yaml:mode', 'json-to-yaml')
  const [indent, setIndent] = usePersistentState<IndentOption>('json-yaml:indent', '2')
  const [sortKeys, setSortKeys] = usePersistentState('json-yaml:sortKeys', false)
  const [input, setInput] = usePersistentState('json-yaml:input', '')

  const toYaml = mode === 'json-to-yaml'
  const conversion = useMemo(() => {
    if (!input.trim()) return null
    return toYaml
      ? jsonToYaml(input, { indent: Number(indent) as 2 | 4, sortKeys })
      : yamlToJson(input, { indent: Number(indent) })
  }, [input, toYaml, indent, sortKeys])

  const output = conversion?.ok ? conversion.value : ''
  const error = conversion && !conversion.ok ? conversion.error : null

  const switchMode = (next: Mode): void => {
    if (next === mode) return
    if (output) {
      setInput(output)
    } else {
      setInput('')
    }
    setMode(next)
  }

  const swap = (): void => {
    if (!output) return
    setInput(output)
    setMode(toYaml ? 'yaml-to-json' : 'json-to-yaml')
  }

  const loadSample = (): void => {
    setInput(toYaml ? JSON_SAMPLE : YAML_SAMPLE)
    setSortKeys(false)
  }

  return (
    <ToolPage
      tool={tool}
      actions={
        <Button variant="secondary" icon={<Icon name="sparkles" size={15} />} onClick={loadSample}>
          Load example
        </Button>
      }
    >
      <div className="toolbar">
        <Segmented options={MODES} value={mode} onChange={switchMode} ariaLabel="Conversion direction" />
        <div className="toolbar-group">
          <span className="toolbar-label">Indent</span>
          <Segmented
            options={INDENT_OPTIONS}
            value={indent}
            onChange={setIndent}
            ariaLabel="Indentation"
          />
        </div>
        <Toggle checked={sortKeys} onChange={setSortKeys} label="Sort keys" disabled={!toYaml} />
        <div className="toolbar-group is-push">
          <Button
            variant="ghost"
            size="sm"
            icon={<Icon name="swap" size={14} />}
            onClick={swap}
            disabled={!output}
          >
            Use output as input
          </Button>
        </div>
      </div>

      <div className="split">
        <CodeArea
          label={toYaml ? 'JSON input' : 'YAML input'}
          ariaLabel={toYaml ? 'JSON input' : 'YAML input'}
          value={input}
          onChange={setInput}
          placeholder={
            toYaml
              ? 'Paste JSON to convert, e.g. {"name": "dev-toolkit"}'
              : 'Paste YAML to convert, e.g. name: dev-toolkit'
          }
          minHeight={380}
          wrap
          invalid={Boolean(error)}
          actions={
            <Button
              variant="ghost"
              size="sm"
              icon={<Icon name="trash" size={13} />}
              onClick={() => setInput('')}
              disabled={!input}
            >
              Clear
            </Button>
          }
        />

        <div className="stack">
          {error && (
            <Callout tone="error" title={toYaml ? 'Invalid JSON' : 'Invalid YAML'}>
              <span>{error.message}</span>
              {error.line !== undefined && (
                <div className="callout-meta">
                  Line {error.line}
                  {error.column !== undefined ? `, column ${error.column}` : ''}
                </div>
              )}
            </Callout>
          )}
          {!error && output && (
            <Callout tone="success" title={toYaml ? 'Valid JSON' : 'Valid YAML'}>
              Converted locally{mode === 'json-to-yaml' && sortKeys ? ' with keys sorted' : ''}.
            </Callout>
          )}
          <CodeArea
            label={toYaml ? 'YAML output' : 'JSON output'}
            ariaLabel={toYaml ? 'YAML output' : 'JSON output'}
            value={output}
            readOnly
            wrap
            minHeight={380}
            placeholder={toYaml ? 'YAML output appears here.' : 'JSON output appears here.'}
            actions={
              <>
                <SaveToHistory
                  toolId="json-yaml"
                  label={toYaml ? 'YAML from JSON' : 'JSON from YAML'}
                  value={output}
                />
                <CopyButton value={output} />
              </>
            }
            footerExtra={output ? <span>{toYaml ? 'YAML 1.2' : 'JSON'}</span> : undefined}
          />
        </div>
      </div>

      <Callout tone="info" title="Safe, standard conversions">
        YAML anchors are resolved and multi-document files become a JSON array. Strings that YAML
        would otherwise read as booleans or numbers stay quoted, so values survive the round trip.
      </Callout>
    </ToolPage>
  )
}
