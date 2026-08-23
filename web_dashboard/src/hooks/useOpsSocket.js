import { useEffect, useRef, useCallback, useState } from 'react'
import { API_BASE_URL, getToken } from '../api/client'

function wsBaseUrl() {
  const explicit = import.meta.env.VITE_WS_URL
  if (explicit) return explicit
  return API_BASE_URL.replace(/^http/, 'ws')
}

/**
 * Connects to the backend's single authenticated WebSocket gateway
 * (GET /ws/control_room -- the path name is historical; the backend
 * auto-assigns the caller to their own room server-side based on role/
 * station/constable identity derived from the JWT, never from anything
 * the client requests). Reconnects with backoff on drop, and calls
 * `onEvent({event, timestamp, data})` for every server message except the
 * internal `ack` keep-alive replies.
 */
export function useOpsSocket(onEvent, { enabled = true } = {}) {
  const [connected, setConnected] = useState(false)
  const socketRef = useRef(null)
  const retryRef = useRef(0)
  const closedByUsRef = useRef(false)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  const connect = useCallback(() => {
    const token = getToken()
    if (!token || !enabled) return

    const socket = new WebSocket(`${wsBaseUrl()}/ws/control_room?token=${encodeURIComponent(token)}`)
    socketRef.current = socket

    socket.onopen = () => {
      retryRef.current = 0
      setConnected(true)
    }

    socket.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data)
        if (parsed.event === 'ack') return
        onEventRef.current?.(parsed)
      } catch {
        // Ignore malformed frames rather than crashing the UI.
      }
    }

    socket.onclose = () => {
      setConnected(false)
      if (closedByUsRef.current) return
      const delay = Math.min(1000 * 2 ** retryRef.current, 15000)
      retryRef.current += 1
      setTimeout(connect, delay)
    }

    socket.onerror = () => {
      socket.close()
    }
  }, [enabled])

  useEffect(() => {
    closedByUsRef.current = false
    if (enabled) connect()
    return () => {
      closedByUsRef.current = true
      socketRef.current?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return { connected }
}
