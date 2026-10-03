import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { fetchMyConstableProfile, fetchMyIncidents, updateMyLocation } from '../api/constables.js'
import { friendlyErrorMessage } from '../api/client.js'
import { LoadingSkeleton, ErrorState, EmptyState } from '../components/Primitives.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { isConstable, ROLE_LABELS } from '../utils/roles.js'
import { formatDateTime } from '../utils/format.js'

export default function Profile() {
  const { user } = useAuth()
  const { notify } = useToast()
  const [constable, setConstable] = useState(null)
  const [myIncidents, setMyIncidents] = useState([])
  const [loading, setLoading] = useState(isConstable(user?.role))
  const [error, setError] = useState('')
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [accuracy, setAccuracy] = useState('')
  const [sendingLocation, setSendingLocation] = useState(false)

  async function load() {
    if (!isConstable(user?.role)) return
    setLoading(true)
    setError('')
    try {
      const [profile, incidents] = await Promise.all([fetchMyConstableProfile(), fetchMyIncidents()])
      setConstable(profile)
      setMyIncidents(incidents)
    } catch (err) {
      setError(friendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role])

  async function handleLocationSubmit(e) {
    e.preventDefault()
    setSendingLocation(true)
    try {
      await updateMyLocation({ latitude: Number(lat), longitude: Number(lon), accuracy: accuracy ? Number(accuracy) : undefined })
      notify('Location updated', { tone: 'success' })
      await load()
    } catch (err) {
      notify(friendlyErrorMessage(err), { tone: 'error' })
    } finally {
      setSendingLocation(false)
    }
  }

  function useBrowserLocation() {
    if (!navigator.geolocation) {
      notify('Geolocation is not available in this browser', { tone: 'error' })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude))
        setLon(String(pos.coords.longitude))
        setAccuracy(String(pos.coords.accuracy))
      },
      (err) => notify(err.message, { tone: 'error' }),
    )
  }

  return (
    <div className="space-y-6">
      <div className="panel p-5">
        <h1 className="mb-4 text-lg font-semibold text-ink-100">My account</h1>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-ink-500">Phone</dt>
            <dd className="text-ink-100">{user?.phone}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Role</dt>
            <dd className="text-ink-100">{ROLE_LABELS[user?.role] || user?.role}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Account status</dt>
            <dd>
              <StatusBadge status={user?.is_active ? 'active' : 'inactive'} />
            </dd>
          </div>
          <div>
            <dt className="text-ink-500">Member since</dt>
            <dd className="text-ink-100">{formatDateTime(user?.created_at)}</dd>
          </div>
        </dl>
      </div>

      {isConstable(user?.role) && (
        <>
          {loading ? (
            <LoadingSkeleton rows={4} />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : (
            <>
              <div className="panel p-5">
                <h2 className="mb-4 font-semibold text-ink-100">Constable status</h2>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-ink-500">Badge</dt>
                    <dd className="text-ink-100">{constable?.badge_number || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Status</dt>
                    <dd>
                      <StatusBadge status={constable?.status} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Battery</dt>
                    <dd className="text-ink-100">{constable?.battery_level != null ? `${constable.battery_level}%` : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Last location</dt>
                    <dd className="text-ink-100">{formatDateTime(constable?.last_location_at)}</dd>
                  </div>
                </dl>

                <form onSubmit={handleLocationSubmit} className="mt-5 border-t border-base-700 pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-ink-100">Update my location</h3>
                    <button type="button" onClick={useBrowserLocation} className="text-xs text-sky-300 hover:underline">
                      Use browser location
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <label className="text-sm">
                      <span className="mb-1 block text-ink-300">Latitude</span>
                      <input required type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} className="w-full rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-ink-100 outline-none focus:border-signal-blue" />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-ink-300">Longitude</span>
                      <input required type="number" step="any" value={lon} onChange={(e) => setLon(e.target.value)} className="w-full rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-ink-100 outline-none focus:border-signal-blue" />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-ink-300">Accuracy (m)</span>
                      <input type="number" step="any" value={accuracy} onChange={(e) => setAccuracy(e.target.value)} className="w-full rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-ink-100 outline-none focus:border-signal-blue" />
                    </label>
                  </div>
                  <button type="submit" disabled={sendingLocation} className="mt-3 rounded-lg bg-signal-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60">
                    {sendingLocation ? 'Sending…' : 'Send location'}
                  </button>
                </form>
              </div>

              <div className="panel p-5">
                <h2 className="mb-4 font-semibold text-ink-100">My assigned incidents</h2>
                {myIncidents.length === 0 ? (
                  <EmptyState title="No assignments" hint="Incidents dispatched to you will appear here." />
                ) : (
                  <ul className="space-y-2">
                    {myIncidents.map((row) => (
                      <li key={row.assignment_id} className="flex items-center justify-between rounded-lg border border-base-700 p-3 text-sm">
                        <div>
                          <Link to={`/incidents/${row.incident_id}`} className="font-medium text-sky-300 hover:underline">
                            {row.display_id || row.incident_id.slice(0, 8)}
                          </Link>
                          <p className="text-xs text-ink-500">{formatDateTime(row.assigned_at)}</p>
                        </div>
                        <StatusBadge status={row.assignment_status} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
