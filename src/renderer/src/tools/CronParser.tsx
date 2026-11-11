import { useMemo, useState, type ReactElement } from 'react'
import { Icon } from '../icons'
import { ToolPage } from '../components/ToolPage'
import { Button } from '../components/ui/Button'
import { Callout, Panel } from '../components/ui/Panel'
import { usePersistentState } from '../hooks/usePersistentState'
import { analyzeCron } from '../lib/cron'
import { getTool } from './registry'

const runFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

export default function CronParser(): ReactElement {
  const tool = getTool('cron-parser')!
  const [expression, setExpression] = usePersistentState('cron-parser:expression', '*/15 * * * *')
  const [tick, setTick] = useState(0)
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const analysis = useMemo(
    () => analyzeCron(expression, { count: 5 }),
    [expression, tick]
  )

  return (
    <ToolPage
      tool={tool}
      actions={
        <>
          <Button
            variant="secondary"
            icon={<Icon name="sparkles" size={15} />}
            onClick={() => setExpression('0 9 * * 1-5')}
          >
            Load example
          </Button>
          <Button
            variant="ghost"
            icon={<Icon name="refresh" size={14} />}
            onClick={() => setTick((value) => value + 1)}
          >
            Refresh times
          </Button>
        </>
      }
    >
      <div className="cron-input-row">
        <span className="cron-input-label">Expression</span>
        <input
          className={`text-input mono cron-input${analysis.ok ? '' : ' is-invalid'}`}
          value={expression}
          onChange={(event) => setExpression(event.target.value)}
          aria-label="Cron expression"
          placeholder="*/15 * * * *"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
      </div>

      {analysis.ok ? (
        <>
          <div className="split">
            <Panel title="Plain English">
              <p className="cron-summary">{analysis.summary}</p>
              <div className="cron-field-list">
                {analysis.details.map((detail) => (
                  <div className="cron-field-row" key={detail.label}>
                    <span className="output-label">{detail.label}</span>
                    <span className="cron-field-value">{detail.text}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title={`Next ${analysis.nextRuns.length || 5} runs`}>
              {analysis.nextRuns.length > 0 ? (
                <div className="cron-runs">
                  {analysis.nextRuns.map((run, index) => (
                    <div className="cron-run-row" key={run.toISOString()}>
                      <span className="cron-run-index">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="cron-run-time">{runFormatter.format(run)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="panel-placeholder">
                  No run occurs within the next 366 days.
                </span>
              )}
            </Panel>
          </div>

          {analysis.notes.map((note) => (
            <Callout key={note} tone="warning" title="Good to know">
              {note}
            </Callout>
          ))}
        </>
      ) : (
        <Callout tone="error" title="Could not parse this expression">
          {analysis.error}
        </Callout>
      )}

      <Callout tone="info" title="Standard five-field cron">
        Fields are minute, hour, day of month, month, and day of week. Ranges, lists, steps, month
        and weekday names, and @hourly-style aliases are supported. Times use the {timeZone} time
        zone; seconds are not supported.
      </Callout>
    </ToolPage>
  )
}
