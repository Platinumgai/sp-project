import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useOperations } from '../context/OperationsContext.jsx'
import { useConstableLookup } from '../hooks/useConstableLookup.js'
import { getDevice } from '../api/devices.js'
import { listAlerts } from '../api/alerts.js'
import { listDeviceCommands, issueCommand, cancelCommand } from '../api/commands.js'
import { stopLiveStream } from '../api/liveStream.js'
import { friendlyErrorMessage } from '../api/client.js'
import { LoadingSkeleton, ErrorState, EmptyState, ConfirmDialog } from '../components/Primitives.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import LiveVideoView from '../components/LiveVideoView.jsx'
import { canIssueCommands } from '../utils/roles.js'
import { formatDateTime, titleCase } from '../utils/format.js'

const COMMAND_STAGES = ['pending', 'sent', 'acknowledged', 'executed']

function CommandProgress({ status }) {
  if (status === 'failed' || status === 'timeout' || status === 'cancelled') {
    return <StatusBadge status={status} />
  }
  const idx = COMMAND_STAGES.indexOf(status)
  return (
    <div className="flex items-center gap-1">
      {COMMAND_STAGES.map((stage, i) => (
        <span
          key={stage}
          title={titleCase(stage)}
          className={`h-2 w-6 rounded-full ${i <= idx ? 'bg-signal-blue' : 'bg-base-600'}`}
        />
      ))}
      <span className="ml-2 text-xs capitalize text-ink-300">{status}</span>
    </div>
  )
}

