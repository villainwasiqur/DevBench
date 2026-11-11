import { useMemo, type ReactElement } from 'react'
import { Icon } from '../icons'
import { ToolPage } from '../components/ToolPage'
import { Button } from '../components/ui/Button'
import { CodeArea } from '../components/ui/CodeArea'
import { CopyButton } from '../components/ui/CopyButton'
import { Callout } from '../components/ui/Panel'
import { Segmented } from '../components/ui/Segmented'
import { Toggle } from '../components/ui/Toggle'
import { usePersistentState } from '../hooks/usePersistentState'
import { decodeHtmlEntities, encodeHtmlEntities } from '../lib/htmlEntities'
import { getTool } from './registry'

type Mode = 'encode' | 'decode'

const MODES: ReadonlyArray<{ value: Mode; label: string }> = [
  { value: 'encode', label: 'Encode' },
  { value: 'decode', label: 'Decode' }
]

const ENCODE_SAMPLE = `<p class="note">Café & "quotes" — 5 > 3</p>`
const DECODE_SAMPLE = `<p class="note">Caf&eacute; &amp; &quot;quotes&quot; &mdash; 5 &gt; 3</p>`

export default function HtmlEntities(): ReactElement {
  const tool = getTool('html-entities')!
  const [mode, setMode] = usePersistentState<Mode>('html-entities:mode', 'encode')
  const [named, setNamed] = usePersistentState('html-entities:named', true)
  const [encodeAll, setEncodeAll] = usePersistentState('html-entities:encodeAll', false)
  const [input, setInput] = usePersistentState('html-entities:input', '')

  const conversion = useMemo(() => {
    if (!input) return { output: '', error: '' }
    try {
      const output =
        mode === 'encode'
          ? encodeHtmlEntities(input, { named, encodeAll })
          : decodeHtmlEntities(input)
      return { output, error: '' }
    } catch (error) {
      return {
        output: '',
        error: error instanceof Error ? error.message : 'Unable to convert this text.'
      }
    }
  }, [input, mode, named, encodeAll])

  const swap = (): void => {
    if (!conversion.output) return
    setInput(conversion.output)
    setMode(mode === 'encode' ? 'decode' : 'encode')
  }

  const loadSample = (): void => {
    setInput(mode === 'encode' ? ENCODE_SAMPLE : DECODE_SAMPLE)
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
        <Segmented options={MODES} value={mode} onChange={setMode} ariaLabel="Conversion mode" />
        <Toggle
          checked={named}
          onChange={setNamed}
          label="Named references"
          disabled={mode === 'decode'}
        />
        <Toggle
          checked={encodeAll}
          onChange={setEncodeAll}
          label="Encode every character"
          disabled={mode === 'decode'}
        />
        <div className="toolbar-group is-push">
          <Button
            variant="ghost"
            size="sm"
            icon={<Icon name="swap" size={14} />}
            onClick={swap}
            disabled={!conversion.output}
          >
            Use output as input
          </Button>
        </div>
      </div>

      <div className="split">
        <CodeArea
          label={mode === 'encode' ? 'Plain text / HTML' : 'Text with entities'}
          ariaLabel={mode === 'encode' ? 'Text to encode' : 'Text to decode'}
          value={input}
          onChange={setInput}
          placeholder={
            mode === 'encode'
              ? 'Paste markup or text to escape, e.g. <p>Tom & Jerry</p>'
              : 'Paste encoded text, e.g. &lt;p&gt;Tom &amp; Jerry&lt;/p&gt;'
          }
          minHeight={340}
          wrap
          invalid={Boolean(conversion.error)}
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
          label={mode === 'encode' ? 'Encoded output' : 'Decoded text'}
          ariaLabel="Conversion output"
          value={conversion.output}
          readOnly
          wrap
          minHeight={340}
          invalid={Boolean(conversion.error)}
          placeholder={
            mode === 'encode'
              ? 'Encoded entities appear here.'
              : 'Decoded text appears here.'
          }
          actions={<CopyButton value={conversion.output} />}
          footerExtra={
            conversion.output ? (
              <span>
                {conversion.output.length.toLocaleString()} chars
                {mode === 'encode' && encodeAll ? ' · all characters' : ''}
              </span>
            ) : undefined
          }
        />
      </div>

      {conversion.error && (
        <Callout tone="error" title="Conversion failed">
          {conversion.error}
        </Callout>
      )}

      <Callout tone="info" title="Entities are text, not protection">
        Encoding replaces characters such as <code>&lt;</code>, <code>&gt;</code>, and{' '}
        <code>&amp;</code> with references the HTML parser reads as text. It keeps markup safe to
        display, but it does not sanitize or encrypt anything.
      </Callout>
    </ToolPage>
  )
}
