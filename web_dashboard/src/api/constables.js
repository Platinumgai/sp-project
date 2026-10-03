import { client } from './client'

// ---- Admin/control_room/station roster & management ----
export async function listConstables() {
  const { data } = await client.get('/constables/')
  return data
}

export async function listConstableLocations() {
  const { data } = await client.get('/constables/locations')
  return data
}

export async function createConstable({ phone, badge_number }) {
  const { data } = await client.post('/constables/', { phone, badge_number })
  return data
}

export async function deleteConstable(constableId) {
  const { data } = await client.delete(`/constables/${constableId}`)
  return data
}

export async function assignTask(constableId, incidentId) {
  const { data } = await client.post(`/constables/${constableId}/tasks`, { incident_id: incidentId })
  return data
}

export async function unassignTask(constableId, incidentId) {
  const { data } = await client.delete(`/constables/${constableId}/tasks/${incidentId}`)
  return data
}

// ---- Constable self-service ("me") ----
export async function fetchMyConstableProfile() {
  const { data } = await client.get('/constables/me')
  return data
}

export async function fetchMyIncidents() {
  const { data } = await client.get('/constables/me/incidents')
  return data
}

export async function fetchMyAssignments() {
  const { data } = await client.get('/constables/me/assignments')
  return data
}

export async function acceptAssignment(incidentId) {
  const { data } = await client.post(`/constables/me/incidents/${incidentId}/accept`)
  return data
}

export async function rejectAssignment(incidentId, reason) {
  const { data } = await client.post(`/constables/me/incidents/${incidentId}/reject`, { reason: reason || null })
  return data
}

export async function updateMyAssignmentStatus(incidentId, status) {
  const { data } = await client.put(`/constables/me/incidents/${incidentId}/status`, { status })
  return data
}

export async function updateMyLocation({ latitude, longitude, accuracy }) {
  const { data } = await client.post('/constables/me/location', { latitude, longitude, accuracy })
  return data
}
