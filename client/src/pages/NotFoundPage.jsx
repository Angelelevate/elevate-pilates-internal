import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-clay">
        404
      </p>
      <h1 className="font-display text-3xl font-semibold text-stone-900">Page not found</h1>
      <p className="text-stone-600">That route does not exist.</p>
      <Link
        to="/"
        className="inline-flex rounded-full bg-deep px-5 py-2 text-sm font-medium text-white transition hover:opacity-90"
      >
        Back home
      </Link>
    </div>
  )
}
