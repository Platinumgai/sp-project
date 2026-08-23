import { client } from './client'

export async function listIncidents() {
  const { data } = await client.get('/incidents/')
  return data
}

export async function createIncident({ location_lon, location_lat, description }) {
  const { data } = await client.post('/incidents/', { location_lon, location_lat, description })
  return data
}

export async function updateIncidentStatus(incidentId, status) {
  const { data } = await client.put(`/incidents/${incidentId}/status`, null, { params: { status } })
  return data
}

export async function verifyIncident(incidentId) {
  const { data } = await client.post(`/incidents/${incidentId}/verify`)
  return data
}

export async function rejectIncident(incidentId, reason) {
  const { data } = await client.post(`/incidents/${incidentId}/reject`, { reason: reason || null })
  return data
}

export async function flagIncidentNeedsReview(incidentId, reason) {
  const { data } = await client.post(`/incidents/${incidentId}/needs-review`, { reason: reason || null })
  return data
}

export async function dispatchIncident(incidentId) {
  const { data } = await client.post(`/incidents/${incidentId}/dispatch`)
  return data
}

export async function getResponsibleStations(incidentId) {
  const { data } = await client.get(`/incidents/${incidentId}/responsible-stations`)
  return data
}
