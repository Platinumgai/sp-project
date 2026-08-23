import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getRecording, getRecordingManifest } from '../api/recordings.js'
import { useConstableLookup } from '../hooks/useConstableLookup.js'
import { friendlyErrorMessage } from '../api/client.js'
import { LoadingSkeleton, ErrorState, EmptyState } from '../components/Primitives.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { formatDateTime, formatBytes, titleCase } from '../utils/format.js'

export default function RecordingDetails() {
  const { id } = useParams()
  const { label: constableLabel } = useConstableLookup()
  const [recording, setRecording] = useState(null)
  const [manifest, setManifest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [r, m] = await Promise.all([getRecording(id), getRecordingManifest(id)])
      setRecording(r)
      setManifest(m)
    } catch (err) {
      setError(friendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) return <LoadingSkeleton rows={8} />
  if (error) return <ErrorState message={error} onRetry={load} />
  if (!recording) return <EmptyState title="Recording not found" />

  const missingSet = new Set(manifest?.missing_chunk_numbers || [])
  const highest = manifest?.highest_chunk_number || 0
  const timeline = Array.from({ length: highest }, (_, i) => i + 1)

  return (
    <div className="space-y-6">
      <div>
        <Link to="/recordings" className="text-sm text-sky-300 hover:underline">← Back to recordings</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-ink-100">{constableLabel(recording.constable_id)}</h1>
          <StatusBadge status={recording.status} />
        </div>
        <p className="mt-1 font-mono text-xs text-ink-500">{recording.id}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="panel p-4 lg:col-span-2">
          <h2 className="mb-3 font-semibold text-ink-100">Recording details</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-ink-500">Trigger</dt><dd className="text-ink-100">{titleCase(recording.trigger_type)}</dd></div>
            <div><dt className="text-ink-500">Started</dt><dd className="text-ink-100">{formatDateTime(recording.started_at)}</dd></div>
            <div><dt className="text-ink-500">Ended</dt><dd className="text-ink-100">{formatDateTime(recording.ended_at)}</dd></div>
            <div><dt className="text-ink-500">Chunks received</dt><dd className="text-ink-100">{recording.chunk_count}</dd></div>
            <div><dt className="text-ink-500">Highest chunk</dt><dd className="text-ink-100">{recording.highest_chunk_number ?? '—'}</dd></div>
            <div><dt className="text-ink-500">Missing chunks</dt><dd className={recording.missing_chunk_numbers?.length > 0 ? 'text-red-300' : 'text-ink-100'}>{recording.missing_chunk_numbers?.length || 0}</dd></div>
            <div><dt className="text-ink-500">Incident link</dt><dd className="text-ink-100">{recording.incident_id ? recording.incident_id.slice(0, 8) : '—'}</dd></div>
            <div><dt className="text-ink-500">Complete</dt><dd className="text-ink-100">{manifest?.is_complete ? 'Yes' : 'No'}</dd></div>
          </dl>
        </section>

        <section className="panel p-4">
          <h2 className="mb-3 font-semibold text-ink-100">Playback</h2>
          <p className="text-sm text-ink-300">
            This system provides an ordered chunk manifest, not a continuous live video stream. Individual chunks can be
            reviewed below; a unified playback experience is not currently available from this API.
          </p>
        </section>
      </div>

      <section className="panel p-4">
        <h2 className="mb-3 font-semibold text-ink-100">Chunk timeline</h2>
        {timeline.length === 0 ? (
          <EmptyState title="No chunks received yet" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {timeline.map((n) => {
              const missing = missingSet.has(n)
              return (
                <div
                  key={n}
                  title={missing ? `Chunk ${n} — missing` : `Chunk ${n} — received`}
                  className={`flex h-12 w-12 flex-col items-center justify-center rounded-lg border text-xs font-medium ${
                    missing ? 'border-signal-red/40 bg-signal-red/10 text-red-300' : 'border-signal-green/40 bg-signal-green/10 text-emerald-300'
                  }`}
                >
                  <span>{n}</span>
                  <span>{missing ? '✗' : '✓'}</span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="panel p-4">
        <h2 className="mb-3 font-semibold text-ink-100">Chunk metadata</h2>
        {manifest?.chunks?.length ? (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-500">
                  <th className="pb-2">#</th>
                  <th className="pb-2">Size</th>
                  <th className="pb-2">Duration</th>
                  <th className="pb-2">MIME</th>
                  <th className="pb-2">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {manifest.chunks.map((c) => (
                  <tr key={c.id} className="border-t border-base-700">
                    <td className="py-2 text-ink-100">{c.chunk_number}{c.is_last_chunk ? ' (last)' : ''}</td>
                    <td className="py-2 text-ink-300">{formatBytes(c.file_size)}</td>
                    <td className="py-2 text-ink-300">{c.duration_seconds != null ? `${c.duration_seconds}s` : '—'}</td>
                    <td className="py-2 text-ink-300">{c.mime_type || '—'}</td>
                    <td className="py-2 text-ink-500">{formatDateTime(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No chunk metadata available" />
        )}
      </section>
    </div>
  )
}
