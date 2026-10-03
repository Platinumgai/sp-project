import { API_BASE_URL, client, getToken } from './client'

// GET /recordings/ -- read-only listing (Phase 4A). Filters/pagination
// confirmed against live OpenAPI schema.
export async function listRecordings({ device_id, status, limit = 50, offset = 0 } = {}) {
  const { data } = await client.get('/recordings/', {
    params: { device_id, status, limit, offset },
  })
  return data
}

export async function getRecording(recordingId) {
  const { data } = await client.get(`/recordings/${recordingId}`)
  return data
}

// Ordered chunk manifest -- NOT a live stream. See schemas.RecordingManifestResponse.
export async function getRecordingManifest(recordingId) {
  const { data } = await client.get(`/recordings/${recordingId}/chunks`)
  return data
}

// start/complete/cancel/upload-chunk are constable-only, self-service calls
// (the recording constable acting on their own session) -- not part of the
// Control Room's own action set, so intentionally not wrapped here.

// Direct URL (not routed through the `client` axios instance) because it's
// handed to a plain <video> element, which issues its own GET/Range
// requests the browser controls -- axios's interceptors never run for
// those. A browser <video> element also never attaches a custom
// Authorization header on its own, so the token travels as a query
// parameter instead; the backend's stream_chunk endpoint accepts either
// (see recordings.py::_authenticate_stream_request).
export function chunkStreamUrl(recordingId, chunkNumber) {
  const token = getToken()
  const qs = token ? `?token=${encodeURIComponent(token)}` : ''
  return `${API_BASE_URL}/recordings/${recordingId}/chunks/${chunkNumber}/stream${qs}`
}
