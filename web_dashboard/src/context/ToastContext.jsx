import { createContext, useCallback, useContext, useState } from 'react'

const ToastContext = createContext(null)
let idCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback((message, { tone = 'info', duration = 5000 } = {}) => {
    const id = ++idCounter
    setToasts((prev) => [...prev, { id, message, tone }])
    if (duration) setTimeout(() => dismiss(id), duration)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={[
              'rounded-lg border px-4 py-3 text-sm shadow-panel backdrop-blur',
              'animate-[fadeIn_0.15s_ease-out]',
              t.tone === 'error' && 'bg-signal-red/10 border-signal-red/40 text-red-200',
              t.tone === 'success' && 'bg-signal-green/10 border-signal-green/40 text-emerald-200',
              t.tone === 'warning' && 'bg-signal-amber/10 border-signal-amber/40 text-amber-100',
              t.tone === 'info' && 'bg-base-700/80 border-base-600 text-ink-100',
            ].filter(Boolean).join(' ')}
          >
            <div className="flex items-start justify-between gap-3">
              <span>{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="text-ink-500 hover:text-ink-100 leading-none"
                aria-label="Dismiss notification"
              >
                &times;
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
