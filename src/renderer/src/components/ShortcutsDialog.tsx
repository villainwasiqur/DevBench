import { useEffect, useRef, type ReactElement } from 'react'
import { Icon } from '../icons'
import { IconButton } from './ui/Button'

interface ShortcutsDialogProps {
  open: boolean
  onClose: () => void
}

interface ShortcutRow {
  keys: string[]
  action: string
}

interface ShortcutGroup {
  title: string
  rows: ShortcutRow[]
}

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Global',
    rows: [
      { keys: ['Ctrl', 'K'], action: 'Open the command palette' },
      { keys: ['Ctrl', ','], action: 'Open settings' },
      { keys: ['?'], action: 'Show this shortcut guide' },
      { keys: ['Esc'], action: 'Close the active dialog or palette' }
    ]
  },
  {
    title: 'Command palette',
    rows: [
      { keys: ['↑', '↓'], action: 'Move through results' },
      { keys: ['Enter'], action: 'Open the highlighted tool' },
      { keys: ['Esc'], action: 'Dismiss the palette' }
    ]
  },
  {
    title: 'Moving around',
    rows: [
      { keys: ['Tab'], action: 'Move focus between controls' },
      { keys: ['Enter', 'Space'], action: 'Activate the focused button or toggle' },
      { keys: ['Esc'], action: 'Clear the sidebar search' }
    ]
  }
]

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps): ReactElement | null {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement as HTMLElement | null
    const timer = window.setTimeout(() => closeRef.current?.focus(), 0)

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', handleKeyDown)
      if (previousFocus.current?.isConnected) previousFocus.current.focus()
      previousFocus.current = null
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="dialog shortcuts-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Tab') {
            event.preventDefault()
            closeRef.current?.focus()
          }
        }}
      >
        <header className="dialog-head">
          <div className="dialog-heading">
            <span className="dialog-eyebrow">
              <Icon name="keyboard" size={14} /> Keyboard
            </span>
            <h2 id="shortcuts-title">Keyboard shortcuts</h2>
          </div>
          <IconButton ref={closeRef} label="Close shortcuts" onClick={onClose}>
            <Icon name="close" size={16} />
          </IconButton>
        </header>

        <div className="shortcut-groups">
          {GROUPS.map((group) => (
            <section className="shortcut-group" key={group.title}>
              <h3>{group.title}</h3>
              <dl className="shortcut-list">
                {group.rows.map((row) => (
                  <div className="shortcut-row" key={row.action}>
                    <dt>{row.action}</dt>
                    <dd className="shortcut-keys">
                      {row.keys.map((key) => (
                        <kbd key={key}>{key}</kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        <footer className="dialog-footer">
          <span>
            Press <kbd>Esc</kbd> to close
          </span>
        </footer>
      </div>
    </div>
  )
}
