import { Component, Suspense, type ReactNode } from 'react'
import { en } from '@/copy/en'

interface Props { children: ReactNode, loading?: string, page?: boolean }

export class AsyncBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  override render() {
    const wrap = (content: ReactNode, busy = false) => this.props.page
      ? <main className="app-frame scene" aria-busy={busy || undefined}>{content}</main>
      : content
    if (this.state.failed) return wrap(
      <div role="alert">
        <p>{en['load.unavailable']}</p>
        <a className="pill control-link" href={window.location.href}>{en['action.reload']}</a>
      </div>
    )
    return <Suspense fallback={wrap(<p role="status">{this.props.loading ?? en['load.pending']}</p>, true)}>{this.props.children}</Suspense>
  }
}
