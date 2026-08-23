export function LoadingSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 rounded-lg bg-base-700/60" />
      ))}
    </div>
  )
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-base-600 py-14 text-center">
      <p className="text-ink-100 font-medium">{title}</p>
      {hint && <p className="text-sm text-ink-500 max-w-sm">{hint}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-signal-red/30 bg-signal-red/5 py-14 text-center">
      <p className="text-red-200 font-medium">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="rounded-lg bg-base-700 px-3 py-1.5 text-sm hover:bg-base-600">
          Try again
        </button>
      )}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-ink-100">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', tone = 'default', onConfirm, onCancel, busy }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="panel w-full max-w-sm p-5">
        <h2 className="text-base font-semibold text-ink-100">{title}</h2>
        <p className="mt-2 text-sm text-ink-300">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} disabled={busy} className="rounded-lg px-3 py-1.5 text-sm text-ink-300 hover:bg-base-700">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 ${
              tone === 'danger' ? 'bg-signal-red hover:bg-red-500' : 'bg-signal-blue hover:bg-blue-500'
            }`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
