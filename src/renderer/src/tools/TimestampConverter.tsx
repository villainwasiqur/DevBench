import { useMemo, type ReactElement } from 'react'
import { Icon } from '../icons'
import { ToolPage } from '../components/ToolPage'
import { Button, IconButton } from '../components/ui/Button'
import { CopyButton } from '../components/ui/CopyButton'
import { Panel } from '../components/ui/Panel'
import { useCopy } from '../hooks/useCopy'
import { useNow } from '../hooks/useNow'
import { usePersistentState } from '../hooks/usePersistentState'
import { formatRelativeTime } from '../lib/format'
import {
  durationBetween,
  formatCustom,
  formatInZone,
  isoWeek,
  offsetMinutes,
  parseDateInput,
  timeZoneOptions
} from '../lib/time'
import { getTool } from './registry'

const DEFAULT_FORMAT = 'YYYY-MM-DD HH:mm:ss Z'

export default function TimestampConverter(): ReactElement {
  const tool = getTool('timestamp-converter')!
  const now = useNow(1000)
  const { copy } = useCopy()
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const zones = useMemo(() => {
    const list = timeZoneOptions()
    return list.includes(localZone) ? list : [localZone, ...list]
  }, [localZone])

  const [raw, setRaw] = usePersistentState('time:input', () => String(Math.floor(Date.now() / 1000)))
  const [timeZone, setTimeZone] = usePersistentState('time:zone', localZone)
  const [pattern, setPattern] = usePersistentState('time:format', DEFAULT_FORMAT)
  const [fromRaw, setFromRaw] = usePersistentState('time:from', '')
  const [toRaw, setToRaw] = usePersistentState('time:to', '')

  const parsed = parseDateInput(raw)
  const zone = zones.includes(timeZone) ? timeZone : localZone

  const nowTime = formatCustom(now, zone, 'HH:mm:ss')
  const nowDate = formatInZone(now, zone, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
  const utcTime = formatInZone(now, 'UTC', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  const customValue = parsed ? formatCustom(parsed, zone, pattern) : ''
  const week = parsed ? isoWeek(parsed, zone) : null
  const offset = parsed ? offsetMinutes(parsed, zone) : 0

  const outputs = parsed
    ? [
        ...(customValue ? [{ label: 'Custom format', value: customValue }] : []),
        { label: `Time in ${zone}`, value: formatInZone(parsed, zone, { dateStyle: 'full', timeStyle: 'long' }) },
        { label: 'UTC time', value: formatInZone(parsed, 'UTC', { dateStyle: 'full', timeStyle: 'long' }) },
        { label: 'ISO 8601', value: parsed.toISOString() },
        {
          label: 'ISO week',
          value: week ? `${week.year}-W${String(week.week).padStart(2, '0')}` : '—'
        },
        {
          label: 'UTC offset',
          value: `UTC${offset >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')}:${String(Math.abs(offset) % 60).padStart(2, '0')}`
        },
        { label: 'Unix seconds', value: String(Math.floor(parsed.getTime() / 1000)) },
        { label: 'Unix milliseconds', value: String(parsed.getTime()) },
        { label: 'Relative', value: formatRelativeTime(parsed, now) }
      ]
    : []

  const durationFrom = parseDateInput(fromRaw)
  const durationTo = parseDateInput(toRaw)
  const duration =
    durationFrom && durationTo ? durationBetween(durationFrom, durationTo) : null

  const useNowFor = (kind: 'from' | 'to'): void => {
    const value = String(Math.floor(Date.now() / 1000))
    if (kind === 'from') setFromRaw(value)
    else setToRaw(value)
  }

  return (
    <ToolPage
      tool={tool}
      actions={
        <Button
          variant="secondary"
          icon={<Icon name="clock" size={14} />}
          onClick={() => setRaw(String(Math.floor(Date.now() / 1000)))}
        >
          Use current time
        </Button>
      }
    >
      <section className="clock-card">
        <div className="clock-main">
          <span className="clock-eyebrow">
            <span className="live-dot" /> Live · {zone}
          </span>
          <span className="clock-time">{nowTime}</span>
          <span className="clock-date">{nowDate}</span>
        </div>
        <div className="clock-side">
          <div className="clock-stat">
            <span>UTC</span>
            <code>{utcTime}</code>
          </div>
          <div className="clock-stat">
            <span>Unix</span>
            <code>{Math.floor(now.getTime() / 1000)}</code>
          </div>
        </div>
      </section>

      <div className="toolbar">
        <div className="toolbar-group">
          <label className="toolbar-label" htmlFor="time-zone">
            Time zone
          </label>
          <select
            id="time-zone"
            className="text-input select-input time-zone-select"
            value={zone}
            onChange={(event) => setTimeZone(event.target.value)}
          >
            {zones.map((entry) => (
              <option key={entry} value={entry}>
                {entry.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div className="toolbar-group time-format-group">
          <label className="toolbar-label" htmlFor="time-format">
            Format
          </label>
          <input
            id="time-format"
            className="text-input mono time-format-input"
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
            placeholder={DEFAULT_FORMAT}
            aria-label="Custom date format"
            spellCheck={false}
          />
        </div>
        <div className="toolbar-group is-push">
          <span className="toolbar-hint">YYYY MM DD HH mm ss Z · [literal]</span>
        </div>
      </div>

      <div className="split">
        <Panel
          title="Timestamp or date"
          actions={
            <Button
              variant="ghost"
              size="sm"
              icon={<Icon name="refresh" size={13} />}
              onClick={() => setRaw(String(Math.floor(Date.now() / 1000)))}
            >
              Now
            </Button>
          }
        >
          <div className="stack-sm">
            <input
              className={`text-input mono${raw.trim() && !parsed ? ' is-invalid' : ''}`}
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
              placeholder="1700000000 or 2026-11-02T10:00:00Z"
              aria-label="Timestamp or date"
              spellCheck={false}
            />
            <span className="field-hint">
              Unix seconds, milliseconds, ISO 8601, or any parseable date string.
            </span>
            {!raw.trim() && <span className="field-error">Enter a value to convert.</span>}
            {raw.trim() && !parsed && (
              <span className="field-error">
                That value could not be parsed as a date or timestamp.
              </span>
            )}
          </div>
        </Panel>

        <Panel
          title="Converted values"
          actions={
            parsed ? <CopyButton value={parsed.toISOString()} label="Copy ISO" /> : undefined
          }
        >
          {parsed ? (
            <div className="output-list">
              {outputs.map((item) => (
                <div className="output-row" key={item.label}>
                  <div className="output-info">
                    <span className="output-label">{item.label}</span>
                    <code className="output-value">{item.value}</code>
                  </div>
                  <IconButton
                    label={`Copy ${item.label}`}
                    onClick={() => {
                      void copy(item.value, `${item.label} copied`)
                    }}
                  >
                    <Icon name="copy" size={14} />
                  </IconButton>
                </div>
              ))}
            </div>
          ) : (
            <span className="panel-placeholder">Conversion appears here.</span>
          )}
        </Panel>
      </div>

      <Panel
        title="Duration between two moments"
        footer="Both fields accept Unix seconds, milliseconds, ISO 8601, or parseable dates."
      >
        <div className="duration-grid">
          <div className="stack-sm">
            <label className="toolbar-label" htmlFor="duration-from">
              From
            </label>
            <div className="duration-input-row">
              <input
                id="duration-from"
                className={`text-input mono${fromRaw.trim() && !durationFrom ? ' is-invalid' : ''}`}
                value={fromRaw}
                onChange={(event) => setFromRaw(event.target.value)}
                placeholder="1700000000"
                spellCheck={false}
              />
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="clock" size={13} />}
                onClick={() => useNowFor('from')}
              >
                Now
              </Button>
            </div>
            {fromRaw.trim() && !durationFrom && (
              <span className="field-error">Could not parse that value.</span>
            )}
          </div>
          <div className="stack-sm">
            <label className="toolbar-label" htmlFor="duration-to">
              To
            </label>
            <div className="duration-input-row">
              <input
                id="duration-to"
                className={`text-input mono${toRaw.trim() && !durationTo ? ' is-invalid' : ''}`}
                value={toRaw}
                onChange={(event) => setToRaw(event.target.value)}
                placeholder="1800000000"
                spellCheck={false}
              />
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="clock" size={13} />}
                onClick={() => useNowFor('to')}
              >
                Now
              </Button>
            </div>
            {toRaw.trim() && !durationTo && (
              <span className="field-error">Could not parse that value.</span>
            )}
          </div>
        </div>

        {duration ? (
          <div className="duration-result">
            <span className="duration-headline">
              {duration.human}
              {duration.negative ? ' earlier' : ' later'}
            </span>
            <div className="meta-grid">
              <div className="meta-card">
                <span className="meta-label">Total weeks</span>
                <span className="meta-value">{duration.totalWeeks}</span>
              </div>
              <div className="meta-card">
                <span className="meta-label">Total days</span>
                <span className="meta-value">{duration.totalDays}</span>
              </div>
              <div className="meta-card">
                <span className="meta-label">Total hours</span>
                <span className="meta-value">{duration.totalHours}</span>
              </div>
              <div className="meta-card">
                <span className="meta-label">Total seconds</span>
                <span className="meta-value">{duration.totalSeconds}</span>
              </div>
            </div>
          </div>
        ) : (
          <span className="panel-placeholder">
            Fill both fields to calculate the elapsed time.
          </span>
        )}
      </Panel>

      <p className="tool-footnote">
        Conversions use the {zone} time zone. Unix values are absolute and time-zone independent.
        Values with 11 or more digits are treated as milliseconds.
      </p>
    </ToolPage>
  )
}
