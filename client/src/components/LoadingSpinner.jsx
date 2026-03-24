export function LoadingSpinner({ label = 'Loading' }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-16"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span
        className="h-10 w-10 animate-spin rounded-full border-2 border-stone-200 border-t-sage"
        aria-hidden
      />
      <span className="text-sm text-stone-500">{label}</span>
    </div>
  )
}
