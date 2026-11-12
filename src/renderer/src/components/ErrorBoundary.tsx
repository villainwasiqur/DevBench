import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Icon } from '../icons'
import { Button } from './ui/Button'

interface ErrorBoundaryProps {
  children: ReactNode
  onReset: () => void
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('A page failed to render:', error, info.componentStack)
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="page error-page" role="alert">
        <header className="settings-head">
          <span className="eyebrow">
            <Icon name="alert" size={14} />
            Something went wrong
          </span>
          <h1>This page stopped responding</h1>
          <p>
            The rest of the app is still healthy. Go back to the overview to keep working, or reload
            the window. Nothing you pasted was sent anywhere.
          </p>
        </header>

        <div className="error-card">
          <span className="error-message">{error.message || 'Unknown rendering error'}</span>
          <div className="error-actions">
            <Button variant="primary" onClick={this.props.onReset}>
              Back to overview
            </Button>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Reload app
            </Button>
          </div>
        </div>
      </div>
    )
  }
}
