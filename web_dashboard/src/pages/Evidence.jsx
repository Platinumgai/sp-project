import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { listEvidence, uploadEvidence, verifyEvidence, rejectEvidence, archiveEvidence, evidenceStreamUrl, downloadEvidence } from '../api/evidence.js'
import { listIncidents } from '../api/incidents.js'
import { friendlyErrorMessage } from '../api/client.js'
import { LoadingSkeleton, ErrorState, EmptyState, PageHeader } from '../components/Primitives.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { canUploadEvidence, canVerifyEvidence } from '../utils/roles.js'
import { formatBytes, formatDateTime } from '../utils/format.js'

export default function Evidence() {
  const { user } = useAuth()
  const { notify } = useToast()
  const [items, setItems] = useState([])
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [preview, setPreview] = useState(null)
  const [busyId, setBusyId] = useState(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [ev, inc] = await Promise.all([listEvidence(), listIncidents()])
      setItems(ev)
      setIncidents(inc)
    } catch (err) {
      setError(friendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function runAction(id, fn, message) {
    setBusyId(id)
    try {
      await fn()
      notify(message, { tone: 'success' })
      await load()
    } catch (err) {
      notify(friendlyErrorMessage(err), { tone: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Evidence"
        subtitle="Upload, stream, verify, reject, or archive according to your role"
        actions={
          canUploadEvidence(user?.role) && (
            <button
              onClick={() => setShowUpload(true)}
              className="rounded-lg bg-signal-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
            >
              + Upload evidence
            </button>
          )
        }
      />

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState title="No evidence available" hint="Evidence you're authorized to see will appear here." />
      ) : (
        <div className="panel overflow-x-auto p-2 scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-ink-500">
                <th className="p-2">File</th>
                <th className="p-2">Type</th>
                <th className="p-2">Status</th>
                <th className="p-2">Size</th>
                <th className="p-2">Incident</th>
                <th className="p-2">Uploaded</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="border-t border-base-700">
                  <td className="p-2">
                    <button onClick={() => setPreview(m)} className="font-medium text-sky-300 hover:underline">
                      {m.original_filename || m.type}
                    </button>
                  </td>
                  <td className="p-2 text-ink-300">{m.mime_type || m.type}</td>
                  <td className="p-2">
                    <StatusBadge status={m.upload_status} />
                  </td>
                  <td className="p-2 text-ink-500">{formatBytes(m.file_size)}</td>
                  <td className="p-2 font-mono text-xs text-ink-500">{m.incident_id?.slice(0, 8)}</td>
                  <td className="p-2 text-ink-500">{formatDateTime(m.timestamp)}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setPreview(m)}
                        className="rounded-md bg-base-600/50 px-2 py-1 text-xs text-ink-100 hover:bg-base-600"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => downloadEvidence(m.id, m.original_filename).catch((err) => notify(friendlyErrorMessage(err), { tone: 'error' }))}
                        className="rounded-md bg-base-600/50 px-2 py-1 text-xs text-ink-100 hover:bg-base-600"
                      >
                        Download
                      </button>
                      {canVerifyEvidence(user?.role) && m.upload_status === 'uploaded' && (
                        <>
                          <button
                            disabled={busyId === m.id}
                            onClick={() => runAction(m.id, () => verifyEvidence(m.id), 'Evidence verified')}
                            className="rounded-md bg-signal-green/15 px-2 py-1 text-xs text-emerald-300 hover:bg-signal-green/25 disabled:opacity-50"
                          >
                            Verify
                          </button>
                          <button
                            disabled={busyId === m.id}
                            onClick={() => runAction(m.id, () => rejectEvidence(m.id, window.prompt('Rejection reason (optional):') || ''), 'Evidence rejected')}
                            className="rounded-md bg-signal-red/15 px-2 py-1 text-xs text-red-300 hover:bg-signal-red/25 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {canVerifyEvidence(user?.role) && m.upload_status === 'verified' && (
                        <button
                          disabled={busyId === m.id}
                          onClick={() => runAction(m.id, () => archiveEvidence(m.id), 'Evidence archived')}
                          className="rounded-md bg-base-600/50 px-2 py-1 text-xs text-ink-100 hover:bg-base-600 disabled:opacity-50"
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showUpload && (
        <UploadModal
          incidents={incidents}
          onClose={() => setShowUpload(false)}
          onUploaded={async () => {
            setShowUpload(false)
            notify('Evidence uploaded', { tone: 'success' })
            await load()
          }}
        />
      )}

      {preview && <PreviewModal item={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}

function UploadModal({ incidents, onClose, onUploaded }) {
  const { notify } = useToast()
  const [incidentId, setIncidentId] = useState('')
  const [type, setType] = useState('photo')
  const [comment, setComment] = useState('')
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file || !incidentId) return
    setSubmitting(true)
    setProgress(0)
    try {
      await uploadEvidence({
        incidentId,
        type,
        file,
        comment,
        onUploadProgress: (evt) => {
          if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100))
        },
      })
      onUploaded()
    } catch (err) {
      notify(friendlyErrorMessage(err), { tone: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="panel w-full max-w-md p-5">
        <h2 className="mb-4 text-base font-semibold text-ink-100">Upload evidence</h2>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-ink-300">Incident</span>
            <select
              required
              value={incidentId}
              onChange={(e) => setIncidentId(e.target.value)}
              className="w-full rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-ink-100 outline-none focus:border-signal-blue"
            >
              <option value="">Select incident…</option>
              {incidents.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.display_id || i.id} — {i.description || 'no description'}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-ink-300">Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-ink-100 outline-none focus:border-signal-blue"
            >
              <option value="photo">Photo</option>
              <option value="audio">Audio</option>
              <option value="video">Video</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-ink-300">Comment (optional)</span>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full rounded-lg border border-base-600 bg-base-700/60 px-3 py-1.5 text-ink-100 outline-none focus:border-signal-blue"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-ink-300">File</span>
            <input
              type="file"
              required
              accept="image/*,audio/*,video/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-ink-300 file:mr-3 file:rounded-md file:border-0 file:bg-base-600 file:px-3 file:py-1.5 file:text-sm file:text-ink-100"
            />
          </label>
          {submitting && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-base-700">
              <div className="h-full bg-signal-blue transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-lg px-3 py-1.5 text-sm text-ink-300 hover:bg-base-700">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !file || !incidentId}
            className="rounded-lg bg-signal-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {submitting ? `Uploading… ${progress}%` : 'Upload'}
          </button>
        </div>
      </form>
    </div>
  )
}

function PreviewModal({ item, onClose }) {
  const url = evidenceStreamUrl(item.id)
  const mime = item.mime_type || ''
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="panel w-full max-w-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-ink-100">{item.original_filename || item.type}</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-100">
            ✕
          </button>
        </div>
        {mime.startsWith('image/') ? (
          <img src={url} alt={item.original_filename || 'evidence'} className="max-h-[60vh] w-full rounded-lg object-contain" />
        ) : mime.startsWith('audio/') ? (
          <audio controls src={url} className="w-full" />
        ) : mime.startsWith('video/') ? (
          <video controls src={url} className="max-h-[60vh] w-full rounded-lg" />
        ) : (
          <p className="text-sm text-ink-300">
            No inline preview available for this file type.{' '}
            <a href={url} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">
              Open in new tab
            </a>
          </p>
        )}
      </div>
    </div>
  )
}
