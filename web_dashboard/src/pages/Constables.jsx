import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { listConstables, listConstableLocations, createConstable, deleteConstable } from '../api/constables.js'
import { friendlyErrorMessage } from '../api/client.js'
import { LoadingSkeleton, ErrorState, EmptyState, PageHeader } from '../components/Primitives.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { canManageConstables } from '../utils/roles.js'
import { formatDateTime } from '../utils/format.js'

export default function Constables() {
  const { user } = useAuth()
  const { notify } = useToast()
  const [rows, setRows] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [c, l] = await Promise.all([listConstables(), listConstableLocations().catch(() => [])])
      setRows(c)
      setLocations(l)
    } catch (err) {
      setError(friendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function locationFor(badge) {
    return locations.find((l) => l.constable_id === badge)
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this constable record?')) return
    try {
      await deleteConstable(id)
      notify('Constable removed', { tone: 'success' })
      await load()
    } catch (err) {
      notify(friendlyErrorMessage(err), { tone: 'error' })
    }
  }

  return (
    <div>
      <PageHeader
        title="Constables"
        subtitle="Roster scoped to your station/organization by the backend"
        actions={
          canManageConstables(user?.role) && (
            <button onClick={() => setShowCreate(true)} className="rounded-lg bg-signal-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500">
              + Add constable
            </button>
          )
        }
      />

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState title="No constables visible" />
      ) : (
        <div className="panel overflow-x-auto p-2 scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-ink-500">
                <th className="p-2">Badge</th>
                <th className="p-2">Status</th>
                <th className="p-2">Phone</th>
                <th className="p-2">Battery</th>
                <th className="p-2">Assigned task</th>
                <th className="p-2">Last login</th>
                <th className="p-2">Location</th>
                {canManageConstables(user?.role) && <th className="p-2">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const loc = locationFor(c.badge_number)
                return (
                  <tr key={c.id} className="border-t border-base-700">
                    <td className="p-2 font-medium">
                      <Link to={`/constables/${c.id}`} className="text-sky-300 hover:underline">
                        {c.badge_number || '—'}
                      </Link>
                    </td>
                    <td className="p-2">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="p-2 text-ink-300">{c.phone || '—'}</td>
                    <td className="p-2 text-ink-500">{c.battery_level != null ? `${c.battery_level}%` : '—'}</td>
                    <td className="p-2 font-mono text-xs text-ink-500">{c.assigned_task ? c.assigned_task.slice(0, 8) : '—'}</td>
                    <td className="p-2 text-ink-500">{formatDateTime(c.last_login)}</td>
                    <td className="p-2 text-ink-500">{loc ? `${loc.lat?.toFixed(4)}, ${loc.lon?.toFixed(4)}` : '—'}</td>
                    {canManageConstables(user?.role) && (
                      <td className="p-2">
                        <button onClick={() => handleDelete(c.id)} className="rounded-md bg-signal-red/15 px-2 py-1 text-xs text-red-300 hover:bg-signal-red/25">
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateConstableModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false)
            notify('Constable created', { tone: 'success' })
            await load()
          }}
        />
      )}
    </div>
  )
}

function CreateConstableModal({ onClose, onCreated }) {
  const { notify } = useToast()
  const [phone, setPhone] = useState('')
  const [badge, setBadge] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await createConstable({ phone, badge_number: badge })
      onCreated()
    } catch (err) {
      notify(friendlyErrorMessage(err), { tone: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="panel w-full max-w-sm p-5">
        <h2 className="mb-4 text-base font-semibold text-ink-100">Add constable</h2>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-ink-300">Phone</span>
          <input required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-ink-100 outline-none focus:border-signal-blue" />
        </label>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-ink-300">Badge number</span>
          <input required value={badge} onChange={(e) => setBadge(e.target.value)} className="w-full rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-ink-100 outline-none focus:border-signal-blue" />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-ink-300 hover:bg-base-700">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="rounded-lg bg-signal-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60">
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}
