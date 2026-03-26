import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

const ToastContext = createContext(null)

const VARIANT_STYLES = {
  success:
    'border-emerald-200/90 bg-emerald-50/95 text-emerald-950 shadow-lg shadow-emerald-900/5',
  error: 'border-red-200/90 bg-red-50/95 text-red-950 shadow-lg shadow-red-900/5',
  info: 'border-stone-200/90 bg-white/95 text-stone-900 shadow-lg shadow-stone-900/10',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const showToast = useCallback(
    ({ variant = 'info', message, duration = 4200 }) => {
      const id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`
      setToasts((prev) => {
        const next = prev.filter((x) => x.id !== id)
        return [...next.slice(-4), { id, variant, message }]
      })
      window.setTimeout(() => remove(id), duration)
    },
    [remove],
  )

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 sm:w-full"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto motion-safe:animate-toast-in motion-reduce:animate-none rounded-xl border px-4 py-3 text-sm font-medium leading-snug backdrop-blur-md ${VARIANT_STYLES[t.variant] || VARIANT_STYLES.info}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    return { showToast: () => {} }
  }
  return ctx
}
