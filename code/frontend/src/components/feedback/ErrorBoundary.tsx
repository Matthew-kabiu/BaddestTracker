import { Component, type ErrorInfo, type ReactNode } from 'react'

import { ErrorFallback } from '@/components/feedback/ErrorFallback'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Last-resort catch for crashes outside the router (providers in main.tsx). Route pages are
 * covered by the router's errorElement (App.tsx). The raw error goes to the dev console only.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('[ErrorBoundary]', error, info)
  }

  reset = () => this.setState({ hasError: false })

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <ErrorFallback fullScreen reset={this.reset} />
    }
    return this.props.children
  }
}
