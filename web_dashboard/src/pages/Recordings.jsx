import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listRecordings } from '../api/recordings.js'
import { useConstableLookup } from '../hooks/useConstableLookup.js'
import { friendlyErrorMessage } from '../api/client.js'
import { LoadingSkeleton, ErrorState, EmptyState, PageHeader } from '../components/Primitives.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { formatDateTime, titleCase } from '../utils/format.js'

const STATUS_OPTIONS = ['', 'recording', 'completed', 'cancelled', 'failed']
const PAGE_SIZE = 25

export default function Recordings() {
  const { label: constableLabel } = useConstableLookup()
  const [rows, setRows] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      setRows(await listRecordings({ status: statusFilter || undefined, limit: PAGE_SIZE, offset }))
    } catch (err) {
      setError(friendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, offset])

  return (
    <div>
      <PageHeader title="Recordings" subtitle="Body-camera recording sessions -- using GET /recordings/ pagination" />

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s || 'all'}
            onClick={() => {
              setStatusFilter(s)
              setOffset(0)
            }}
            className={`rounded-lg px-3 py-1.5 text-sm capitalize ${statusFilter === s ? 'bg-signal-blue text-white' : 'bg-base-700/60 text-ink-300 hover:bg-base-700'}`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState title="No recordings match" />
      ) : (
        <div className="panel overflow-x-auto p-2 scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-ink-500">
                <th className="p-2">Constable</th>
                <th className="p-2">Trigger</th>
                <th className="p-2">Status</th>
                <th className="p-2">Started</th>
                <th className="p-2">Chunks</th>
                <th className="p-2">Missing</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-base-700">
                  <td className="p-2">
                    <Link to={`/recordings/${r.id}`} className="font-medium text-sky-300 hover:underline">
                      {constableLabel(r.constable_id)}
                    </Link>
                  </td>
                  <td className="p-2 text-ink-300">{titleCase(r.trigger_type)}</td>
                  <td className="p-2"><StatusBadge status={r.status} /></td>
                  <td className="p-2 text-ink-500">{formatDateTime(r.started_at)}</td>
                  <td className="p-2 text-ink-300">{r.chunk_count}</td>
                  <td className="p-2">{r.missing_chunk_numbers?.length > 0 ? <span className="text-red-300">{r.missing_chunk_numbers.length}</span> : <span className="text-ink-500">0</span>}</td>
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
