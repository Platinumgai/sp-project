import axios from 'axios'

// The backend is the sole source of truth for every authorization decision.
// This client only ever attaches the token and normalizes error shapes --
// it never decides what a user is or isn't allowed to do.
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const client = axios.create({
  baseURL: API_BASE_URL,
})

const TOKEN_KEY = 'sentry_ops_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

client.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Listeners fired when the backend tells us the session is no longer valid
// (401) so the app can react (e.g. clear state and redirect to login)
// without every call site duplicating that logic.
let onUnauthorized = null
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

export class ApiError extends Error {
  constructor(status, detail, raw) {
    super(typeof detail === 'string' ? detail : 'Request failed')
    this.status = status
    this.detail = detail
    this.raw = raw
  }
}

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const detail = error.response?.data?.detail
    if (status === 401 && onUnauthorized) {
      onUnauthorized()
    }
    return Promise.reject(new ApiError(status, detail, error))
  }
)

/**
 * Human-readable fallback message per status code, used only when the
 * backend didn't supply its own `detail` string. Never fabricates backend
 * behavior -- just gives the user something sensible to read.
 */
export function friendlyErrorMessage(err) {
  if (err instanceof ApiError) {
    if (typeof err.detail === 'string' && err.detail) return err.detail
    if (Array.isArray(err.detail)) {
      // FastAPI 422 validation errors: [{loc, msg, type}, ...]
      return err.detail.map((d) => d.msg).join('; ')
    }
    switch (err.status) {
      case 401:
        return 'Your session has expired. Please sign in again.'
      case 403:
        return 'You are not authorized to perform this action.'
      case 404:
        return 'The requested resource was not found.'
      case 409:
        return 'This action conflicts with the current state of the resource.'
      case 413:
        return 'The file is too large to upload.'
      case 416:
        return 'The requested range is not satisfiable.'
      case 422:
        return 'Some of the submitted data was invalid.'
      case 429:
        return 'Too many attempts. Please wait before trying again.'
      case 500:
        return 'The server encountered an unexpected error. Please try again later.'
      default:
        return 'Something went wrong. Please try again.'
    }
  }
  return 'Something went wrong. Please try again.'
}
