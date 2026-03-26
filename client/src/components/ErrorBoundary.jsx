import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error(error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center motion-safe:animate-in-up motion-reduce:animate-none">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-deep text-xl font-bold text-white shadow-warm">
            EP
          </div>
          <h1 className="font-display text-2xl font-semibold text-stone-900">
            Something went wrong
          </h1>
          <p className="max-w-md text-stone-500">
            Please refresh the page. If the problem continues, contact support.
          </p>
          <button
            type="button"
            className="ui-btn-primary"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
