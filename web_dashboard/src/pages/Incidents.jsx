import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import {
  listIncidents,
  createIncident,
  verifyIncident,
  rejectIncident,
  flagIncidentNeedsReview,
  dispatchIncident,
} from '../api/incidents.js'
import { friendlyErrorMessage } from '../api/client.js'
import { LoadingSkeleton, ErrorState, EmptyState, PageHeader } from '../components/Primitives.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { canCreateIncident, canVerifyIncident, canDispatch } from '../utils/roles.js'
import { formatDateTime } from '../utils/format.js'

const STATUS_OPTIONS = ['new', 'verified', 'rejected', 'assigned', 'en_route', 'arrived', 'resolved', 'closed', 'needs_review']

export default function Incidents() {
  const { user } = useAuth()
  const { notify } = useToast()
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [busyId, setBusyId] = useState(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      setIncidents(await listIncidents())
    } catch (err) {
      setError(friendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    return incidents.filter((i) => {
      if (statusFilter && i.status !== statusFilter) return false
      if (search) {
        const needle = search.toLowerCase()
        const haystack = `${i.display_id || ''} ${i.description || ''} ${i.id}`.toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      return true
    })
  }, [incidents, search, statusFilter])

  async function runAction(id, fn, successMessage) {
    setBusyId(id)
    try {
      await fn(id)
      notify(successMessage, { tone: 'success' })
      await load()
    } catch (err) {
      notify(friendlyErrorMessage(err), { tone: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject(id) {
    const reason = window.prompt('Rejection reason (optional):') ?? ''
    await runAction(id, () => rejectIncident(id, reason), 'Incident rejected')
  }

  async function handleNeedsReview(id) {
    const reason = window.prompt('Reason for flagging (optional):') ?? ''
    await runAction(id, () => flagIncidentNeedsReview(id, reason), 'Incident flagged for review')
  }

  return (
    <div>
      <PageHeader
        title="Incidents"
        subtitle="Role-scoped list from the backend -- you only see incidents you're authorized to view"
        actions={
          canCreateIncident(user?.role) && (
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-lg bg-signal-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
            >
              + New incident
            </button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search description or ID…"
          className="w-64 rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-sm text-ink-100 outline-none focus:border-signal-blue"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-sm text-ink-100 outline-none focus:border-signal-blue"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No incidents match" hint="Try clearing filters, or create a new incident." />
      ) : (
        <div className="panel overflow-x-auto p-2 scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-ink-500">
                <th className="p-2">ID</th>
                <th className="p-2">Status</th>
                <th className="p-2">Description</th>
                <th className="p-2">Created</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} className="border-t border-base-700">
                  <td className="p-2">
                    <Link to={`/incidents/${i.id}`} className="font-medium text-sky-300 hover:underline">
                      {i.display_id || i.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="p-2">
                    <StatusBadge status={i.status} />
                  </td>
                  <td className="max-w-sm truncate p-2 text-ink-300">{i.description || '—'}</td>
                  <td className="p-2 text-ink-500">{formatDateTime(i.created_at)}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1.5">
                      {canVerifyIncident(user?.role) && i.status === 'new' && (
                        <>
                          <button
                            disabled={busyId === i.id}
                            onClick={() => runAction(i.id, verifyIncident, 'Incident verified')}
                            className="rounded-md bg-signal-green/15 px-2 py-1 text-xs text-emerald-300 hover:bg-signal-green/25 disabled:opacity-50"
                          >
                            Verify
                          </button>
                          <button
                            disabled={busyId === i.id}
                            onClick={() => handleReject(i.id)}
                            className="rounded-md bg-signal-red/15 px-2 py-1 text-xs text-red-300 hover:bg-signal-red/25 disabled:opacity-50"
                          >
                            Reject
                          </button>
                          <button
                            disabled={busyId === i.id}
                            onClick={() => handleNeedsReview(i.id)}
                            className="rounded-md bg-signal-violet/15 px-2 py-1 text-xs text-violet-300 hover:bg-signal-violet/25 disabled:opacity-50"
                          >
                            Needs review
                          </button>
                        </>
                      )}
                      {canDispatch(user?.role) && i.status === 'verified' && (
                        <button
                          disabled={busyId === i.id}
                          onClick={() => runAction(i.id, dispatchIncident, 'Dispatch attempted')}
                          className="rounded-md bg-signal-blue/15 px-2 py-1 text-xs text-sky-300 hover:bg-signal-blue/25 disabled:opacity-50"
                        >
                          Dispatch
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateIncidentModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false)
            notify('Incident created', { tone: 'success' })
            await load()
          }}
        />
      )}
    </div>
  )
}

function CreateIncidentModal({ onClose, onCreated }) {
  const { notify } = useToast()
  const [lat, setLat] = useState('17.3850')
  const [lon, setLon] = useState('78.4867')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await createIncident({ location_lat: Number(lat), location_lon: Number(lon), description: description || null })
      onCreated()
    } catch (err) {
      notify(friendlyErrorMessage(err), { tone: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="panel w-full max-w-md p-5">
        <h2 className="mb-4 text-base font-semibold text-ink-100">Create incident</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-ink-300">Latitude</span>
            <input
              type="number"
              step="any"
              required
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="w-full rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-ink-100 outline-none focus:border-signal-blue"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink-300">Longitude</span>
            <input
              type="number"
              step="any"
              required
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              className="w-full rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-ink-100 outline-none focus:border-signal-blue"
            />
          </label>
          <label className="col-span-2 text-sm">
            <span className="mb-1 block text-ink-300">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's happening?"
              rows={3}
              className="w-full rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-ink-100 outline-none focus:border-signal-blue"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-ink-300 hover:bg-base-700">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-signal-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {submitting ? 'Creating…' : 'Create incident'}
          </button>
        </div>
      </form>
    </div>
  )
}
