import { useEffect, useState } from 'react'
import { listAllCommands } from '../api/commands.js'
import { useConstableLookup } from '../hooks/useConstableLookup.js'
import { friendlyErrorMessage } from '../api/client.js'
import { LoadingSkeleton, ErrorState, EmptyState, PageHeader } from '../components/Primitives.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { formatDateTime, titleCase } from '../utils/format.js'

const STATUS_OPTIONS = ['', 'pending', 'sent', 'acknowledged', 'executed', 'failed', 'timeout', 'cancelled']
const TYPE_OPTIONS = ['', 'start_recording', 'stop_recording']
const PAGE_SIZE = 50

export default function Commands() {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('')
  const [commandType, setCommandType] = useState('')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      setRows(await listAllCommands({ status: status || undefined, command_type: commandType || undefined, limit: PAGE_SIZE, offset }))
    } catch (err) {
      setError(friendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, commandType, offset])

  return (
    <div>
      <PageHeader title="Commands" subtitle="Remote command history across all devices -- GET /commands/" />

      <div className="mb-4 flex flex-wrap gap-3">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0) }} className="rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-sm text-ink-100">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.filter(Boolean).map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </select>
        <select value={commandType} onChange={(e) => { setCommandType(e.target.value); setOffset(0) }} className="rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-sm text-ink-100">
          <option value="">All command types</option>
          {TYPE_OPTIONS.filter(Boolean).map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
        </select>
      </div>

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState title="No commands match" />
      ) : (
        <div className="panel overflow-x-auto p-2 scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-ink-500">
                <th className="p-2">Command</th>
                <th className="p-2">Status</th>
                <th className="p-2">Created</th>
                <th className="p-2">Acknowledged</th>
                <th className="p-2">Executed</th>
                <th className="p-2">Failure</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-base-700">
                  <td className="p-2 text-ink-100">{titleCase(c.command_type)}</td>
                  <td className="p-2"><StatusBadge status={c.status} /></td>
                  <td className="p-2 text-ink-500">{formatDateTime(c.created_at)}</td>
                  <td className="p-2 text-ink-500">{formatDateTime(c.acknowledged_at)}</td>
                  <td className="p-2 text-ink-500">{formatDateTime(c.executed_at)}</td>
                  <td className="p-2 text-red-300">{c.failure_reason || '—'}</td>
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
