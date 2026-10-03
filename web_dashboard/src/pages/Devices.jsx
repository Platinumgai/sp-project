import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useOperations } from '../context/OperationsContext.jsx'
import { useConstableLookup } from '../hooks/useConstableLookup.js'
import { LoadingSkeleton, ErrorState, EmptyState, PageHeader } from '../components/Primitives.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { formatDateTime } from '../utils/format.js'

export default function Devices() {
  const { devices, recordings, loading, error, refresh } = useOperations()
  const { label: constableLabel } = useConstableLookup()
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  if (loading) return <LoadingSkeleton rows={8} />
  if (error) return <ErrorState message={error} onRetry={refresh} />

  const recordingByDevice = Object.fromEntries(recordings.filter((r) => r.status === 'recording').map((r) => [r.device_id, r]))
  const filtered = devices.filter((d) => {
    if (statusFilter && d.status !== statusFilter) return false
    if (search && !d.device_identifier.toLowerCase().includes(search.toLowerCase()) && !constableLabel(d.constable_id).toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div>
      <PageHeader title="Devices" subtitle="All registered constable devices you're authorized to view" />

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search device or constable…"
          className="w-64 rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-sm text-ink-100 outline-none focus:border-signal-blue"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-sm text-ink-100 outline-none focus:border-signal-blue"
        >
          <option value="">All statuses</option>
          <option value="online">Online</option>
          <option value="recording">Recording</option>
          <option value="stale">Stale</option>
          <option value="offline">Offline</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No devices match" />
      ) : (
        <div className="panel overflow-x-auto p-2 scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-ink-500">
                <th className="p-2">Constable</th>
                <th className="p-2">Device</th>
                <th className="p-2">Platform</th>
                <th className="p-2">Status</th>
                <th className="p-2">Battery</th>
                <th className="p-2">Last heartbeat</th>
                <th className="p-2">Recording</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const activeRecording = recordingByDevice[d.id]
                return (
                  <tr key={d.id} className="border-t border-base-700">
                    <td className="p-2">
                      <Link to={`/devices/${d.id}`} className="font-medium text-sky-300 hover:underline">
                        {constableLabel(d.constable_id)}
                      </Link>
                    </td>
                    <td className="p-2 font-mono text-xs text-ink-300">{d.device_identifier}</td>
                    <td className="p-2 text-ink-300">{d.platform || '—'}{d.device_model ? ` · ${d.device_model}` : ''}</td>
                    <td className="p-2"><StatusBadge status={d.status} /></td>
                    <td className="p-2 text-ink-300">{d.battery_percent != null ? `${d.battery_percent}%${d.is_charging ? ' ⚡' : ''}` : '—'}</td>
                    <td className="p-2 text-ink-500">{formatDateTime(d.last_heartbeat_at)}</td>
                    <td className="p-2">{activeRecording ? <span className="text-red-300">🔴 Active</span> : <span className="text-ink-500">Idle</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
