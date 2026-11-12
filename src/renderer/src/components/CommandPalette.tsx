import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { Icon, type IconName } from '../icons'
import { bestFuzzyScore } from '../lib/fuzzy'
import { useFavorites, useRecentTools } from '../lib/prefs'
import { TOOLS, type ToolDef } from '../tools/registry'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onNavigate: (id: string) => void
  onOpenSettings: () => void
  onOpenShortcuts: () => void
  onOpenHistory: () => void
}

interface PaletteCommand {
  id: string
  label: string
  hint?: string
  icon: IconName
  run: () => void
}

type Item =
  | { kind: 'tool'; tool: ToolDef }
  | { kind: 'command'; command: PaletteCommand }

interface Section {
  title: string
  items: Item[]
}

type Row =
  | { kind: 'heading'; key: string; title: string }
  | { kind: 'item'; key: string; item: Item; index: number }

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
  onNavigate,
  onOpenSettings,
  onOpenShortcuts,
  onOpenHistory
}: CommandPaletteProps): ReactElement | null {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const recent = useRecentTools()
  const favorites = useFavorites()

  useEffect(() => {
    if (!open) return
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setQuery('')
    setActive(0)
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => {
      window.clearTimeout(timer)
      if (previousFocus.current?.isConnected) previousFocus.current.focus()
      previousFocus.current = null
    }
  }, [open])

  const commands = useMemo<PaletteCommand[]>(
    () => [
      {
        id: 'settings',
        label: 'Open settings',
        hint: 'Ctrl ,',
        icon: 'settings',
        run: onOpenSettings
      },
      {
        id: 'shortcuts',
        label: 'Keyboard shortcuts',
        hint: '?',
        icon: 'keyboard',
        run: onOpenShortcuts
      },
      {
        id: 'history',
        label: 'Open working set',
        icon: 'history',
        run: onOpenHistory
      }
    ],
    [onOpenSettings, onOpenShortcuts, onOpenHistory]
  )

  const sections = useMemo<Section[]>(() => {
    const normalized = query.trim()
    const commandItems = commands.map<Item>((command) => ({ kind: 'command', command }))

    if (normalized) {
      const tools = READY.map((tool) => {
        const fuzzy = bestFuzzyScore([tool.name, tool.category, ...tool.keywords], normalized)
        const inDescription = tool.description.toLowerCase().includes(normalized.toLowerCase())
        return {
          tool,
          score: fuzzy === null && !inDescription ? null : Math.max(fuzzy ?? 0, inDescription ? 40 : 0)
        }
      })
        .filter((entry): entry is { tool: ToolDef; score: number } => entry.score !== null)
        .sort((left, right) => right.score - left.score || left.tool.name.localeCompare(right.tool.name))
        .map<Item>((entry) => ({ kind: 'tool', tool: entry.tool }))

      const matchedCommands = commandItems.filter((item) =>
        item.kind === 'command'
          ? bestFuzzyScore([item.command.label, item.command.hint ?? ''], normalized) !== null
          : false
      )

      return [{ title: 'Results', items: [...tools, ...matchedCommands] }]
    }

    const result: Section[] = []
    const recentTools = pickTools(recent)
    if (recentTools.length > 0) {
      result.push({ title: 'Recent', items: recentTools.map((tool) => ({ kind: 'tool', tool })) })
    }
    const favoriteTools = pickTools(favorites)
    if (favoriteTools.length > 0) {
      result.push({
        title: 'Favorites',
        items: favoriteTools.map((tool) => ({ kind: 'tool', tool }))
      })
    }
    result.push({ title: 'All tools', items: READY.map((tool) => ({ kind: 'tool', tool })) })
    result.push({ title: 'Commands', items: commandItems })
    return result
  }, [query, recent, favorites, commands])

  const { rows, flatItems } = useMemo(() => {
    const items: Item[] = []
    const built: Row[] = []
    for (const section of sections) {
      built.push({ kind: 'heading', key: `heading-${section.title}`, title: section.title })
      for (const item of section.items) {
        built.push({ kind: 'item', key: `item-${items.length}`, item, index: items.length })
        items.push(item)
      }
    }
    return { rows: built, flatItems: items }
  }, [sections])

  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    document.getElementById(`palette-item-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  if (!open) return null

  const choose = (item: Item | undefined): void => {
    if (!item) return
    if (item.kind === 'tool') onNavigate(item.tool.id)
    else item.command.run()
    onClose()
  }

  return (
    <div
      className="palette-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
            return
          }
          if (event.key !== 'Tab') return
          const focusables = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>('input, button')
          ).filter((element) => !element.hasAttribute('disabled'))
          if (focusables.length === 0) return
          const first = focusables[0]
          const last = focusables[focusables.length - 1]
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
          }
        }}
      >
        <div className="palette-search">
          <Icon name="search" size={16} className="search-icon" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActive((index) => Math.min(flatItems.length - 1, index + 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActive((index) => Math.max(0, index - 1))
              } else if (event.key === 'Enter') {
                event.preventDefault()
                choose(flatItems[active])
              }
            }}
            placeholder="Jump to a tool or command…"
            aria-label="Command palette search"
            aria-controls="palette-list"
            aria-activedescendant={`palette-item-${active}`}
            spellCheck={false}
          />
          <kbd className="search-shortcut">Esc</kbd>
        </div>

        <div
          id="palette-list"
          className="palette-list"
          role="listbox"
          aria-label="Matching tools and commands"
        >
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
                onClick={() => choose(row.item)}
              >
                <span className="palette-icon">
                  <Icon
                    name={row.item.kind === 'tool' ? row.item.tool.icon : row.item.command.icon}
                    size={16}
                  />
                </span>
                <span className="palette-labels">
                  <span className="palette-name">
                    {row.item.kind === 'tool' ? row.item.tool.name : row.item.command.label}
                  </span>
                  <span className="palette-category">
                    {row.item.kind === 'tool' ? row.item.tool.category : 'Command'}
                  </span>
                </span>
                {row.item.kind === 'command' ? (
                  row.item.command.hint ? (
                    <kbd className="palette-kbd">{row.item.command.hint}</kbd>
                  ) : null
                ) : (
                  favorites.includes(row.item.tool.id) && (
                    <Icon name="star" size={13} className="palette-star" fill="currentColor" />
                  )
                )}
              </button>
            )
          )}

          {flatItems.length === 0 && (
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
