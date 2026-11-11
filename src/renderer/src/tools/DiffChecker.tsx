import { useState, type ReactElement } from 'react'
import { Icon } from '../icons'
import { ToolPage } from '../components/ToolPage'
import { Button } from '../components/ui/Button'
import { CodeArea } from '../components/ui/CodeArea'
import { Callout } from '../components/ui/Panel'
import { Toggle } from '../components/ui/Toggle'
import { useToast } from '../components/ui/Toast'
import { usePersistentState } from '../hooks/usePersistentState'
import { diffLines, summarizeDiff, type DiffRow, type DiffSummary } from '../lib/diff'
import { getTool } from './registry'

const LEFT_SAMPLE = `function greet(name) {
  console.log("Hello, " + name)
}

greet("developer")
export default greet
`

const RIGHT_SAMPLE = `function greet(name, punctuation = "!") {
  console.log(\`Hello, \${name}\${punctuation}\`)
}

greet("developer")
greet("toolkit", "?")
export default greet
`

const MAX_RENDERED_ROWS = 3000

interface CompareResult {
  rows: DiffRow[]
  summary: DiffSummary
}

export default function DiffChecker(): ReactElement {
  const tool = getTool('diff-checker')!
  const { show } = useToast()
  const [left, setLeft] = usePersistentState('diff-checker:left', '')
  const [right, setRight] = usePersistentState('diff-checker:right', '')
  const [ignoreWhitespace, setIgnoreWhitespace] = usePersistentState(
    'diff-checker:ignoreWhitespace',
    false
  )
  const [ignoreCase, setIgnoreCase] = usePersistentState('diff-checker:ignoreCase', false)
  const [result, setResult] = useState<CompareResult | null>(null)

  const reset = (): void => setResult(null)

  const compare = (): void => {
    if (!left && !right) {
      show('Add text to at least one side first', 'error')
      return
    }

    const rows = diffLines(left, right, { ignoreWhitespace, ignoreCase })
    setResult({ rows, summary: summarizeDiff(rows) })
  }

  const loadSample = (): void => {
    setLeft(LEFT_SAMPLE)
    setRight(RIGHT_SAMPLE)
    setResult(null)
  }

  const swap = (): void => {
    setLeft(right)
    setRight(left)
    setResult(null)
  }

  const clearAll = (): void => {
    setLeft('')
    setRight('')
    setResult(null)
  }

  const hiddenRows = result ? Math.max(0, result.rows.length - MAX_RENDERED_ROWS) : 0

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
        <Toggle checked={ignoreWhitespace} onChange={setIgnoreWhitespace} label="Ignore whitespace" />
        <Toggle checked={ignoreCase} onChange={setIgnoreCase} label="Ignore case" />
        <div className="toolbar-group is-push">
          <Button
            variant="ghost"
            size="sm"
            icon={<Icon name="swap" size={14} />}
            onClick={swap}
            disabled={!left && !right}
          >
            Swap sides
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<Icon name="trash" size={13} />}
            onClick={clearAll}
            disabled={!left && !right && !result}
          >
            Clear
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Icon name="diff" size={14} />}
            onClick={compare}
            disabled={!left && !right}
          >
            Compare
          </Button>
        </div>
      </div>

      <div className="split">
        <CodeArea
          label="Original"
          ariaLabel="Original text"
          value={left}
          onChange={(value) => {
            setLeft(value)
            reset()
          }}
          placeholder="Paste the original text here…"
          minHeight={300}
          wrap
        />
        <CodeArea
          label="Changed"
          ariaLabel="Changed text"
          value={right}
          onChange={(value) => {
            setRight(value)
            reset()
          }}
          placeholder="Paste the changed text here…"
          minHeight={300}
          wrap
        />
      </div>

      {!result && (
        <Callout tone="info" title="Line-by-line comparison">
          Paste both versions and press Compare. Unchanged lines are dimmed, additions are green,
          and removals are red. Whitespace and case can be ignored when you only care about logic.
        </Callout>
      )}

      {result && !result.summary.changed && (
        <Callout tone="success" title="No differences">
          Both sides match{ignoreWhitespace || ignoreCase ? ' under the selected options' : ''}.{' '}
          {result.summary.unchanged.toLocaleString()} unchanged line
          {result.summary.unchanged === 1 ? '' : 's'}.
        </Callout>
      )}

      {result && result.summary.changed && (
        <div className="panel diff-panel">
          <header className="panel-header">
            <div className="panel-title">Differences</div>
            <div className="diff-stats" aria-label="Diff summary">
              <span className="diff-stat diff-stat-add">
                +{result.summary.added.toLocaleString()}
              </span>
              <span className="diff-stat diff-stat-remove">
                −{result.summary.removed.toLocaleString()}
              </span>
              <span className="diff-stat diff-stat-equal">
                {result.summary.unchanged.toLocaleString()} unchanged
              </span>
            </div>
          </header>
          <div className="diff-view" role="table" aria-label="Line differences">
            {result.rows.slice(0, MAX_RENDERED_ROWS).map((row, index) => (
              <div className={`diff-row diff-${row.type}`} role="row" key={index}>
                <span className="diff-num" role="cell">
                  {row.leftNumber ?? ''}
                </span>
                <span className="diff-num" role="cell">
                  {row.rightNumber ?? ''}
                </span>
                <span className="diff-sign" aria-hidden="true">
                  {row.type === 'add' ? '+' : row.type === 'remove' ? '−' : ''}
                </span>
                <code className="diff-text" role="cell">
                  {row.type === 'add' ? row.right : row.left}
                </code>
              </div>
            ))}
          </div>
          {hiddenRows > 0 && (
            <footer className="panel-footer">
              Showing the first {MAX_RENDERED_ROWS.toLocaleString()} rows ·{' '}
              {hiddenRows.toLocaleString()} more not displayed
            </footer>
          )}
        </div>
      )}
    </ToolPage>
  )
}
