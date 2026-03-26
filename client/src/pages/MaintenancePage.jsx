export function MaintenancePage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center motion-safe:animate-in-up motion-reduce:animate-none">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-deep text-xl font-bold text-white shadow-warm">
        EP
      </div>
      <div className="space-y-3">
        <h1 className="font-display text-3xl font-semibold text-stone-900">
          We will be right back
        </h1>
        <p className="max-w-md text-stone-500">
          Elevate Pilates is temporarily unavailable while we perform maintenance. Thank you for your
          patience.
        </p>
      </div>
      <div className="h-1 w-16 rounded-full bg-gradient-to-r from-clay/40 via-sage/40 to-deep/40" />
    </div>
  )
}
