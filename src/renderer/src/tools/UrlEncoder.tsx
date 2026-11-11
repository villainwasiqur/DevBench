import { useMemo, type ReactElement } from 'react'
import { Icon } from '../icons'
import { ToolPage } from '../components/ToolPage'
import { Button } from '../components/ui/Button'
import { CodeArea } from '../components/ui/CodeArea'
import { CopyButton } from '../components/ui/CopyButton'
import { Callout, Panel } from '../components/ui/Panel'
import { Segmented } from '../components/ui/Segmented'
import { usePersistentState } from '../hooks/usePersistentState'
import { convertUrl, parseQueryParams, type UrlMode, type UrlScope } from '../lib/url'
import { getTool } from './registry'

const MODES: ReadonlyArray<{ value: UrlMode; label: string }> = [
  { value: 'encode', label: 'Encode' },
  { value: 'decode', label: 'Decode' }
]

const SCOPES: ReadonlyArray<{ value: UrlScope; label: string }> = [
  { value: 'component', label: 'Query component' },
  { value: 'form', label: 'Form body' },
  { value: 'url', label: 'Full URL' }
]

const SCOPE_HINTS: Record<UrlScope, string> = {
  component:
    'Encodes reserved characters too, which is right for query values and path segments. Spaces become %20.',
  form: 'Follows application/x-www-form-urlencoded: spaces become + and ampersands, equals signs, and other reserved characters are percent-encoded.',
  url: 'Keeps URL structure such as :// ? & = intact, pairing well with whole links. Spaces become %20.'
}

export default function UrlEncoder(): ReactElement {
  const tool = getTool('url-encoder')!
  const [mode, setMode] = usePersistentState<UrlMode>('url-encoder:mode', 'encode')
  const [scope, setScope] = usePersistentState<UrlScope>('url-encoder:scope', 'component')
  const [input, setInput] = usePersistentState('url-encoder:input', '')

  const conversion = useMemo(() => convertUrl(input, mode, scope), [input, mode, scope])
  const output = conversion.ok ? conversion.output : ''
  const breakdown = useMemo(() => parseQueryParams(input), [input])
  const showBreakdown = input.includes('?') || input.includes('=') || input.includes('&')

  const paramsJson = breakdown.ok
    ? JSON.stringify(
        breakdown.params.map(({ key, value, hasValue }) => ({ key, value, hasValue })),
        null,
        2
      )
    : ''

  const swap = (): void => {
    if (!output) return
    setInput(output)
    setMode(mode === 'encode' ? 'decode' : 'encode')
  }

  return (
    <ToolPage
      tool={tool}
      actions={
        <Button
          variant="secondary"
          icon={<Icon name="sparkles" size={15} />}
          onClick={() => {
            setMode('encode')
            setScope('component')
            setInput('hello world & friends / 100% ready?page=2&tag=dev tools')
          }}
        >
          Load example
        </Button>
      }
    >
      <div className="toolbar">
        <Segmented options={MODES} value={mode} onChange={setMode} ariaLabel="Conversion mode" />
        <Segmented options={SCOPES} value={scope} onChange={setScope} ariaLabel="Encoding scope" />
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
          label={mode === 'encode' ? 'Raw input' : 'Encoded input'}
          ariaLabel="URL input"
          value={input}
          onChange={setInput}
          placeholder={
            mode === 'encode'
              ? 'Type a URL or query value to encode…'
              : 'Paste percent-encoded text to decode…'
          }
          minHeight={320}
          wrap
          invalid={!conversion.ok}
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

        <CodeArea
          label={mode === 'encode' ? 'Encoded output' : 'Decoded output'}
          ariaLabel="URL output"
          value={output}
          readOnly
          wrap
          minHeight={320}
          invalid={!conversion.ok}
          placeholder="Converted value appears here."
          actions={<CopyButton value={output} />}
        />
      </div>

      {!conversion.ok && (
        <Callout tone="error" title="Conversion failed">
          {conversion.error}
        </Callout>
      )}

      {showBreakdown && (
        <Panel
          title={`Query parameters${breakdown.ok ? ` · ${breakdown.params.length}` : ''}`}
          actions={
            <CopyButton
              value={paramsJson}
              label="Copy JSON"
              disabled={!breakdown.ok || breakdown.params.length === 0}
            />
          }
          footer={
            breakdown.ok && breakdown.base
              ? `Base: ${breakdown.base}${breakdown.hash ? ` · Hash: #${breakdown.hash}` : ''}`
              : undefined
          }
        >
          {breakdown.ok ? (
            breakdown.params.length > 0 ? (
              <div className="param-list">
                {breakdown.params.map((param, index) => (
                  <div className="param-row" key={`${index}-${param.key}`}>
                    <code className="param-key">{param.key || '""'}</code>
                    <span className="param-equals">=</span>
                    {param.hasValue ? (
                      <code className="param-value">{param.value || '""'}</code>
                    ) : (
                      <span className="param-flag">no value</span>
                    )}
                    <span className="param-raw">{param.raw}</span>
                  </div>
                ))}
                {breakdown.truncated && (
                  <span className="field-hint">Showing the first 200 parameters.</span>
                )}
              </div>
            ) : (
              <span className="panel-placeholder">No parameters found in this input.</span>
            )
          ) : (
            <span className="field-error">{breakdown.error}</span>
          )}
        </Panel>
      )}

      <Callout tone="info" title={SCOPES.find((item) => item.value === scope)?.label ?? 'Encoding'}>
        {SCOPE_HINTS[scope]} Query parameters are decoded for the breakdown above, so + becomes a
        space and percent escapes resolve to readable text.
      </Callout>
    </ToolPage>
  )
}
