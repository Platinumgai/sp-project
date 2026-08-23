import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { listIncidents, verifyIncident, rejectIncident, dispatchIncident, getResponsibleStations } from '../api/incidents.js'
import { listEvidence, evidenceStreamUrl } from '../api/evidence.js'
import { fetchMyIncidents, acceptAssignment, rejectAssignment, updateMyAssignmentStatus } from '../api/constables.js'
import { friendlyErrorMessage } from '../api/client.js'
import { LoadingSkeleton, ErrorState, EmptyState } from '../components/Primitives.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { canVerifyIncident, canDispatch, isConstable } from '../utils/roles.js'
import { formatDateTime, formatBytes } from '../utils/format.js'

const NEXT_STATUS = { accepted: 'en_route', en_route: 'arrived', arrived: 'completed' }

export default function IncidentDetails() {
  const { id } = useParams()
  const { user } = useAuth()
  const { notify } = useToast()
  const [incident, setIncident] = useState(null)
  const [evidence, setEvidence] = useState([])
  const [stations, setStations] = useState(null)
  const [myAssignment, setMyAssignment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [allIncidents, allEvidence] = await Promise.all([listIncidents(), listEvidence()])
      const found = allIncidents.find((i) => i.id === id)
      setIncident(found || null)
      setEvidence(allEvidence.filter((m) => m.incident_id === id))

      if (found && canVerifyIncident(user?.role)) {
        try {
          setStations(await getResponsibleStations(id))
        } catch {
          setStations(null)
        }
      }

      if (isConstable(user?.role)) {
        const mine = await fetchMyIncidents()
        setMyAssignment(mine.find((row) => row.incident_id === id) || null)
      }
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

  async function runAction(fn, successMessage) {
    setBusy(true)
    try {
      await fn()
      notify(successMessage, { tone: 'success' })
      await load()
    } catch (err) {
      notify(friendlyErrorMessage(err), { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingSkeleton rows={6} />
  if (error) return <ErrorState message={error} onRetry={load} />
  if (!incident) {
    return (
      <EmptyState
        title="Incident not found"
        hint="It may not exist, or you may not be authorized to view it."
        action={
          <Link to="/incidents" className="text-sm text-sky-300 hover:underline">
            Back to incidents
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/incidents" className="text-sm text-sky-300 hover:underline">
          ← Back to incidents
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-ink-100">{incident.display_id || incident.id}</h1>
          <StatusBadge status={incident.status} />
        </div>
        <p className="mt-1 font-mono text-xs text-ink-500">{incident.id}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="panel p-4 lg:col-span-2">
          <h2 className="mb-3 font-semibold text-ink-100">Details</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-ink-500">Description</dt>
              <dd className="text-ink-100">{incident.description || '—'}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Created</dt>
              <dd className="text-ink-100">{formatDateTime(incident.created_at)}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Station</dt>
              <dd className="font-mono text-xs text-ink-100">{incident.station_id || '—'}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Location (WKT)</dt>
              <dd className="font-mono text-xs text-ink-100">{incident.location || '—'}</dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            {canVerifyIncident(user?.role) && incident.status === 'new' && (
              <>
                <button
                  disabled={busy}
                  onClick={() => runAction(() => verifyIncident(incident.id), 'Incident verified')}
                  className="rounded-lg bg-signal-green/15 px-3 py-1.5 text-sm text-emerald-300 hover:bg-signal-green/25 disabled:opacity-50"
                >
                  Verify
                </button>
                <button
                  disabled={busy}
                  onClick={() => runAction(() => rejectIncident(incident.id, window.prompt('Reason (optional):') || ''), 'Incident rejected')}
                  className="rounded-lg bg-signal-red/15 px-3 py-1.5 text-sm text-red-300 hover:bg-signal-red/25 disabled:opacity-50"
                >
                  Reject
                </button>
              </>
            )}
            {canDispatch(user?.role) && incident.status === 'verified' && (
              <button
                disabled={busy}
                onClick={() => runAction(() => dispatchIncident(incident.id), 'Dispatch attempted')}
                className="rounded-lg bg-signal-blue/15 px-3 py-1.5 text-sm text-sky-300 hover:bg-signal-blue/25 disabled:opacity-50"
              >
                Dispatch
              </button>
            )}
          </div>

          {stations && (
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-base-700 pt-4 text-sm">
              <div>
                <p className="text-ink-500">Primary station</p>
                <p className="text-ink-100">
                  {stations.primary_station ? `${stations.primary_station.name} (${stations.primary_station.distance_meters?.toFixed(0)} m)` : '—'}
                </p>
              </div>
              <div>
                <p className="text-ink-500">Backup station</p>
                <p className="text-ink-100">
                  {stations.backup_station ? `${stations.backup_station.name} (${stations.backup_station.distance_meters?.toFixed(0)} m)` : '—'}
                </p>
              </div>
            </div>
          )}

          {myAssignment && (
            <div className="mt-4 border-t border-base-700 pt-4">
              <h3 className="mb-2 text-sm font-semibold text-ink-100">My assignment</h3>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={myAssignment.assignment_status} />
                {myAssignment.assignment_status === 'pending' && (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => runAction(() => acceptAssignment(incident.id), 'Assignment accepted')}
                      className="rounded-lg bg-signal-green/15 px-3 py-1.5 text-sm text-emerald-300 hover:bg-signal-green/25 disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => runAction(() => rejectAssignment(incident.id, window.prompt('Reason (optional):') || ''), 'Assignment rejected')}
                      className="rounded-lg bg-signal-red/15 px-3 py-1.5 text-sm text-red-300 hover:bg-signal-red/25 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </>
                )}
                {NEXT_STATUS[myAssignment.assignment_status] && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      runAction(
                        () => updateMyAssignmentStatus(incident.id, NEXT_STATUS[myAssignment.assignment_status]),
                        `Marked as ${NEXT_STATUS[myAssignment.assignment_status].replace('_', ' ')}`,
                      )
                    }
                    className="rounded-lg bg-signal-blue/15 px-3 py-1.5 text-sm text-sky-300 hover:bg-signal-blue/25 disabled:opacity-50"
                  >
                    Mark {NEXT_STATUS[myAssignment.assignment_status].replace('_', ' ')}
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="panel p-4">
          <h2 className="mb-3 font-semibold text-ink-100">Evidence ({evidence.length})</h2>
          {evidence.length === 0 ? (
            <EmptyState title="No evidence" hint="Evidence linked to this incident will appear here." />
          ) : (
            <ul className="space-y-2">
              {evidence.map((m) => (
                <li key={m.id} className="rounded-lg border border-base-700 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-ink-100">{m.original_filename || m.type}</span>
                    <StatusBadge status={m.upload_status} />
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {m.type} · {formatBytes(m.file_size)} · {formatDateTime(m.timestamp)}
                  </p>
                  <a
                    href={evidenceStreamUrl(m.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs text-sky-300 hover:underline"
                  >
                    Open evidence
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
