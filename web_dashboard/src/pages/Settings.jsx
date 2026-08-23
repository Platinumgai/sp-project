import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { fetchSettings, updateSettings } from '../api/settings.js'
import { friendlyErrorMessage } from '../api/client.js'
import { LoadingSkeleton, ErrorState, PageHeader } from '../components/Primitives.jsx'
import { canEditSettings } from '../utils/roles.js'

export default function Settings() {
  const { user } = useAuth()
  const { notify } = useToast()
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      setForm(await fetchSettings())
    } catch (err) {
      setError(friendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateSettings(form)
      notify('Settings updated', { tone: 'success' })
    } catch (err) {
      notify(friendlyErrorMessage(err), { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSkeleton rows={4} />
  if (error) return <ErrorState message={error} onRetry={load} />

  const readOnly = !canEditSettings(user?.role)

  return (
    <div>
      <PageHeader title="Settings" subtitle="Operational configuration (not secrets -- credentials are never exposed here)" />
      <form onSubmit={handleSubmit} className="panel max-w-md space-y-4 p-5">
        <label className="block text-sm">
          <span className="mb-1 block text-ink-300">Evidence chunk size (MB)</span>
          <input
            type="number"
            disabled={readOnly}
            value={form.chunk_size_mb}
            onChange={(e) => setForm({ ...form, chunk_size_mb: Number(e.target.value) })}
            className="w-full rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-ink-100 outline-none focus:border-signal-blue disabled:opacity-60"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-ink-300">Geofence threshold (m)</span>
          <input
            type="number"
            disabled={readOnly}
            value={form.geofence_threshold_m}
            onChange={(e) => setForm({ ...form, geofence_threshold_m: Number(e.target.value) })}
            className="w-full rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-ink-100 outline-none focus:border-signal-blue disabled:opacity-60"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-300">
          <input
            type="checkbox"
            disabled={readOnly}
            checked={form.audio_alerts}
            onChange={(e) => setForm({ ...form, audio_alerts: e.target.checked })}
            className="h-4 w-4"
          />
          Audio alerts enabled
        </label>

        {!readOnly && (
          <button type="submit" disabled={saving} className="rounded-lg bg-signal-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        )}
        {readOnly && <p className="text-xs text-ink-500">Your role has read-only access to settings.</p>}
      </form>
    </div>
  )
}
