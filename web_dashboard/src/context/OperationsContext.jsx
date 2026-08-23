import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { useToast } from './ToastContext.jsx'
import { useOpsSocket } from '../hooks/useOpsSocket.js'
import { listDevices } from '../api/devices.js'
import { listAlerts } from '../api/alerts.js'
import { listRecordings } from '../api/recordings.js'
import { listAllCommands } from '../api/commands.js'
import { titleCase } from '../utils/format.js'

const OperationsContext = createContext(null)

// Event names that represent something genuinely worth interrupting the
// operator with a toast for -- everything else just updates state quietly.
// This list is exactly the set of events the backend actually publishes
// for alert-worthy conditions (see app/services/events.py) -- nothing
// invented.
const NOTIFY_EVENTS = new Set([
  'battery.critical',
  'device.offline',
  'recording.device_offline',
  'command.failed',
  'alert.created',
])

// Events that mean "a device's live status/battery/location may have
// changed" -- payload shape confirmed against _device_summary /
// publish_battery_updated in app/services/events.py.
const DEVICE_TOUCHING_EVENTS = new Set([
  'device.registered',
  'device.heartbeat',
  'device.online',
  'device.stale',
  'device.offline',
  'battery.updated',
  'battery.warning',
  'battery.critical',
])

const RECORDING_TOUCHING_EVENTS = new Set([
  'recording.started',
  'recording.chunk_uploaded',
  'recording.completed',
  'recording.cancelled',
  'recording.failed',
  'recording.device_offline',
])

const COMMAND_TOUCHING_EVENTS = new Set([
  'command.sent',
  'command.acknowledged',
  'command.executed',
  'command.failed',
  'command.cancelled',
])

const ALERT_TOUCHING_EVENTS = new Set([
  'alert.created',
  'alert.updated',
  'alert.resolved',
  'battery.warning',
  'battery.critical',
  'device.stale',
  'device.offline',
  'recording.device_offline',
])

export function OperationsProvider({ children }) {
  const { user } = useAuth()
  const { notify } = useToast()

  const [devices, setDevices] = useState([])
  const [alerts, setAlerts] = useState([])
  const [recordings, setRecordings] = useState([])
  const [commands, setCommands] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastEvent, setLastEvent] = useState(null)

  // Coalesce bursts of related events (e.g. many chunk_uploaded messages
  // during an active recording) into a single refetch rather than one
  // network call per WebSocket message.
  const pendingRefetch = useRef({ devices: false, alerts: false, recordings: false, commands: false })
  const refetchTimer = useRef(null)

  const canSeeOperations = ['admin', 'control_room', 'station', 'constable'].includes(user?.role)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [d, a, r, c] = await Promise.all([
        listDevices(),
        listAlerts({ limit: 100 }),
        listRecordings({ limit: 100 }),
        listAllCommands({ limit: 100 }),
      ])
      setDevices(d)
      setAlerts(a)
      setRecordings(r)
      setCommands(c)
    } catch (err) {
      setError(err?.message || 'Failed to load operational data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canSeeOperations) loadAll()
    else setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSeeOperations])

  const scheduleRefetch = useCallback((slice) => {
    pendingRefetch.current[slice] = true
    if (refetchTimer.current) return
    refetchTimer.current = setTimeout(async () => {
      const pending = pendingRefetch.current
      pendingRefetch.current = { devices: false, alerts: false, recordings: false, commands: false }
      refetchTimer.current = null
      try {
        if (pending.devices) setDevices(await listDevices())
        if (pending.alerts) setAlerts(await listAlerts({ limit: 100 }))
        if (pending.recordings) setRecordings(await listRecordings({ limit: 100 }))
        if (pending.commands) setCommands(await listAllCommands({ limit: 100 }))
      } catch {
        // A transient refetch failure just means the UI stays at its last
        // known-good state until the next event triggers another attempt.
      }
    }, 600)
  }, [])

  const handleEvent = useCallback(
    (evt) => {
      setLastEvent(evt)
      if (DEVICE_TOUCHING_EVENTS.has(evt.event)) scheduleRefetch('devices')
      if (RECORDING_TOUCHING_EVENTS.has(evt.event)) scheduleRefetch('recordings')
      if (COMMAND_TOUCHING_EVENTS.has(evt.event)) scheduleRefetch('commands')
      if (ALERT_TOUCHING_EVENTS.has(evt.event)) scheduleRefetch('alerts')

      if (NOTIFY_EVENTS.has(evt.event)) {
        const label = titleCase(evt.event)
        const detail = evt.data?.message || evt.data?.device_identifier || evt.data?.command_type || ''
        notify(detail ? `${label}: ${detail}` : label, {
          tone: evt.event.includes('critical') || evt.event === 'device.offline' || evt.event === 'recording.device_offline' ? 'error' : 'info',
          duration: 6000,
        })
      }
    },
    [notify, scheduleRefetch],
  )

  const { connected } = useOpsSocket(handleEvent, { enabled: canSeeOperations })

  const counts = useMemo(() => {
    const online = devices.filter((d) => d.status === 'online' || d.status === 'recording').length
    const stale = devices.filter((d) => d.status === 'stale').length
    const offline = devices.filter((d) => d.status === 'offline').length
    const recordingNow = devices.filter((d) => d.status === 'recording').length
    const activeRecordings = recordings.filter((r) => r.status === 'recording').length
    const openAlerts = alerts.filter((a) => a.status === 'open').length
    const criticalAlerts = alerts.filter((a) => a.status === 'open' && a.severity === 'critical').length
    const pendingCommands = commands.filter((c) => ['pending', 'sent', 'acknowledged'].includes(c.status)).length
    return { online, stale, offline, recordingNow, activeRecordings, openAlerts, criticalAlerts, pendingCommands, totalDevices: devices.length }
  }, [devices, alerts, recordings, commands])

  const value = {
    devices,
    alerts,
    recordings,
    commands,
    counts,
    loading,
    error,
    connected,
    lastEvent,
    refresh: loadAll,
  }

  return <OperationsContext.Provider value={value}>{children}</OperationsContext.Provider>
}

export function useOperations() {
  const ctx = useContext(OperationsContext)
  if (!ctx) throw new Error('useOperations must be used within OperationsProvider')
  return ctx
}
