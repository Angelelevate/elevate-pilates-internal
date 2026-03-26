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
      <div className="motion-safe:animate-in-up motion-reduce:animate-none ui-surface border-amber-200 bg-amber-50/80 p-6 text-amber-900">
        <p className="font-medium">{error}</p>
        <p className="mt-2 text-sm text-amber-800/90">
          Start the API (<code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs">npm run dev:server</code> from
          the repo root) or check the Vite proxy.
        </p>
      </div>
    )
  }

  if (!config) return <LoadingSpinner label="Loading platform" />

  const pp = config.passwordPolicy

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="ui-surface p-8">
          <p className="ui-section-label text-sage">Welcome</p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-stone-900 sm:text-4xl">
            {config.platformName}
          </h1>
          <p className="mt-4 max-w-2xl text-stone-600 leading-relaxed">
            Your learning hub for structured Pilates training. Course content, quizzes, and progress
            tracking will appear here as modules go live.
          </p>
          <div className="ui-divider mt-6" />
          <div className="mt-6 flex flex-wrap gap-4">
            <div className="rounded-xl bg-sage-50 px-4 py-3">
              <p className="text-2xl font-bold text-sage-700">4</p>
              <p className="text-xs text-sage-600">Lesson types</p>
            </div>
            <div className="rounded-xl bg-clay-50 px-4 py-3">
              <p className="text-2xl font-bold text-clay-700">∞</p>
              <p className="text-xs text-clay-600">Practice sessions</p>
            </div>
            <div className="rounded-xl bg-deep-50 px-4 py-3">
              <p className="text-2xl font-bold text-deep-500">✓</p>
              <p className="text-xs text-deep-400">Progress tracking</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="ui-surface p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-stone-900">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" className="text-clay">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Password policy
          </h2>
          <ul className="mt-4 space-y-2.5">
            {[
              { label: 'Minimum length', value: pp?.minLength },
              { label: 'Uppercase', value: pp?.requireUppercase ? 'Required' : 'Optional' },
              { label: 'Lowercase', value: pp?.requireLowercase ? 'Required' : 'Optional' },
              { label: 'Number', value: pp?.requireNumber ? 'Required' : 'Optional' },
              { label: 'Symbol', value: pp?.requireSymbol ? 'Required' : 'Optional' },
            ].map((item) => (
              <li key={item.label} className="flex items-center justify-between text-sm">
                <span className="text-stone-500">{item.label}</span>
                <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">{item.value}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-deep via-deep-600 to-sage-800 p-5 text-white shadow-warm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">Platform</p>
          <p className="mt-1 font-display text-lg font-semibold">Elevate your practice</p>
          <p className="mt-2 text-sm leading-relaxed text-white/75">
            Structured courses designed by professionals, delivered at your pace.
          </p>
        </div>
      </div>
    </div>
  )
}
