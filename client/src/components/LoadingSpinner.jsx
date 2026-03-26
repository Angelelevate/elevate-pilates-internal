export function LoadingSpinner({ label = 'Loading' }) {
  return (
    <div
      className="motion-safe:animate-in-up motion-reduce:animate-none flex flex-col items-center justify-center gap-4 py-20"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span
        className="h-10 w-10 motion-safe:animate-spin motion-reduce:animate-none rounded-full border-2 border-stone-200 border-t-sage"
        aria-hidden
      />
      <span className="motion-safe:animate-spinner-soft text-sm text-stone-400 motion-reduce:animate-none">
        {label}
      </span>
    </div>
  )
}
