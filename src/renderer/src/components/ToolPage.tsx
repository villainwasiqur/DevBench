import type { ReactElement, ReactNode } from 'react'
import { Icon } from '../icons'
import { useFavorites, toggleFavorite } from '../lib/prefs'
import type { ToolDef } from '../tools/registry'
import { IconButton } from './ui/Button'

interface ToolPageProps {
  tool: ToolDef
  actions?: ReactNode
  children: ReactNode
}

export function ToolPage({ tool, actions, children }: ToolPageProps): ReactElement {
  const favorites = useFavorites()
  const favorited = favorites.includes(tool.id)

  return (
    <div className="page tool-page">
      <header className="tool-header">
        <span className="tool-icon">
          <Icon name={tool.icon} size={24} />
        </span>
        <div className="tool-heading">
          <div className="tool-title-row">
            <h1>{tool.name}</h1>
            <span className="tool-category">{tool.category}</span>
            {tool.status === 'planned' && <span className="pill pill-warning">Planned</span>}
          </div>
          <p className="tool-description">{tool.description}</p>
        </div>
        <div className="tool-actions">
          <IconButton
            label={favorited ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={favorited}
            active={favorited}
            onClick={() => toggleFavorite(tool.id)}
          >
            <Icon name="star" size={16} fill={favorited ? 'currentColor' : 'none'} />
          </IconButton>
          {actions}
        </div>
      </header>
      <div className="tool-body">{children}</div>
    </div>
  )
}
