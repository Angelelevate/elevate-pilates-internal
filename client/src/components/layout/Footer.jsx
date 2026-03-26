const version = '0.1.0'

export function Footer() {
  return (
    <footer className="border-t border-stone-200/60 bg-white/50 backdrop-blur-sm transition-colors duration-300 ease-soft">
      <div className="ui-divider" />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-5 lg:px-8">
        <p className="min-w-0 text-xs text-stone-400">
          © {new Date().getFullYear()} Elevate Pilates
        </p>
        <p className="shrink-0 text-[10px] font-medium tracking-wide text-stone-300">
          v{version}
        </p>
      </div>
    </footer>
  )
}
