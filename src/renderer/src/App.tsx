import { Suspense, useEffect, useRef, useState, type ReactElement } from 'react'
import { CommandPalette } from './components/CommandPalette'
import { ComingSoon } from './components/ComingSoon'
import { ErrorBoundary } from './components/ErrorBoundary'
import { HomePage } from './components/HomePage'
import { HistoryPage } from './components/HistoryPage'
import { NotFound } from './components/NotFound'
import { SettingsPage } from './components/SettingsPage'
import { ShortcutsDialog } from './components/ShortcutsDialog'
import { Sidebar } from './components/Sidebar'
import { TitleBar } from './components/TitleBar'
import { ToastProvider } from './components/ui/Toast'
import { useRoute } from './hooks/useRoute'
import { useTheme } from './hooks/useTheme'
import { recordRecent } from './lib/prefs'
import { getTool } from './tools/registry'
import { toolComponents } from './tools/toolComponents'

function ToolLoading(): ReactElement {
  return (
    <div className="page tool-loading">
      <span className="spinner" aria-hidden="true" />
      <span>Loading tool…</span>
    </div>
  )
}

function AppShell(): ReactElement {
  const { route, navigate } = useRoute()
  const { theme, selectTheme } = useTheme()
  const contentRef = useRef<HTMLElement>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const tool = route === 'home' ? undefined : getTool(route)

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
  }, [route])

  useEffect(() => {
    if (route === 'settings') document.title = 'Settings · DevBench'
    else if (route === 'history') document.title = 'Working set · DevBench'
    else document.title = tool ? `${tool.name} · DevBench` : 'DevBench'
  }, [tool, route])

  useEffect(() => {
    if (tool?.status === 'ready') recordRecent(tool.id)
  }, [tool])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const target = event.target
      const isTyping =
        target instanceof HTMLElement &&
        target.closest('input, textarea, select, [contenteditable="true"]') !== null

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setShortcutsOpen(false)
        setPaletteOpen((open) => !open)
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key === ',') {
        event.preventDefault()
        navigate('settings')
        return
      }

      if (!isTyping && !event.ctrlKey && !event.metaKey && !event.altKey && event.key === '?') {
        event.preventDefault()
        setPaletteOpen(false)
        setShortcutsOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  const renderPage = (): ReactElement => {
    if (route === 'home') return <HomePage onNavigate={navigate} />
    if (route === 'history') return <HistoryPage />
    if (route === 'settings') {
      return (
        <SettingsPage
          theme={theme}
          onSelectTheme={selectTheme}
          onShowShortcuts={() => setShortcutsOpen(true)}
        />
      )
    }
    if (!tool) return <NotFound onNavigate={navigate} />
    if (tool.status === 'planned') return <ComingSoon tool={tool} onNavigate={navigate} />

    const Component = toolComponents[tool.id]
    if (!Component) return <ComingSoon tool={tool} onNavigate={navigate} />

    return (
      <Suspense fallback={<ToolLoading />}>
        <Component />
      </Suspense>
    )
  }

  const pageLabel =
    route === 'settings'
      ? 'Settings'
      : route === 'history'
        ? 'Working set'
        : route === 'home'
          ? 'Overview'
          : (tool?.name ?? 'Page not found')

  return (
    <div className="app">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault()
          contentRef.current?.focus()
        }}
      >
        Skip to content
      </a>
      <TitleBar />
      <div className="app-body">
        <Sidebar
          activeId={route}
          onNavigate={navigate}
          theme={theme}
          onSelectTheme={selectTheme}
        />
        <main className="content" id="main-content" ref={contentRef} tabIndex={-1}>
          <ErrorBoundary key={route} onReset={() => navigate('home')}>
            {renderPage()}
          </ErrorBoundary>
        </main>
      </div>
      <div className="sr-only" role="status" aria-live="polite">
        {pageLabel} page
      </div>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={navigate}
        onOpenSettings={() => navigate('settings')}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onOpenHistory={() => navigate('history')}
      />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  )
}

export default function App(): ReactElement {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  )
}
