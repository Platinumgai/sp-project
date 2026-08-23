import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { listStations, createStation, updateStation, deleteStation } from '../api/stations.js'
import { friendlyErrorMessage } from '../api/client.js'
import { LoadingSkeleton, ErrorState, EmptyState, PageHeader } from '../components/Primitives.jsx'
import { canManageStations } from '../utils/roles.js'

export default function PoliceStations() {
  const { user } = useAuth()
  const { notify } = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null = closed, {} = create, {...} = edit

  async function load() {
    setLoading(true)
    setError('')
    try {
      setRows(await listStations())
    } catch (err) {
      setError(friendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleDelete(id) {
    if (!window.confirm('Delete this station? This cannot be undone.')) return
    try {
      await deleteStation(id)
      notify('Station deleted', { tone: 'success' })
      await load()
    } catch (err) {
      notify(friendlyErrorMessage(err), { tone: 'error' })
    }
  }

  return (
    <div>
      <PageHeader
        title="Police Stations"
        actions={
          canManageStations(user?.role) && (
            <button onClick={() => setEditing({})} className="rounded-lg bg-signal-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500">
              + Add station
            </button>
          )
        }
      />

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState title="No stations visible" />
      ) : (
        <div className="panel overflow-x-auto p-2 scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-ink-500">
                <th className="p-2">Name</th>
                <th className="p-2">Contact</th>
                <th className="p-2">Latitude</th>
                <th className="p-2">Longitude</th>
                {canManageStations(user?.role) && <th className="p-2">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t border-base-700">
                  <td className="p-2 font-medium text-ink-100">{s.name}</td>
                  <td className="p-2 text-ink-300">{s.contact || '—'}</td>
                  <td className="p-2 text-ink-500">{s.latitude ?? '—'}</td>
                  <td className="p-2 text-ink-500">{s.longitude ?? '—'}</td>
                  {canManageStations(user?.role) && (
                    <td className="p-2">
                      <div className="flex gap-1.5">
                        <button onClick={() => setEditing(s)} className="rounded-md bg-base-600/50 px-2 py-1 text-xs text-ink-100 hover:bg-base-600">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(s.id)} className="rounded-md bg-signal-red/15 px-2 py-1 text-xs text-red-300 hover:bg-signal-red/25">
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing != null && (
        <StationModal
          station={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            notify('Station saved', { tone: 'success' })
            await load()
          }}
        />
      )}
    </div>
  )
}

function StationModal({ station, onClose, onSaved }) {
  const { notify } = useToast()
  const [name, setName] = useState(station?.name || '')
  const [contact, setContact] = useState(station?.contact || '')
  const [lat, setLat] = useState(station?.latitude ?? '17.3850')
  const [lon, setLon] = useState(station?.longitude ?? '78.4867')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    const payload = { name, contact: contact || null, latitude: Number(lat), longitude: Number(lon) }
    try {
      if (station) await updateStation(station.id, payload)
      else await createStation(payload)
      onSaved()
    } catch (err) {
      notify(friendlyErrorMessage(err), { tone: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="panel w-full max-w-sm p-5">
        <h2 className="mb-4 text-base font-semibold text-ink-100">{station ? 'Edit station' : 'Create station'}</h2>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-ink-300">Name</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-ink-100 outline-none focus:border-signal-blue" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-ink-300">Contact</span>
            <input value={contact} onChange={(e) => setContact(e.target.value)} className="w-full rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-ink-100 outline-none focus:border-signal-blue" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-ink-300">Latitude</span>
              <input type="number" step="any" required value={lat} onChange={(e) => setLat(e.target.value)} className="w-full rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-ink-100 outline-none focus:border-signal-blue" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-ink-300">Longitude</span>
              <input type="number" step="any" required value={lon} onChange={(e) => setLon(e.target.value)} className="w-full rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-ink-100 outline-none focus:border-signal-blue" />
            </label>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-ink-300 hover:bg-base-700">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="rounded-lg bg-signal-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60">
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
