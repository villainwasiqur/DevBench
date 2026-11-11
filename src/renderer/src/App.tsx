import { Suspense, useEffect, useRef, useState, type ReactElement } from 'react'
import { CommandPalette } from './components/CommandPalette'
import { ComingSoon } from './components/ComingSoon'
import { HomePage } from './components/HomePage'
import { NotFound } from './components/NotFound'
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
  const tool = route === 'home' ? undefined : getTool(route)

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
  }, [route])

  useEffect(() => {
    document.title = tool ? `${tool.name} · Dev Toolkit` : 'Dev Toolkit'
  }, [tool])

  useEffect(() => {
    if (tool?.status === 'ready') recordRecent(tool.id)
  }, [tool])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const renderPage = (): ReactElement => {
    if (route === 'home') return <HomePage onNavigate={navigate} />
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

  return (
    <div className="app">
      <TitleBar />
      <div className="app-body">
        <Sidebar
          activeId={route}
          onNavigate={navigate}
          theme={theme}
          onSelectTheme={selectTheme}
        />
        <main className="content" ref={contentRef}>
          {renderPage()}
        </main>
      </div>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={navigate}
      />
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
