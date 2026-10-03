import { client } from './client'

export async function listStations() {
  const { data } = await client.get('/police-stations/')
  return data
}

export async function getStation(stationId) {
  const { data } = await client.get(`/police-stations/${stationId}`)
  return data
}

export async function createStation({ name, contact, latitude, longitude }) {
  const { data } = await client.post('/police-stations/', { name, contact, latitude, longitude })
  return data
}

export async function updateStation(stationId, updates) {
  const { data } = await client.put(`/police-stations/${stationId}`, updates)
  return data
}

export async function deleteStation(stationId) {
  const { data } = await client.delete(`/police-stations/${stationId}`)
  return data
}

export async function findNearestStations(latitude, longitude) {
  const { data } = await client.get('/police-stations/nearest', { params: { latitude, longitude } })
  return data
}
