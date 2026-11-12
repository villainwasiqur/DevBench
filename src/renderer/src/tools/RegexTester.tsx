import { useMemo, type ReactElement, type ReactNode } from 'react'
import { Icon } from '../icons'
import { ToolPage } from '../components/ToolPage'
import { Button } from '../components/ui/Button'
import { CodeArea } from '../components/ui/CodeArea'
import { CopyButton } from '../components/ui/CopyButton'
import { SaveToHistory } from '../components/ui/SaveToHistory'
import { Callout, Panel } from '../components/ui/Panel'
import { Toggle } from '../components/ui/Toggle'
import { usePersistentState } from '../hooks/usePersistentState'
import { buildFlagString, findMatches, replaceMatches } from '../lib/regex'
import { getTool } from './registry'

const SAMPLE_PATTERN = '(?<user>[\\w.]+)@(?<host>[\\w-]+\\.[a-z]{2,})'
const SAMPLE_TEXT = `Reach the team at dev@toolkit.local or support@example.com.
Invalid addresses: not-an-email, @missing.user, hello@.

Backups: ops@dev-toolkit.io, security@dev-toolkit.io`
const DEFAULT_REPLACEMENT = '$<user> [at] $<host>'

const MAX_LISTED_MATCHES = 100

function ValueChip({ label, value }: { label: string; value?: string }): ReactElement {
  return (
    <span className={`match-chip${value === undefined ? ' is-empty' : ''}`}>
      <span className="match-chip-label">{label}</span>
      <code>{value === undefined ? 'not matched' : value === '' ? 'empty string' : value}</code>
    </span>
  )
}

