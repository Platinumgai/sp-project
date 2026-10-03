import { Link } from 'react-router-dom'
import { useOperations } from '../context/OperationsContext.jsx'
import { useConstableLookup } from '../hooks/useConstableLookup.js'
import { LoadingSkeleton, ErrorState, EmptyState, PageHeader } from '../components/Primitives.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { formatDateTime, titleCase } from '../utils/format.js'

function StatCard({ label, value, tone }) {
  const toneClass = { red: 'text-red-300', amber: 'text-amber-300', green: 'text-emerald-300', default: 'text-ink-100' }[tone || 'default']
  return (
    <div className="panel p-4">
      <p className="text-xs uppercase tracking-wide text-ink-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  )
}

function elapsed(startedAt) {
  if (!startedAt) return '—'
  const ms = Date.now() - new Date(startedAt).getTime()
  if (ms < 0) return '—'
  const mins = Math.floor(ms / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function Dashboard() {
  const { devices, alerts, recordings, loading, error, refresh } = useOperations()
  const { label: constableLabel } = useConstableLookup()

  if (loading) return <LoadingSkeleton rows={6} />
  if (error) return <ErrorState message={error} onRetry={refresh} />

  const deviceById = Object.fromEntries(devices.map((d) => [d.id, d]))
  const activeRecordings = recordings.filter((r) => r.status === 'recording')
  const criticalAlerts = alerts.filter((a) => a.status === 'open' && a.severity === 'critical')
  const onlineCount = devices.filter((d) => d.status === 'online' || d.status === 'recording').length
  const staleCount = devices.filter((d) => d.status === 'stale').length
  const offlineCount = devices.filter((d) => d.status === 'offline').length

  return (
    <div>
      <PageHeader title="Control Room" subtitle="Live operational status across all authorized devices and constables" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Online Devices" value={onlineCount} tone="green" />
        <StatCard label="Active Recordings" value={activeRecordings.length} tone={activeRecordings.length > 0 ? 'red' : 'default'} />
        <StatCard label="Critical Alerts" value={criticalAlerts.length} tone={criticalAlerts.length > 0 ? 'red' : 'default'} />
        <StatCard label="Offline Devices" value={offlineCount} tone={offlineCount > 0 ? 'amber' : 'default'} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Stale" value={staleCount} tone={staleCount > 0 ? 'amber' : 'default'} />
        <StatCard label="Total Devices" value={devices.length} />
        <StatCard label="Open Alerts" value={alerts.filter((a) => a.status === 'open').length} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-ink-100">Active emergency recordings</h2>
            <Link to="/recordings" className="text-sm text-sky-300 hover:underline">View all</Link>
          </div>
          {activeRecordings.length === 0 ? (
            <EmptyState title="No active recordings" hint="Recordings will appear here the moment a constable starts one." />
          ) : (
            <ul className="space-y-2">
              {activeRecordings.map((r) => {
                const device = deviceById[r.device_id]
                return (
                  <li key={r.id} className="rounded-lg border border-signal-red/30 bg-signal-red/5 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <Link to={`/recordings/${r.id}`} className="font-medium text-red-200 hover:underline">
                        🔴 {constableLabel(r.constable_id)}
                      </Link>
                      <StatusBadge status={r.trigger_type} />
                    </div>
                    <p className="mt-1 text-xs text-ink-500">
                      Started {formatDateTime(r.started_at)} · elapsed {elapsed(r.started_at)} · chunk {r.highest_chunk_number ?? 0}
                      {device && <> · battery {device.battery_percent != null ? `${device.battery_percent}%` : '—'}</>}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-ink-100">Critical alerts</h2>
            <Link to="/alerts" className="text-sm text-sky-300 hover:underline">View all</Link>
          </div>
          {criticalAlerts.length === 0 ? (
            <EmptyState title="No critical alerts" hint="All monitored devices are within normal parameters." />
          ) : (
            <ul className="space-y-2">
              {criticalAlerts.slice(0, 8).map((a) => (
                <li key={a.id} className="rounded-lg border border-signal-red/30 bg-signal-red/5 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-red-200">{titleCase(a.type)}</span>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {constableLabel(a.constable_id)} · {formatDateTime(a.created_at)}
                  </p>
                  {a.message && <p className="mt-1 text-xs text-ink-300">{a.message}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel mt-6 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-ink-100">Live device status</h2>
          <Link to="/monitoring" className="text-sm text-sky-300 hover:underline">Open live monitoring</Link>
        </div>
        {devices.length === 0 ? (
          <EmptyState title="No devices registered yet" />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-500">
                  <th className="pb-2">Constable</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Battery</th>
                  <th className="pb-2">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {devices.slice(0, 8).map((d) => (
                  <tr key={d.id} className="border-t border-base-700">
                    <td className="py-2">
                      <Link to={`/devices/${d.id}`} className="text-sky-300 hover:underline">
                        {constableLabel(d.constable_id)}
                      </Link>
                    </td>
                    <td className="py-2"><StatusBadge status={d.status} /></td>
                    <td className="py-2 text-ink-300">{d.battery_percent != null ? `${d.battery_percent}%${d.is_charging ? ' ⚡' : ''}` : '—'}</td>
                    <td className="py-2 text-ink-500">{formatDateTime(d.last_seen_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
