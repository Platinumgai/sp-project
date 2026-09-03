import { client } from './client'

// GET /live-stream/active -- role-scoped, same matrix as commands.js
// (admin/control_room: all; station: own station; constable: own device).
export async function listActiveLiveStreams() {
  const { data } = await client.get('/live-stream/active')
  return data
}

// POST /live-stream/{session_id}/stop -- admin/control_room/station-own
// force-stop, or the device's own constable.
export async function stopLiveStream(sessionId) {
  const { data } = await client.post(`/live-stream/${sessionId}/stop`)
  return data
}

// POST /live-stream/{session_id}/viewer-token -- mints a subscribe-only
// LiveKit token (never can_publish) for the calling admin. Any number of
// authorized viewers may call this concurrently for the same session --
// the LiveKit SFU fans the stream out to all of them.
export async function getViewerToken(sessionId) {
  const { data } = await client.post(`/live-stream/${sessionId}/viewer-token`)
  return data
}
