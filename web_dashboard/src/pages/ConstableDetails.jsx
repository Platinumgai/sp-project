import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { listConstables } from '../api/constables.js'
import { useOperations } from '../context/OperationsContext.jsx'
import { friendlyErrorMessage } from '../api/client.js'
import { LoadingSkeleton, ErrorState, EmptyState } from '../components/Primitives.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { formatDateTime, titleCase } from '../utils/format.js'

export default function ConstableDetails() {
  const { id } = useParams()
  const { devices, recordings, alerts } = useOperations()
  const [constable, setConstable] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    // No GET /constables/{id} endpoint exists in the backend -- the
    // roster is fetched and the matching row found client-side, the same
    // approach already used for incident details elsewhere in this app.
    listConstables()
      .then((rows) => {
        if (cancelled) return
        setConstable(rows.find((c) => c.id === id) || null)
      })
      .catch((err) => !cancelled && setError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) return <LoadingSkeleton rows={6} />
  if (error) return <ErrorState message={error} />
  if (!constable) return <EmptyState title="Constable not found" hint="It may not exist, or you may not be authorized to view it." />

  const device = devices.find((d) => d.constable_id === id)
  const constableRecordings = recordings.filter((r) => r.constable_id === id)
  const constableAlerts = alerts.filter((a) => a.constable_id === id && a.status === 'open')

  return (
    <div className="space-y-6">
      <div>
        <Link to="/constables" className="text-sm text-sky-300 hover:underline">← Back to constables</Link>
        <h1 className="mt-2 text-xl font-semibold text-ink-100">{constable.badge_number || constable.phone}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="mb-3 font-semibold text-ink-100">Constable</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-ink-500">Badge</dt><dd className="text-ink-100">{constable.badge_number || '—'}</dd></div>
            <div><dt className="text-ink-500">Phone</dt><dd className="text-ink-100">{constable.phone || '—'}</dd></div>
            <div><dt className="text-ink-500">Status</dt><dd><StatusBadge status={constable.status} /></dd></div>
            <div><dt className="text-ink-500">Last login</dt><dd className="text-ink-100">{formatDateTime(constable.last_login)}</dd></div>
          </dl>
        </section>

        <section className="panel p-4">
          <h2 className="mb-3 font-semibold text-ink-100">Device</h2>
          {device ? (
            <>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-ink-500">Status</dt><dd><StatusBadge status={device.status} /></dd></div>
                <div><dt className="text-ink-500">Battery</dt><dd className="text-ink-100">{device.battery_percent != null ? `${device.battery_percent}%` : '—'}</dd></div>
                <div><dt className="text-ink-500">Last seen</dt><dd className="text-ink-100">{formatDateTime(device.last_seen_at)}</dd></div>
                <div><dt className="text-ink-500">Location</dt><dd className="text-ink-100">{device.latitude != null ? `${device.latitude.toFixed(4)}, ${device.longitude.toFixed(4)}` : 'Location unavailable'}</dd></div>
              </dl>
              <Link to={`/devices/${device.id}`} className="mt-3 inline-block text-sm text-sky-300 hover:underline">
                Open device details &amp; remote control →
              </Link>
            </>
          ) : (
            <EmptyState title="No device registered" hint="This constable has not registered a device yet." />
          )}
        </section>
      </div>

      <section className="panel p-4">
        <h2 className="mb-3 font-semibold text-ink-100">Active alerts</h2>
        {constableAlerts.length === 0 ? (
          <EmptyState title="No active alerts" />
        ) : (
          <ul className="space-y-2">
            {constableAlerts.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-lg border border-base-700 p-3 text-sm">
                <span className="text-ink-100">{titleCase(a.type)}</span>
                <StatusBadge status={a.severity} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel p-4">
        <h2 className="mb-3 font-semibold text-ink-100">Recent recordings</h2>
        {constableRecordings.length === 0 ? (
          <EmptyState title="No recordings" />
        ) : (
          <ul className="space-y-2">
            {constableRecordings.slice(0, 10).map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-lg border border-base-700 p-3 text-sm">
                <Link to={`/recordings/${r.id}`} className="text-sky-300 hover:underline">
                  {formatDateTime(r.started_at)} · {titleCase(r.trigger_type)}
                </Link>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
