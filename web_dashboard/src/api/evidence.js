import { client, API_BASE_URL, getToken } from './client'

export async function listEvidence() {
  const { data } = await client.get('/media/')
  return data
}

export async function uploadEvidence({ incidentId, type, file, comment, onUploadProgress }) {
  const form = new FormData()
  form.append('incident_id', incidentId)
  form.append('type', type)
  if (comment) form.append('comment', comment)
  form.append('file', file)
  const { data } = await client.post('/media/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  })
  return data
}

export async function verifyEvidence(evidenceId) {
  const { data } = await client.post(`/media/${evidenceId}/verify`)
  return data
}

export async function rejectEvidence(evidenceId, reason) {
  const { data } = await client.post(`/media/${evidenceId}/reject`, { reason: reason || null })
  return data
}

export async function archiveEvidence(evidenceId) {
  const { data } = await client.post(`/media/${evidenceId}/archive`)
  return data
}

/**
 * Streaming/download URLs need the JWT attached, but <video>/<audio>/<img>
 * tags and plain anchor downloads can't run our axios interceptor. The
 * token is passed as a query parameter for these direct-media requests
 * only -- everything else in the app uses the Authorization header.
 */
export function evidenceStreamUrl(evidenceId) {
  const token = getToken()
  return `${API_BASE_URL}/media/${evidenceId}/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`
}

export async function downloadEvidence(evidenceId, filename) {
  const response = await client.get(`/media/${evidenceId}/download`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename || 'evidence')
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
