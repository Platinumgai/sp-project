import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useOperations } from '../context/OperationsContext.jsx'
import { useConstableLookup } from '../hooks/useConstableLookup.js'
import { getDevice } from '../api/devices.js'
import { listAlerts } from '../api/alerts.js'
import { listDeviceCommands, issueCommand, cancelCommand } from '../api/commands.js'
import { friendlyErrorMessage } from '../api/client.js'
import { LoadingSkeleton, ErrorState, EmptyState, ConfirmDialog } from '../components/Primitives.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import LiveVideoView from '../components/LiveVideoView.jsx'
import { canIssueCommands } from '../utils/roles.js'
import { formatDateTime, titleCase } from '../utils/format.js'

const COMMAND_STAGES = ['pending', 'sent', 'acknowledged', 'accepted', 'starting', 'executed']

// Simple two-way toggle used by all three camera pickers (live stream,
// emergency recording, normal recording) -- kept as one component so the
// three sections stay visually/behaviorally consistent.
function CameraPicker({ value, onChange, disabled }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-base-700">
      {['back', 'front'].map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option)}
          className={`px-3 py-1.5 text-sm capitalize ${
            value === option ? 'bg-signal-blue/25 text-sky-300' : 'text-ink-300 hover:bg-base-700'
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

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
  const [confirming, setConfirming] = useState(null) // 'start_recording' | 'stop_recording' | 'request_live_stream' | 'stop_live_stream' | 'start_emergency_recording' | 'stop_emergency_recording' | null
  const [busy, setBusy] = useState(false)
  const [watchingSessionId, setWatchingSessionId] = useState(null)
  const [liveCamera, setLiveCamera] = useState('back')
  const [emergencyCamera, setEmergencyCamera] = useState('back')
  const [recordingCamera, setRecordingCamera] = useState('back')

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

  async function handleIssueCommand(commandType, params) {
    setBusy(true)
    try {
      await issueCommand(id, commandType, params)
      notify(`Command sent: ${titleCase(commandType)}`, { tone: 'success' })
      setConfirming(null)
      await load()
    } catch (err) {
      notify(friendlyErrorMessage(err), { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function handleStopLive() {
    // Issues the SAME stop_live_stream remote command the constable's own
    // phone already handles correctly (see mobile home_screen.dart's
    // _handleRemoteCommand), rather than calling the live-stream session's
    // own /stop endpoint directly. That direct endpoint only marks the
    // session ended in the database and notifies OTHER admin/control_room
    // viewers -- it was never delivered to the publishing device itself
    // (send_to_control_room never reaches a constable-role connection), so
    // the phone's camera kept publishing indefinitely after a Control Room
    // "Stop live stream" click even though the dashboard showed it as
    // stopped. Routing through the command channel is what actually
    // reaches the phone.
    setBusy(true)
    try {
      await issueCommand(id, 'stop_live_stream')
      notify('Stop command sent to device', { tone: 'success' })
      setWatchingSessionId(null)
      setConfirming(null)
      await load()
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

  // `commands` is already ordered newest-first (GET /devices/{id}/commands
  // -- backend orders by created_at.desc()), so the first match is the
  // most recent start_live_stream command issued to this device.
  const latestLiveRequest = commands.find((c) => c.command_type === 'start_live_stream')

  // Maps the command's own status onto the UI state machine the operator
  // sees. `liveSession` (an actual, live LiveStreamSession row) is the
  // ONLY authoritative "is it really live" signal -- see
  // live_stream.py::start_live_stream, only ever created by the phone
  // itself after a genuine, successful LiveKit publish -- so it always
  // wins over whatever the command row currently says, including a stale
  // 'executed' from a stream that has since ended (liveSession would be
  // undefined again by then). There is deliberately no per-request
  // Accept/Reject state anymore -- Control Room is the sole remote
  // authority and the phone executes immediately on receipt (see
  // home_screen.dart's _handleRemoteCommand), so the only states left are
  // idle -> starting -> live, or failed.
  let liveState = 'idle'
  if (liveSession) {
    liveState = 'live'
  } else if (latestLiveRequest) {
    const s = latestLiveRequest.status
    if (s === 'pending' || s === 'sent' || s === 'acknowledged' || s === 'accepted' || s === 'starting') liveState = 'starting'
    else if (s === 'executed') {
      // 'executed' with no liveSession yet is normally the narrow race
      // between the phone's result report and its own live-stream/start
      // call's own commit -- treated as still-starting. But this same
      // 'executed' status is also what a request permanently keeps LONG
      // after a real stream started AND has since properly ended (stopped
      // via stop_live_stream -- see handleStopLive) -- there is no
      // separate "ended" status on the command itself, only on
      // liveStreams, so an old executed request must NOT be read as
      // "still starting" forever. Bounded to a real race window (a few
      // seconds), not an arbitrary guess -- the starting -> result round
      // trip is always fast (no user-confirmation step happens anymore
      // between them).
      const executedMsAgo = latestLiveRequest.executed_at ? Date.now() - new Date(latestLiveRequest.executed_at).getTime() : Infinity
      liveState = executedMsAgo < 15000 ? 'starting' : 'idle'
    } else if (s === 'failed' || s === 'timeout') liveState = 'failed'
  }

  const activeEmergencyRecording = deviceRecordings.find(
    (r) => r.status === 'recording' && (r.trigger_type === 'emergency_button' || r.trigger_type === 'control_room_emergency'),
  )

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
          <h2 className="font-semibold text-ink-100">Live stream</h2>
          {liveState === 'live' && <StatusBadge status="live" />}
          {liveState === 'starting' && <span className="text-xs font-medium uppercase text-amber-300">Connecting...</span>}
          {liveState === 'failed' && <span className="text-xs font-medium uppercase text-red-300">Live stream failed</span>}
        </div>

        {(liveState === 'idle' || liveState === 'failed') && (
          <>
            {liveState === 'idle' && <EmptyState title="Live offline" />}
            {liveState === 'failed' && <p className="text-sm text-red-300">{latestLiveRequest?.failure_reason || 'The live stream failed to start.'}</p>}
            {canIssueCommands(user?.role) && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div>
                  <p className="mb-1 text-xs uppercase text-ink-500">Live camera</p>
                  <CameraPicker value={liveCamera} onChange={setLiveCamera} />
                </div>
                <button
                  onClick={() => setConfirming('start_live_stream')}
                  className="rounded-lg bg-signal-red/15 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-signal-red/25"
                >
                  Get live
                </button>
              </div>
            )}
          </>
        )}

        {liveState === 'starting' && (
          <p className="text-sm text-ink-400">
            The phone is automatically opening the camera and connecting to the live camera server -- no action needed on the phone.
          </p>
        )}

        {liveState === 'live' && !watchingSessionId && (
          <div className="flex flex-wrap items-center gap-3">
            {liveSession.camera_lens_direction && (
              <span className="text-xs uppercase text-ink-500">Camera: {liveSession.camera_lens_direction}</span>
            )}
            <button
              onClick={() => setWatchingSessionId(liveSession.id)}
              className="rounded-lg bg-signal-blue/15 px-3 py-1.5 text-sm font-medium text-sky-300 hover:bg-signal-blue/25"
            >
              Watch live stream
            </button>
          </div>
        )}

        {liveState === 'live' && watchingSessionId === liveSession.id && (
          <div className="max-w-xl">
            <LiveVideoView sessionId={liveSession.id} onClose={() => setWatchingSessionId(null)} />
          </div>
        )}

        {liveState === 'live' && canIssueCommands(user?.role) && (
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
              <div className="mb-3">
                <p className="mb-1 text-xs uppercase text-ink-500">Recording camera</p>
                <CameraPicker value={recordingCamera} onChange={setRecordingCamera} />
              </div>
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

          {canIssueCommands(user?.role) && (
            <div className="mt-5 border-t border-base-700 pt-4">
              <h3 className="mb-3 text-sm font-semibold text-ink-100">Emergency recording</h3>
              {activeEmergencyRecording ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-red-300">
                    <span className="h-2 w-2 rounded-full bg-signal-red" /> EMERGENCY RECORDING
                  </span>
                  {activeEmergencyRecording.camera_lens_direction && (
                    <span className="text-xs uppercase text-ink-500">Camera: {activeEmergencyRecording.camera_lens_direction}</span>
                  )}
                  <button
                    onClick={() => setConfirming('stop_emergency_recording')}
                    className="rounded-lg bg-base-600/60 px-3 py-1.5 text-sm text-ink-100 hover:bg-base-600"
                  >
                    Stop emergency recording
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <CameraPicker value={emergencyCamera} onChange={setEmergencyCamera} />
                  <button
                    onClick={() => setConfirming('start_emergency_recording')}
                    className="rounded-lg bg-signal-red/15 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-signal-red/25"
                  >
                    Start emergency recording
                  </button>
                </div>
              )}
              <p className="mt-2 text-xs text-ink-500">
                The UI only shows EMERGENCY RECORDING once a recording session actually exists with that trigger -- never merely because the command was sent.
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
            start_recording: 'Start recording?',
            stop_recording: 'Stop recording?',
            start_live_stream: 'Get live camera stream?',
            stop_live_stream: 'Stop live stream?',
            start_emergency_recording: 'Start emergency recording?',
            stop_emergency_recording: 'Stop emergency recording?',
          }[confirming]
        }
        message={
          {
            start_recording: `Send a START_RECORDING command (camera: ${recordingCamera}) to ${constableLabel(device.constable_id)}'s device? This will be sent immediately and the device must acknowledge it.`,
            stop_recording: `Send a STOP_RECORDING command to ${constableLabel(device.constable_id)}'s device?`,
            start_live_stream: `Send a GET LIVE command (camera: ${liveCamera}) to ${constableLabel(device.constable_id)}'s device? The phone will automatically open the camera and start publishing -- no confirmation is required on the phone.`,
            stop_live_stream: `Stop the live camera stream from ${constableLabel(device.constable_id)}'s device?`,
            start_emergency_recording: `Send a START_EMERGENCY_RECORDING command (camera: ${emergencyCamera}) to ${constableLabel(device.constable_id)}'s device? This will be sent immediately and the device must acknowledge it.`,
            stop_emergency_recording: `Send a STOP_EMERGENCY_RECORDING command to ${constableLabel(device.constable_id)}'s device?`,
          }[confirming]
        }
        confirmLabel={confirming === 'stop_live_stream' ? 'Stop stream' : 'Send command'}
        tone="danger"
        busy={busy}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming === 'stop_live_stream') return handleStopLive()
          if (confirming === 'start_live_stream') return handleIssueCommand('start_live_stream', { camera: liveCamera })
          if (confirming === 'start_emergency_recording') return handleIssueCommand('start_emergency_recording', { camera: emergencyCamera })
          if (confirming === 'stop_emergency_recording') return handleIssueCommand('stop_emergency_recording')
          if (confirming === 'start_recording') return handleIssueCommand('start_recording', { camera: recordingCamera })
          return handleIssueCommand(confirming)
        }}
      />
    </div>
  )
}
