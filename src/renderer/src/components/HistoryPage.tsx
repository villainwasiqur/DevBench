import { useMemo, type ReactElement } from 'react'
import { Icon } from '../icons'
import {
  clearAllHistory,
  clearToolHistory,
  removeHistory,
  togglePin,
  useHistory,
  type HistoryEntry
} from '../lib/history'
import { getTool } from '../tools/registry'
import { Button, IconButton } from './ui/Button'
import { CopyButton } from './ui/CopyButton'
import { Panel } from './ui/Panel'
import { useToast } from './ui/Toast'

function formatWhen(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function groupByTool(entries: HistoryEntry[]): Array<[string, HistoryEntry[]]> {
  const groups = new Map<string, HistoryEntry[]>()
  const ordered = [...entries].sort(
    (left, right) => Number(right.pinned) - Number(left.pinned) || right.createdAt - left.createdAt
  )
  for (const entry of ordered) {
    const group = groups.get(entry.toolId)
    if (group) group.push(entry)
    else groups.set(entry.toolId, [entry])
  }
  return [...groups.entries()]
}

export function HistoryPage(): ReactElement {
  const history = useHistory()
  const toast = useToast()
  const groups = useMemo(() => groupByTool(history), [history])

  return (
    <div className="page history-page">
      <header className="settings-head">
        <span className="eyebrow">
          <Icon name="history" size={14} />
          Working set
        </span>
        <h1>Saved outputs</h1>
        <p>
          Outputs you explicitly save stay on this device. Tools that handle tokens or keys cannot
          be saved here.
        </p>
      </header>

      {history.length > 0 && (
        <div className="history-toolbar">
          <span className="inline-note">
            <Icon name="bookmark" size={13} />
            {history.length} saved output{history.length === 1 ? '' : 's'}
          </span>
          <Button
            size="sm"
            variant="danger"
            icon={<Icon name="trash" size={13} />}
            onClick={() => {
              if (!window.confirm('Clear every saved output from the working set?')) return
              clearAllHistory()
              toast.show('Working set cleared.', 'success')
            }}
          >
            Clear all
          </Button>
        </div>
      )}

      {groups.length === 0 ? (
        <Panel title="Nothing saved yet">
          <div className="history-empty">
            <Icon name="bookmark" size={26} />
            <strong>Save an output to build your working set.</strong>
            <span>
              Look for the <strong>Save</strong> button beside results in the JSON, YAML, SQL,
              Regex, Base64, URL, and HTML tools.
            </span>
          </div>
        </Panel>
      ) : (
        groups.map(([toolId, entries]) => {
          const tool = getTool(toolId)
          return (
            <Panel
              key={toolId}
              title={tool?.name ?? toolId}
              actions={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    clearToolHistory(toolId)
                    toast.show(`${tool?.name ?? toolId} history cleared.`, 'success')
                  }}
                >
                  Clear tool
                </Button>
              }
            >
              <ul className="history-list">
                {entries.map((entry) => (
                  <li className="history-entry" key={entry.id}>
                    <div className="history-entry-head">
                      <span className="history-label">{entry.label}</span>
                      <span className="history-time">{formatWhen(entry.createdAt)}</span>
                      <IconButton
                        label={entry.pinned ? 'Unpin saved output' : 'Pin saved output'}
                        active={entry.pinned}
                        aria-pressed={entry.pinned}
                        onClick={() => togglePin(entry.id)}
                      >
                        <Icon
                          name="star"
                          size={15}
                          fill={entry.pinned ? 'currentColor' : 'none'}
                        />
                      </IconButton>
                      <IconButton
                        label="Delete saved output"
                        onClick={() => {
                          removeHistory(entry.id)
                          toast.show('Saved output removed.', 'success')
                        }}
                      >
                        <Icon name="trash" size={15} />
                      </IconButton>
                    </div>
                    <pre className="history-value">{entry.value}</pre>
                    <div className="history-entry-foot">
                      <CopyButton value={entry.value} label="Copy output" />
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )
        })
      )}
    </div>
  )
}
