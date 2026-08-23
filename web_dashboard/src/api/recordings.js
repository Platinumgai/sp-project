import { client } from './client'

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
