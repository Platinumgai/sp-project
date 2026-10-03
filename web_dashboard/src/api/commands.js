import { client } from './client'

// GET /commands/ -- global read-only listing (Phase 4A).
export async function listAllCommands({ device_id, status, command_type, limit = 50, offset = 0 } = {}) {
  const { data } = await client.get('/commands/', {
    params: { device_id, status, command_type, limit, offset },
  })
  return data
}

// GET /devices/{id}/commands -- per-device listing (Phase 3), used on the
// device/constable details drill-down pages.
export async function listDeviceCommands(deviceId) {
  const { data } = await client.get(`/devices/${deviceId}/commands`)
  return data
}

// POST /devices/{id}/commands -- issue a command. Server creates it and
// immediately marks it SENT (see backend docs); ACK/EXECUTED only happen
// once the (future) mobile client actually reports back -- the frontend
// must never claim EXECUTED just because this call succeeded.
// `params` is the optional {camera: 'front'|'back'} payload required by
// request_live_stream/switch_live_camera/start_emergency_recording (see
// backend schemas.py::RemoteCommandParams) -- omitted entirely (not sent
// as null) for command types that don't take one.
export async function issueCommand(deviceId, commandType, params) {
  const { data } = await client.post(`/devices/${deviceId}/commands`, {
    command_type: commandType,
    ...(params ? { params } : {}),
  })
  return data
}

export async function cancelCommand(commandId) {
  const { data } = await client.post(`/commands/${commandId}/cancel`)
  return data
}

// ack/result are constable-only, self-service calls (the target device's
// own constable acting on their own incoming command) -- not part of the
// Control Room's own action set, so intentionally not wrapped here.
