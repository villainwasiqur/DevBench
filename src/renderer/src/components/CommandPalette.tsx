import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { Icon } from '../icons'
import { bestFuzzyScore } from '../lib/fuzzy'
import { useFavorites, useRecentTools } from '../lib/prefs'
import { TOOLS, type ToolDef } from '../tools/registry'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onNavigate: (id: string) => void
}

interface Section {
  title: string
  tools: ToolDef[]
}

type Row =
  | { kind: 'heading'; key: string; title: string }
  | { kind: 'tool'; key: string; tool: ToolDef; index: number }

const READY = TOOLS.filter((tool) => tool.status === 'ready')
const BY_ID = new Map(TOOLS.map((tool) => [tool.id, tool]))

function pickTools(ids: string[]): ToolDef[] {
  return ids.flatMap((id) => {
    const tool = BY_ID.get(id)
    return tool ? [tool] : []
  })
}

export function CommandPalette({
  open,
  onClose,
  onNavigate
}: CommandPaletteProps): ReactElement | null {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const recent = useRecentTools()
  const favorites = useFavorites()

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [open])

  const sections = useMemo<Section[]>(() => {
    const normalized = query.trim()
    if (normalized) {
      const ranked = READY.map((tool) => {
        const fuzzy = bestFuzzyScore([tool.name, tool.category, ...tool.keywords], normalized)
        const inDescription = tool.description.toLowerCase().includes(normalized.toLowerCase())
        return {
          tool,
          score: fuzzy === null && !inDescription ? null : Math.max(fuzzy ?? 0, inDescription ? 40 : 0)
        }
      })
        .filter((entry): entry is { tool: ToolDef; score: number } => entry.score !== null)
        .sort((left, right) => right.score - left.score || left.tool.name.localeCompare(right.tool.name))
        .map((entry) => entry.tool)
      return [{ title: 'Results', tools: ranked }]
    }

    const result: Section[] = []
    const recentTools = pickTools(recent)
    if (recentTools.length > 0) result.push({ title: 'Recent', tools: recentTools })
    const favoriteTools = pickTools(favorites)
    if (favoriteTools.length > 0) result.push({ title: 'Favorites', tools: favoriteTools })
    result.push({ title: 'All tools', tools: READY })
    return result
  }, [query, recent, favorites])

  const { rows, flatTools } = useMemo(() => {
    const tools: ToolDef[] = []
    const built: Row[] = []
    for (const section of sections) {
      built.push({ kind: 'heading', key: `heading-${section.title}`, title: section.title })
      for (const tool of section.tools) {
        built.push({ kind: 'tool', key: `tool-${tools.length}-${tool.id}`, tool, index: tools.length })
        tools.push(tool)
      }
    }
    return { rows: built, flatTools: tools }
  }, [sections])

  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    document.getElementById(`palette-item-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  if (!open) return null

  const choose = (tool: ToolDef | undefined): void => {
    if (!tool) return
    onNavigate(tool.id)
    onClose()
  }

  return (
    <div
      className="palette-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="palette-search">
          <Icon name="search" size={16} className="search-icon" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActive((index) => Math.min(flatTools.length - 1, index + 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActive((index) => Math.max(0, index - 1))
              } else if (event.key === 'Enter') {
                event.preventDefault()
                choose(flatTools[active])
              } else if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
              }
            }}
            placeholder="Jump to a tool…"
            aria-label="Command palette search"
            spellCheck={false}
          />
          <kbd className="search-shortcut">Esc</kbd>
        </div>

        <div className="palette-list" role="listbox" aria-label="Matching tools">
          {rows.map((row) =>
            row.kind === 'heading' ? (
              <div className="palette-section" key={row.key}>
                {row.title}
              </div>
            ) : (
              <button
                type="button"
                key={row.key}
                id={`palette-item-${row.index}`}
                role="option"
                aria-selected={row.index === active}
                className={`palette-item${row.index === active ? ' is-active' : ''}`}
                onMouseEnter={() => setActive(row.index)}
                onClick={() => choose(row.tool)}
              >
                <span className="palette-icon">
                  <Icon name={row.tool.icon} size={16} />
                </span>
                <span className="palette-labels">
                  <span className="palette-name">{row.tool.name}</span>
                  <span className="palette-category">{row.tool.category}</span>
                </span>
                {favorites.includes(row.tool.id) && (
                  <Icon name="star" size={13} className="palette-star" fill="currentColor" />
                )}
              </button>
            )
          )}

          {flatTools.length === 0 && (
            <div className="nav-empty">
              <Icon name="search" size={18} />
              <span>No tools match “{query.trim()}”</span>
            </div>
          )}
        </div>

        <div className="palette-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>Enter</kbd> open
          </span>
          <span>
            <kbd>Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  )
}
