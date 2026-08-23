import { client } from './client'

// Device registration/heartbeat/battery (POST /devices/register|heartbeat|battery)
// are mobile-app-only calls (constable role, self-service) -- the Control
// Room frontend never calls them, so they're intentionally not wrapped here.

export async function listDevices() {
  const { data } = await client.get('/devices/')
  return data
}

export async function getDevice(deviceId) {
  const { data } = await client.get(`/devices/${deviceId}`)
  return data
}
