const version = '0.1.0'

export function Footer() {
  return (
    <footer className="border-t border-stone-200/80 bg-white/60 px-6 py-4 text-center text-xs text-stone-500 backdrop-blur-sm md:text-left">
      <p>
        © {new Date().getFullYear()} Elevate Pilates · v{version}
      </p>
    </footer>
  )
}