export default function DeviceDetails() {
  const { id } = useParams()
  const { user } = useAuth()
  const { notify } = useToast()
  const { recordings, liveStreams = [] } = useOperations()
  const { label: constableLabel } = useConstableLookup()

  const [device, setDevice] = useState(null)
  const [deviceAlerts, setDeviceAlerts] = useState([])
  const [commands, setCommands] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(null) // 'start_recording' | 'stop_recording' | 'start_live_stream' | 'stop_live_stream' | null
  const [busy, setBusy] = useState(false)
  const [watchingSessionId, setWatchingSessionId] = useState(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [d, a, c] = await Promise.all([
        getDevice(id),
        listAlerts({ device_id: id, limit: 20 }),
        listDeviceCommands(id).catch(() => []), // constable role viewing another device would 403 -- degrade gracefully
      ])
      setDevice(d)
      setDeviceAlerts(a)
      setCommands(c)
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

  async function handleIssueCommand(commandType) {
    setBusy(true)
    try {
      await issueCommand(id, commandType)
      notify(`Command sent: ${titleCase(commandType)}`, { tone: 'success' })
      setConfirming(null)
      await load()
    } catch (err) {
      notify(friendlyErrorMessage(err), { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function handleStopLive(sessionId) {
    setBusy(true)
    try {
      await stopLiveStream(sessionId)
      notify('Live stream stopped', { tone: 'success' })
      setWatchingSessionId(null)
      setConfirming(null)
    } catch (err) {
      notify(friendlyErrorMessage(err), { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel(commandId) {
    try {
      await cancelCommand(commandId)
      notify('Command cancelled', { tone: 'success' })
      await load()
    } catch (err) {
      notify(friendlyErrorMessage(err), { tone: 'error' })
    }
  }

  if (loading) return <LoadingSkeleton rows={8} />
  if (error) return <ErrorState message={error} onRetry={load} />
  if (!device) return <EmptyState title="Device not found" />

  const deviceRecordings = recordings.filter((r) => r.device_id === id)
  const liveSession = liveStreams.find((s) => s.device_id === id)

  return (
    <div className="space-y-6">
      <div>
        <Link to="/devices" className="text-sm text-sky-300 hover:underline">← Back to devices</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-ink-100">{constableLabel(device.constable_id)}</h1>
          <StatusBadge status={device.status} />
        </div>
        <p className="mt-1 font-mono text-xs text-ink-500">{device.device_identifier}</p>
      </div>

      <section className="panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-ink-100">Live camera</h2>
          {liveSession && <StatusBadge status="live" />}
        </div>

        {!liveSession && (
          <>
            <EmptyState title="Not currently live" />
            {canIssueCommands(user?.role) && (
              <button
                onClick={() => setConfirming('start_live_stream')}
                className="mt-3 rounded-lg bg-signal-red/15 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-signal-red/25"
              >
                Request live stream
              </button>
            )}
          </>
        )}

        {liveSession && !watchingSessionId && (
          <button
            onClick={() => setWatchingSessionId(liveSession.id)}
            className="rounded-lg bg-signal-blue/15 px-3 py-1.5 text-sm font-medium text-sky-300 hover:bg-signal-blue/25"
          >
            Watch live
          </button>
        )}

        {liveSession && watchingSessionId === liveSession.id && (
          <div className="max-w-xl">
            <LiveVideoView sessionId={liveSession.id} onClose={() => setWatchingSessionId(null)} />
          </div>
        )}

        {liveSession && canIssueCommands(user?.role) && (
          <button
            onClick={() => setConfirming('stop_live_stream')}
            className="mt-3 rounded-lg bg-base-600/60 px-3 py-1.5 text-sm text-ink-100 hover:bg-base-600"
          >
            Stop live stream
          </button>
        )}
        <p className="mt-2 text-xs text-ink-500">
          Live only -- nothing here is ever recorded or stored.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="panel p-4 lg:col-span-2">
          <h2 className="mb-3 font-semibold text-ink-100">Device information</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-ink-500">Platform</dt><dd className="text-ink-100">{device.platform || '—'}</dd></div>
            <div><dt className="text-ink-500">Model</dt><dd className="text-ink-100">{device.device_model || '—'}</dd></div>
            <div><dt className="text-ink-500">App version</dt><dd className="text-ink-100">{device.app_version || '—'}</dd></div>
            <div><dt className="text-ink-500">Battery</dt><dd className="text-ink-100">{device.battery_percent != null ? `${device.battery_percent}%${device.is_charging ? ' (charging)' : ''}` : '—'}</dd></div>
            <div><dt className="text-ink-500">Last heartbeat</dt><dd className="text-ink-100">{formatDateTime(device.last_heartbeat_at)}</dd></div>
            <div><dt className="text-ink-500">Last seen</dt><dd className="text-ink-100">{formatDateTime(device.last_seen_at)}</dd></div>
            <div><dt className="text-ink-500">Location</dt><dd className="text-ink-100">{device.latitude != null ? `${device.latitude.toFixed(5)}, ${device.longitude.toFixed(5)}` : 'Location unavailable'}</dd></div>
            <div><dt className="text-ink-500">Location updated</dt><dd className="text-ink-100">{formatDateTime(device.location_updated_at)}</dd></div>
            <div><dt className="text-ink-500">Registered</dt><dd className="text-ink-100">{formatDateTime(device.created_at)}</dd></div>
          </dl>

          {canIssueCommands(user?.role) && (
            <div className="mt-5 border-t border-base-700 pt-4">
              <h3 className="mb-3 text-sm font-semibold text-ink-100">Remote control</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setConfirming('start_recording')}
                  className="rounded-lg bg-signal-red/15 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-signal-red/25"
                >
                  Start recording
                </button>
                <button
                  onClick={() => setConfirming('stop_recording')}
                  className="rounded-lg bg-base-600/60 px-3 py-1.5 text-sm text-ink-100 hover:bg-base-600"
                >
                  Stop recording
                </button>
              </div>
              <p className="mt-2 text-xs text-ink-500">
                A command being SENT does not mean it executed -- the device must acknowledge and report a result.
              </p>
            </div>
          )}
        </section>

        <section className="panel p-4">
          <h2 className="mb-3 font-semibold text-ink-100">Active alerts</h2>
          {deviceAlerts.filter((a) => a.status === 'open').length === 0 ? (
            <EmptyState title="No active alerts" />
          ) : (
            <ul className="space-y-2">
              {deviceAlerts.filter((a) => a.status === 'open').map((a) => (
                <li key={a.id} className="rounded-lg border border-base-700 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ink-100">{titleCase(a.type)}</span>
                    <StatusBadge status={a.severity} />
                  </div>
                  <p className="mt-1 text-xs text-ink-500">{formatDateTime(a.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel p-4">
        <h2 className="mb-3 font-semibold text-ink-100">Command history</h2>
        {commands.length === 0 ? (
          <EmptyState title="No commands issued to this device" />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-500">
                  <th className="pb-2">Command</th>
                  <th className="pb-2">Progress</th>
                  <th className="pb-2">Sent</th>
                  <th className="pb-2">Acknowledged</th>
                  <th className="pb-2">Executed</th>
                  <th className="pb-2">Failure</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {commands.map((c) => (
                  <tr key={c.id} className="border-t border-base-700">
                    <td className="py-2 text-ink-100">{titleCase(c.command_type)}</td>
                    <td className="py-2"><CommandProgress status={c.status} /></td>
                    <td className="py-2 text-ink-500">{formatDateTime(c.sent_at)}</td>
                    <td className="py-2 text-ink-500">{formatDateTime(c.acknowledged_at)}</td>
                    <td className="py-2 text-ink-500">{formatDateTime(c.executed_at)}</td>
                    <td className="py-2 text-red-300">{c.failure_reason || '—'}</td>
                    <td className="py-2">
                      {canIssueCommands(user?.role) && ['pending', 'sent'].includes(c.status) && (
                        <button onClick={() => handleCancel(c.id)} className="rounded-md bg-signal-red/15 px-2 py-1 text-xs text-red-300 hover:bg-signal-red/25">
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel p-4">
        <h2 className="mb-3 font-semibold text-ink-100">Recordings for this device</h2>
        {deviceRecordings.length === 0 ? (
          <EmptyState title="No recordings for this device" />
        ) : (
          <ul className="space-y-2">
            {deviceRecordings.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-lg border border-base-700 p-3 text-sm">
                <Link to={`/recordings/${r.id}`} className="text-sky-300 hover:underline">
                  {formatDateTime(r.started_at)} · {titleCase(r.trigger_type)}
                </Link>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={!!confirming}
        title={
          {
            start_recording: 'Start emergency recording?',
            stop_recording: 'Stop recording?',
            start_live_stream: 'Request live camera stream?',
            stop_live_stream: 'Stop live stream?',
          }[confirming]
        }
        message={
          {
            start_recording: `Send a START_RECORDING command to ${constableLabel(device.constable_id)}'s device? This will be sent immediately and the device must acknowledge it.`,
            stop_recording: `Send a STOP_RECORDING command to ${constableLabel(device.constable_id)}'s device?`,
            start_live_stream: `Send a START_LIVE_STREAM command to ${constableLabel(device.constable_id)}'s device? Their camera will turn on and be visible live -- nothing is recorded.`,
            stop_live_stream: `Stop the live camera stream from ${constableLabel(device.constable_id)}'s device?`,
          }[confirming]
        }
        confirmLabel={confirming === 'stop_live_stream' ? 'Stop stream' : 'Send command'}
        tone="danger"
        busy={busy}
        onCancel={() => setConfirming(null)}
        onConfirm={() => (confirming === 'stop_live_stream' ? handleStopLive(liveSession.id) : handleIssueCommand(confirming))}
      />
    </div>
  )
}
