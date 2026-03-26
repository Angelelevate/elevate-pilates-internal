import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg space-y-5 py-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-clay-50 shadow-warm-sm">
        <span className="font-display text-2xl font-bold text-clay">404</span>
      </div>
      <h1 className="font-display text-3xl font-semibold text-stone-900">Page not found</h1>
      <p className="text-stone-500">That route does not exist.</p>
      <Link
        to="/"
        className="ui-btn-primary inline-flex"
      >
        Back home
      </Link>
    </div>
  )
}