export default function RegexTester(): ReactElement {
  const tool = getTool('regex-tester')!
  const [pattern, setPattern] = usePersistentState('regex-tester:pattern', SAMPLE_PATTERN)
  const [text, setText] = usePersistentState('regex-tester:text', SAMPLE_TEXT)
  const [ignoreCase, setIgnoreCase] = usePersistentState('regex-tester:ignoreCase', true)
  const [multiline, setMultiline] = usePersistentState('regex-tester:multiline', false)
  const [dotAll, setDotAll] = usePersistentState('regex-tester:dotAll', false)
  const [unicode, setUnicode] = usePersistentState('regex-tester:unicode', false)
  const [replacement, setReplacement] = usePersistentState(
    'regex-tester:replacement',
    DEFAULT_REPLACEMENT
  )

  const options = { ignoreCase, multiline, dotAll, unicode }
  const result = useMemo(
    () => (pattern ? findMatches(pattern, options, text) : null),
    [pattern, text, ignoreCase, multiline, dotAll, unicode]
  )
  const replaceResult = useMemo(
    () => (pattern ? replaceMatches(pattern, options, text, replacement) : null),
    [pattern, text, ignoreCase, multiline, dotAll, unicode, replacement]
  )

  const matches = result?.ok ? result.matches : []
  const truncated = result?.ok ? result.truncated : false
  const error = result && !result.ok ? result.error : ''
  const flags = buildFlagString(options)

  const loadSample = (): void => {
    setPattern(SAMPLE_PATTERN)
    setText(SAMPLE_TEXT)
    setIgnoreCase(true)
    setMultiline(false)
    setDotAll(false)
    setUnicode(false)
    setReplacement(DEFAULT_REPLACEMENT)
  }

  const highlighted = useMemo(() => {
    if (!text || matches.length === 0) return text
    const nodes: ReactNode[] = []
    let cursor = 0

    matches.forEach((match, index) => {
      if (match.index < cursor) return
      if (match.index > cursor) {
        nodes.push(<span key={`text-${index}`}>{text.slice(cursor, match.index)}</span>)
      }
      if (match.length > 0) {
        nodes.push(
          <mark key={`hit-${index}`} className="regex-hit">
            {text.slice(match.index, match.index + match.length)}
          </mark>
        )
      }
      cursor = Math.max(cursor, match.index + match.length)
    })

    if (cursor < text.length) {
      nodes.push(<span key="tail">{text.slice(cursor)}</span>)
    }

    return nodes
  }, [text, matches])

  return (
    <ToolPage
      tool={tool}
      actions={
        <Button variant="secondary" icon={<Icon name="sparkles" size={15} />} onClick={loadSample}>
          Load example
        </Button>
      }
    >
      <div className="regex-bar">
        <span className="regex-delimiter">/</span>
        <input
          className={`text-input mono regex-input${error ? ' is-invalid' : ''}`}
          value={pattern}
          onChange={(event) => setPattern(event.target.value)}
          placeholder="Enter a regular expression…"
          aria-label="Regular expression"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <span className={`regex-delimiter${error ? ' is-invalid' : ''}`}>/{flags}</span>
      </div>

      <div className="toolbar">
        <Toggle checked={ignoreCase} onChange={setIgnoreCase} label="Case insensitive (i)" />
        <Toggle checked={multiline} onChange={setMultiline} label="Multiline (m)" />
        <Toggle checked={dotAll} onChange={setDotAll} label="Dot matches newline (s)" />
        <Toggle checked={unicode} onChange={setUnicode} label="Unicode (u)" />
        <div className="toolbar-group is-push">
          <span className="inline-note" aria-live="polite">
            <Icon name="regex" size={13} />
            {!pattern
              ? 'Enter a pattern'
              : error
                ? 'Pattern error'
                : `${matches.length.toLocaleString()}${truncated ? '+' : ''} match${matches.length === 1 ? '' : 'es'}`}
          </span>
        </div>
      </div>

      <div className="split">
        <CodeArea
          label="Test text"
          ariaLabel="Test text"
          value={text}
          onChange={setText}
          placeholder="Paste the text you want to test against…"
          minHeight={320}
          wrap
          actions={
            <Button
              variant="ghost"
              size="sm"
              icon={<Icon name="trash" size={13} />}
              onClick={() => setText('')}
              disabled={!text}
            >
              Clear
            </Button>
          }
        />

        <div className="stack">
          {error && (
            <Callout tone="error" title="Regular expression error">
              {error}
            </Callout>
          )}

          <Panel
            title="Highlighted matches"
            footer={
              matches.length > 0
                ? `${matches.length.toLocaleString()} match${matches.length === 1 ? '' : 'es'} highlighted`
                : 'Matches are highlighted in place.'
            }
          >
            {text ? (
              <pre className="regex-preview" aria-label="Highlighted test text">
                {highlighted}
              </pre>
            ) : (
              <span className="panel-placeholder">Paste text to see matches highlighted.</span>
            )}
          </Panel>

          <Panel
            title="Replacement preview"
            actions={
              <>
                <SaveToHistory
                  toolId="regex-tester"
                  label="Regex replacement"
                  value={replaceResult?.ok ? replaceResult.output : ''}
                />
                <CopyButton
                  value={replaceResult?.ok ? replaceResult.output : ''}
                  label="Copy result"
                />
              </>
            }
            footer={
              replaceResult?.ok
                ? `${replaceResult.replacements.toLocaleString()} replacement${replaceResult.replacements === 1 ? '' : 's'}`
                : 'Use $1, $&, or $<name> to reference matches.'
            }
          >
            <label className="regex-replace-field">
              <span>Replace with</span>
              <input
                className="text-input mono"
                value={replacement}
                onChange={(event) => setReplacement(event.target.value)}
                placeholder="Replacement pattern…"
                aria-label="Replacement pattern"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
              />
            </label>
            {replaceResult?.ok && text ? (
              <pre className="regex-preview" aria-label="Replacement result">
                {replaceResult.output || '(empty result)'}
              </pre>
            ) : (
              <span className="panel-placeholder">Enter a pattern and text to preview a replacement.</span>
            )}
          </Panel>
        </div>
      </div>

      {matches.length > 0 && (
        <Panel
          title={`Match details (${matches.length.toLocaleString()})`}
          footer={
            matches.length > MAX_LISTED_MATCHES
              ? `Showing the first ${MAX_LISTED_MATCHES} of ${matches.length.toLocaleString()} matches.`
              : undefined
          }
        >
          <div className="match-list">
            {matches.slice(0, MAX_LISTED_MATCHES).map((match, index) => (
              <div className="match-card" key={`${match.index}-${index}`}>
                <div className="match-card-head">
                  <span className="match-index">#{index + 1}</span>
                  <span className="match-range">
                    index {match.index.toLocaleString()} · {match.length} chars
                  </span>
                </div>
                <code className="match-value">{match.value || '(empty match)'}</code>
                {match.groups.length > 0 && (
                  <div className="match-groups">
                    {match.groups.map((group, groupIndex) => (
                      <ValueChip
                        key={groupIndex}
                        label={group.name ?? `$${groupIndex + 1}`}
                        value={group.value}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {!error && text && matches.length === 0 && (
        <Callout tone="warning" title="No matches">
          The pattern is valid but nothing matched. Check anchors, flags, or try a looser pattern.
        </Callout>
      )}

      <Callout tone="info" title="A quick reminder">
        Patterns run locally with JavaScript regex semantics. Flags: <code>i</code> ignores case,{' '}
        <code>m</code> makes <code>^</code> and <code>$</code> match per line, <code>s</code> lets{' '}
        <code>.</code> cross newlines, and <code>u</code> enables Unicode mode. Matching stops after
        500 results to keep the interface responsive.
      </Callout>
    </ToolPage>
  )
}
