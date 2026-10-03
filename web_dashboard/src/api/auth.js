import { client } from './client'

// Matches backend LoginRequest exactly: {username, password} where
// `username` is matched against User.phone server-side.
export async function login(username, password) {
  const { data } = await client.post('/auth/login', { username, password })
  return data // TokenResponse: {access_token, token_type, expires_in, user}
}

export async function fetchCurrentUser() {
  const { data } = await client.get('/auth/me')
  return data // UserPublic: {id, phone, role, is_active, station_id, created_at}
}
