import { useEffect, useState } from 'react'
import { api } from '../services/api.js'
import { LoadingSpinner } from '../components/LoadingSpinner.jsx'

export function HomePage() {
  const [config, setConfig] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.get('/api/config/public')
        if (!cancelled) setConfig(data)
      } catch {
        if (!cancelled) setError('Could not load platform config.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-6 text-amber-900">
        <p className="font-medium">{error}</p>
        <p className="mt-2 text-sm text-amber-800/90">
          Start the API (<code className="rounded bg-amber-100 px-1">npm run dev:server</code> from
          the repo root) or check the Vite proxy.
        </p>
      </div>
    )
  }

  if (!config) return <LoadingSpinner label="Loading platform" />

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-sage">
          Welcome
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-stone-900 sm:text-4xl">
          {config.platformName}
        </h1>
        <p className="mt-3 text-stone-600">
          Your learning hub for structured Pilates training. Course content, quizzes, and progress
          tracking will appear here as modules go live.
        </p>
      </div>
      <div className="rounded-2xl border border-stone-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
        <h2 className="font-display text-lg font-semibold text-stone-900">
          Password policy (preview)
        </h2>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-stone-600">
          <li>Minimum length: {config.passwordPolicy?.minLength}</li>
          <li>Uppercase required: {String(config.passwordPolicy?.requireUppercase)}</li>
          <li>Lowercase required: {String(config.passwordPolicy?.requireLowercase)}</li>
          <li>Number required: {String(config.passwordPolicy?.requireNumber)}</li>
          <li>Symbol required: {String(config.passwordPolicy?.requireSymbol)}</li>
        </ul>
      </div>
    </div>
  )
}
