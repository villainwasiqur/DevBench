import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Icon } from '../icons'
import { CATEGORIES, TOOLS, type ToolDef } from '../tools/registry'
import type { ThemeId } from '../hooks/useTheme'
import { useFavorites } from '../lib/prefs'
import { ThemePicker } from './ThemePicker'

interface SidebarProps {
  activeId: string
  onNavigate: (id: string) => void
  theme: ThemeId
  onSelectTheme: (id: ThemeId) => void
}

function matchesTool(tool: ToolDef, query: string): boolean {
  return [tool.name, tool.description, tool.category, ...tool.keywords].some((value) =>
    value.toLowerCase().includes(query)
  )
}

function NavTool({
  tool,
  active,
  onNavigate
}: {
  tool: ToolDef
  active: boolean
  onNavigate: (id: string) => void
}): ReactElement {
  return (
    <button
      type="button"
      title={tool.name}
      className={`nav-item${active ? ' is-active' : ''}`}
      onClick={() => onNavigate(tool.id)}
    >
      <span className="nav-icon">
        <Icon name={tool.icon} size={16} />
      </span>
      <span className="nav-label">{tool.name}</span>
      {tool.status === 'planned' && <span className="nav-badge">Soon</span>}
    </button>
  )
}

export function Sidebar({
  activeId,
  onNavigate,
  theme,
  onSelectTheme
}: SidebarProps): ReactElement {
  const [query, setQuery] = useState('')
  const [version, setVersion] = useState('0.1.0')
  const searchRef = useRef<HTMLInputElement>(null)
  const favorites = useFavorites()

  useEffect(() => {
    const api = window.devkit?.app
    if (!api) return
    let active = true

    void api
      .version()
      .then((value) => {
        if (active) setVersion(value)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [])

  const normalized = query.trim().toLowerCase()
  const groups = CATEGORIES.map((category) => ({
    category,
    tools: TOOLS.filter(
      (tool) => tool.category === category && (!normalized || matchesTool(tool, normalized))
    )
  })).filter((group) => group.tools.length > 0)
  const resultCount = groups.reduce((total, group) => total + group.tools.length, 0)
  const favoriteTools = favorites.flatMap((id) => {
    const tool = TOOLS.find((entry) => entry.id === id)
    return tool ? [tool] : []
  })

  return (
    <aside className="sidebar">
      <div className="sidebar-search">
        <div className="search-box">
          <Icon name="search" size={15} className="search-icon" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setQuery('')
                event.currentTarget.blur()
              }
            }}
            placeholder="Search tools…"
            aria-label="Search tools"
            spellCheck={false}
          />
          {query ? (
            <button
              type="button"
              className="search-clear"
              aria-label="Clear search"
              onClick={() => setQuery('')}
            >
              <Icon name="close" size={13} />
            </button>
          ) : (
            <kbd className="search-shortcut">Ctrl K</kbd>
          )}
        </div>
      </div>

      <nav className="nav-scroll" aria-label="Tools">
        {!normalized && (
          <button
            type="button"
            className={`nav-item${activeId === 'home' ? ' is-active' : ''}`}
            onClick={() => onNavigate('home')}
          >
            <span className="nav-icon">
              <Icon name="home" size={17} />
            </span>
            <span className="nav-label">Overview</span>
          </button>
        )}

        {!normalized && favoriteTools.length > 0 && (
          <div className="nav-section">
            <div className="nav-section-title">Favorites</div>
            {favoriteTools.map((tool) => (
              <NavTool
                key={`favorite-${tool.id}`}
                tool={tool}
                active={activeId === tool.id}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}

        {groups.map((group) => (
          <div className="nav-section" key={group.category}>
            <div className="nav-section-title">{group.category}</div>
            {group.tools.map((tool) => (
              <NavTool
                key={tool.id}
                tool={tool}
                active={activeId === tool.id}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}

        {normalized && resultCount === 0 && (
          <div className="nav-empty">
            <Icon name="search" size={18} />
            <span>No tools match “{query.trim()}”</span>
          </div>
        )}
      </nav>

      <div className="sidebar-footer">
        <ThemePicker theme={theme} onSelect={onSelectTheme} />
        <div className="app-meta">
          <span>v{version}</span>
          <span className="meta-dot" />
          <span className="app-meta-local">
            <Icon name="shield" size={12} /> Local-first
          </span>
        </div>
      </div>
    </aside>
  )
}
