import { client } from './client'

export async function fetchSettings() {
  const { data } = await client.get('/settings/')
  return data
}

export async function updateSettings(settings) {
  const { data } = await client.post('/settings/', settings)
  return data
}
