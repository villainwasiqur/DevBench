import { useMemo, type ReactElement } from 'react'
import { Icon } from '../icons'
import { ToolPage } from '../components/ToolPage'
import { Button } from '../components/ui/Button'
import { CodeArea } from '../components/ui/CodeArea'
import { CopyButton } from '../components/ui/CopyButton'
import { Callout } from '../components/ui/Panel'
import { Segmented } from '../components/ui/Segmented'
import { usePersistentState } from '../hooks/usePersistentState'
import {
  formatSql,
  SQL_DIALECTS,
  type SqlDialect,
  type SqlKeywordCase
} from '../lib/sql'
import { getTool } from './registry'

const KEYWORD_CASES: ReadonlyArray<{ value: SqlKeywordCase; label: string }> = [
  { value: 'upper', label: 'UPPER' },
  { value: 'lower', label: 'lower' },
  { value: 'preserve', label: 'Keep' }
]

const INDENTS: ReadonlyArray<{ value: '2' | '4'; label: string }> = [
  { value: '2', label: '2 spaces' },
  { value: '4', label: '4 spaces' }
]

const SAMPLE = `select u.id, u.name, count(o.id) as order_count
from users u
left join orders o on o.user_id = u.id
where u.active = true and u.created_at >= '2025-01-01'
group by u.id, u.name
having count(o.id) > 0
order by order_count desc
limit 20;`

export default function SqlFormatter(): ReactElement {
  const tool = getTool('sql-formatter')!
  const [dialect, setDialect] = usePersistentState<SqlDialect>('sql-formatter:dialect', 'standard')
  const [keywordCase, setKeywordCase] = usePersistentState<SqlKeywordCase>(
    'sql-formatter:keywordCase',
    'upper'
  )
  const [indent, setIndent] = usePersistentState<'2' | '4'>('sql-formatter:indent', '2')
  const [input, setInput] = usePersistentState('sql-formatter:input', '')

  const result = useMemo(
    () =>
      formatSql(input, {
        dialect,
        keywordCase,
        tabWidth: indent === '2' ? 2 : 4
      }),
    [input, dialect, keywordCase, indent]
  )

  const output = result.ok ? result.output : ''

  return (
    <ToolPage
      tool={tool}
      actions={
        <Button
          variant="secondary"
          icon={<Icon name="sparkles" size={15} />}
          onClick={() => setInput(SAMPLE)}
        >
          Load example
        </Button>
      }
    >
      <div className="toolbar">
        <div className="toolbar-group">
          <span className="toolbar-label">Dialect</span>
          <Segmented options={SQL_DIALECTS} value={dialect} onChange={setDialect} ariaLabel="SQL dialect" />
        </div>
        <div className="toolbar-group">
          <span className="toolbar-label">Keywords</span>
          <Segmented
            options={KEYWORD_CASES}
            value={keywordCase}
            onChange={setKeywordCase}
            ariaLabel="Keyword case"
          />
        </div>
        <div className="toolbar-group">
          <span className="toolbar-label">Indent</span>
          <Segmented options={INDENTS} value={indent} onChange={setIndent} ariaLabel="Indent width" />
        </div>
      </div>

      <div className="split">
        <CodeArea
          label="SQL input"
          ariaLabel="SQL input"
          value={input}
          onChange={setInput}
          placeholder="Paste a query to format, e.g. select * from users where active = 1"
          minHeight={360}
          invalid={!result.ok}
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
          label="Formatted SQL"
          ariaLabel="Formatted SQL output"
          value={output}
          readOnly
          minHeight={360}
          invalid={!result.ok}
          placeholder="Formatted SQL appears here."
          actions={<CopyButton value={output} />}
        />
      </div>

      {!result.ok && (
        <Callout tone="error" title="Could not format this query">
          {result.error}
        </Callout>
      )}

      <Callout tone="info" title="Dialects and formatting">
        Formatting is whitespace-only — keywords, identifiers, and values keep their meaning.
        Choose the dialect that matches your database when using vendor-specific syntax such as
        backticks or <code>::</code> casts. Everything runs locally; nothing is sent anywhere.
      </Callout>
    </ToolPage>
  )
}
