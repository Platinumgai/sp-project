import { useEffect, useState } from 'react'
import { listAuditLogs } from '../api/audit.js'
import { friendlyErrorMessage } from '../api/client.js'
import { LoadingSkeleton, ErrorState, EmptyState, PageHeader } from '../components/Primitives.jsx'
import { formatDateTime } from '../utils/format.js'

const PAGE_SIZE = 50

export default function AuditLogs() {
  const [rows, setRows] = useState([])
  const [actionFilter, setActionFilter] = useState('')
  const [incidentFilter, setIncidentFilter] = useState('')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await listAuditLogs({
        action: actionFilter || undefined,
        incident_id: incidentFilter || undefined,
        limit: PAGE_SIZE,
        offset,
      })
      setRows(data)
    } catch (err) {
      setError(friendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset])

  function applyFilters(e) {
    e.preventDefault()
    setOffset(0)
    load()
  }

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="Security-relevant actions recorded by the backend" />

      <form onSubmit={applyFilters} className="mb-4 flex flex-wrap gap-3">
        <input
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          placeholder="Filter by action (e.g. incident.dispatched)"
          className="w-72 rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-sm text-ink-100 outline-none focus:border-signal-blue"
        />
        <input
          value={incidentFilter}
          onChange={(e) => setIncidentFilter(e.target.value)}
          placeholder="Filter by incident ID"
          className="w-72 rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-sm text-ink-100 outline-none focus:border-signal-blue"
        />
        <button type="submit" className="rounded-lg bg-base-600/60 px-3 py-1.5 text-sm text-ink-100 hover:bg-base-600">
          Apply
        </button>
      </form>

      {loading ? (
        <LoadingSkeleton rows={8} />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState title="No audit records match" />
      ) : (
        <div className="panel overflow-x-auto p-2 scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-ink-500">
                <th className="p-2">Time</th>
                <th className="p-2">Action</th>
                <th className="p-2">Actor</th>
                <th className="p-2">Incident</th>
                <th className="p-2">Evidence</th>
                <th className="p-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-t border-base-700 align-top">
                  <td className="whitespace-nowrap p-2 text-ink-500">{formatDateTime(a.timestamp)}</td>
                  <td className="p-2 font-medium text-ink-100">{a.action}</td>
                  <td className="p-2 font-mono text-xs text-ink-500">{a.user_id ? a.user_id.slice(0, 8) : '—'}</td>
                  <td className="p-2 font-mono text-xs text-ink-500">{a.incident_id ? a.incident_id.slice(0, 8) : '—'}</td>
                  <td className="p-2 font-mono text-xs text-ink-500">{a.evidence_id ? a.evidence_id.slice(0, 8) : '—'}</td>
                  <td className="max-w-xs p-2">
                    <code className="block max-w-xs truncate text-xs text-ink-300">{JSON.stringify(a.details || {})}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-ink-500">
        <span>
          Showing {offset + 1}–{offset + rows.length}
        </span>
        <div className="flex gap-2">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="rounded-lg bg-base-700/60 px-3 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            disabled={rows.length < PAGE_SIZE}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="rounded-lg bg-base-700/60 px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
