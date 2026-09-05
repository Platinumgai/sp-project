import { useEffect, useRef, useState } from 'react'
import { Room, RoomEvent, Track } from 'livekit-client'
import { getViewerToken } from '../api/liveStream'
import { friendlyErrorMessage } from '../api/client'

// Subscribe-only viewer for one live-stream session. Any number of these
// can be mounted concurrently (in this tab, in other admins' own browser
// tabs/sessions) against the SAME session_id -- each gets its own
// subscribe-only LiveKit token and its own Room connection; the LiveKit
// SFU handles fanning the same camera feed out to all of them. Nothing
// here ever writes the video anywhere -- it's attached directly to a
// <video> element and discarded on unmount/disconnect.
export default function LiveVideoView({ sessionId, onClose }) {
  const videoRef = useRef(null)
  const roomRef = useRef(null)
  const [status, setStatus] = useState('connecting') // connecting | live | error | ended
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const room = new Room()
    roomRef.current = room

    function attachIfVideo(track) {
      if (track.kind === Track.Kind.Video && videoRef.current) {
        track.attach(videoRef.current)
        setStatus('live')
      }
    }

    room.on(RoomEvent.TrackSubscribed, (track) => attachIfVideo(track))
    room.on(RoomEvent.Disconnected, () => {
      if (!cancelled) setStatus('ended')
    })

    async function connect() {
      try {
        const { livekit_url: url, token } = await getViewerToken(sessionId)
        if (cancelled) return
        await room.connect(url, token)
        // Pick up any track already publishing before we joined.
        for (const participant of room.remoteParticipants.values()) {
          for (const publication of participant.trackPublications.values()) {
            if (publication.track) attachIfVideo(publication.track)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setError(friendlyErrorMessage(err))
        }
      }
    }
    connect()

    return () => {
      cancelled = true
      room.disconnect()
    }
  }, [sessionId])

  return (
    <div className="overflow-hidden rounded-lg border border-base-700 bg-black">
      <div className="flex items-center justify-between bg-base-800 px-3 py-2 text-xs text-ink-300">
        <span>
          {status === 'connecting' && 'Connecting…'}
          {status === 'live' && <span className="text-red-400">● LIVE</span>}
          {status === 'ended' && 'Stream ended'}
          {status === 'error' && <span className="text-red-400">{error || 'Connection failed'}</span>}
        </span>
        {onClose && (
          <button onClick={onClose} className="rounded-md bg-base-600/60 px-2 py-1 text-ink-100 hover:bg-base-600">
            Close
          </button>
        )}
      </div>
      <video ref={videoRef} autoPlay playsInline muted={false} className="aspect-video w-full bg-black" />
    </div>
  )
}
