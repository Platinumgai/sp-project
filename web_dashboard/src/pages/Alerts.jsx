import { useEffect, useState } from 'react'
import { listAlerts } from '../api/alerts.js'
import { useConstableLookup } from '../hooks/useConstableLookup.js'
import { friendlyErrorMessage } from '../api/client.js'
import { LoadingSkeleton, ErrorState, EmptyState, PageHeader } from '../components/Primitives.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { formatDateTime, titleCase } from '../utils/format.js'

const STATUS_OPTIONS = ['', 'open', 'acknowledged', 'resolved']
const SEVERITY_OPTIONS = ['', 'warning', 'critical']
const TYPE_OPTIONS = ['', 'low_battery', 'critical_battery', 'device_offline', 'device_stale', 'recording_device_offline', 'command_failed', 'command_timeout']
const PAGE_SIZE = 50

export default function Alerts() {
  const { label: constableLabel } = useConstableLookup()
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('')
  const [severity, setSeverity] = useState('')
  const [type, setType] = useState('')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      setRows(await listAlerts({ status: status || undefined, severity: severity || undefined, type: type || undefined, limit: PAGE_SIZE, offset }))
    } catch (err) {
      setError(friendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, severity, type, offset])

  return (
    <div>
      <PageHeader title="Alerts" subtitle="Persisted device/battery/recording/command alerts -- GET /alerts/" />

      <div className="mb-4 flex flex-wrap gap-3">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0) }} className="rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-sm text-ink-100">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.filter(Boolean).map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </select>
        <select value={severity} onChange={(e) => { setSeverity(e.target.value); setOffset(0) }} className="rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-sm text-ink-100">
          <option value="">All severities</option>
          {SEVERITY_OPTIONS.filter(Boolean).map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </select>
        <select value={type} onChange={(e) => { setType(e.target.value); setOffset(0) }} className="rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-sm text-ink-100">
          <option value="">All types</option>
          {TYPE_OPTIONS.filter(Boolean).map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
        </select>
      </div>

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState title="No alerts match" hint="No active alerts -- all monitored devices are within normal parameters." />
      ) : (
        <div className="panel overflow-x-auto p-2 scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-ink-500">
                <th className="p-2">Severity</th>
                <th className="p-2">Type</th>
                <th className="p-2">Constable</th>
                <th className="p-2">Message</th>
                <th className="p-2">Status</th>
                <th className="p-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className={`border-t border-base-700 ${a.severity === 'critical' && a.status === 'open' ? 'bg-signal-red/5' : ''}`}>
                  <td className="p-2"><StatusBadge status={a.severity} /></td>
                  <td className="p-2 text-ink-100">{titleCase(a.type)}</td>
                  <td className="p-2 text-ink-300">{constableLabel(a.constable_id)}</td>
                  <td className="p-2 text-ink-300">{a.message || '—'}</td>
                  <td className="p-2"><StatusBadge status={a.status} /></td>
                  <td className="p-2 text-ink-500">{formatDateTime(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-ink-500">
        <span>Showing {offset + 1}–{offset + rows.length}</span>
        <div className="flex gap-2">
          <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} className="rounded-lg bg-base-700/60 px-3 py-1 disabled:opacity-40">Previous</button>
          <button disabled={rows.length < PAGE_SIZE} onClick={() => setOffset(offset + PAGE_SIZE)} className="rounded-lg bg-base-700/60 px-3 py-1 disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  )
}
