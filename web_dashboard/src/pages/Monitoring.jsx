import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useOperations } from '../context/OperationsContext.jsx'
import { useConstableLookup } from '../hooks/useConstableLookup.js'
import { LoadingSkeleton, ErrorState, EmptyState, PageHeader } from '../components/Primitives.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { formatDateTime } from '../utils/format.js'

const STATUS_FILTERS = ['', 'online', 'stale', 'offline', 'recording']

export default function Monitoring() {
  const { devices, recordings, loading, error, refresh, connected } = useOperations()
  const { label: constableLabel } = useConstableLookup()
  const [statusFilter, setStatusFilter] = useState('')

  if (loading) return <LoadingSkeleton rows={8} />
  if (error) return <ErrorState message={error} onRetry={refresh} />

  const recordingByDevice = Object.fromEntries(recordings.filter((r) => r.status === 'recording').map((r) => [r.device_id, r]))
  const filtered = statusFilter ? devices.filter((d) => d.status === statusFilter) : devices

  return (
    <div>
      <PageHeader
        title="Live Monitoring"
        subtitle={connected ? 'Connected — updating in real time' : 'Disconnected — showing last known data'}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
              statusFilter === s ? 'bg-signal-blue text-white' : 'bg-base-700/60 text-ink-300 hover:bg-base-700'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No devices match" hint="Try a different filter, or check that devices have registered." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((d) => {
            const activeRecording = recordingByDevice[d.id]
            const borderTone =
              d.status === 'offline' ? 'border-signal-red/40' : d.status === 'stale' ? 'border-signal-amber/40' : 'border-base-700'
            return (
              <Link
                key={d.id}
                to={`/devices/${d.id}`}
                className={`panel block border p-4 hover:border-signal-blue/50 ${borderTone}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink-100">{constableLabel(d.constable_id)}</span>
                  <StatusBadge status={d.status} />
                </div>
                {activeRecording && (
                  <p className="mt-1 text-xs font-medium text-red-300">🔴 Recording since {formatDateTime(activeRecording.started_at)}</p>
                )}
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-ink-500">Battery</dt>
                    <dd className="text-ink-100">{d.battery_percent != null ? `${d.battery_percent}%${d.is_charging ? ' ⚡' : ''}` : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Last seen</dt>
                    <dd className="text-ink-100">{formatDateTime(d.last_seen_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Location</dt>
                    <dd className="text-ink-100">{d.latitude != null ? `${d.latitude.toFixed(4)}, ${d.longitude.toFixed(4)}` : 'Location unavailable'}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Device</dt>
                    <dd className="truncate text-ink-100">{d.device_identifier}</dd>
                  </div>
                </dl>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
