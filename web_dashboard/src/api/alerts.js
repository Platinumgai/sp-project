import { client } from './client'

// GET /alerts/ -- read-only, filters/pagination confirmed against live OpenAPI schema.
export async function listAlerts({ status, severity, type, device_id, limit = 50, offset = 0 } = {}) {
  const { data } = await client.get('/alerts/', {
    params: { status, severity, type, device_id, limit, offset },
  })
  return data
}
