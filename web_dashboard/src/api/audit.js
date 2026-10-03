import { client } from './client'

export async function listAuditLogs({ incident_id, user_id, action, limit = 50, offset = 0 } = {}) {
  const { data } = await client.get('/audit-logs/', {
    params: { incident_id, user_id, action, limit, offset },
  })
  return data
}
