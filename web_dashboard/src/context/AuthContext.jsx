import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { login as apiLogin, fetchCurrentUser } from '../api/auth'
import { getToken, setToken, setUnauthorizedHandler } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const clearSession = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    // A 401 from ANY request means the backend no longer considers this
    // token valid (expired, revoked-by-deactivation, malformed, etc.) --
    // the frontend never second-guesses that, it just clears the session.
    setUnauthorizedHandler(() => clearSession())
  }, [clearSession])

  useEffect(() => {
    const existing = getToken()
    if (!existing) {
      setLoading(false)
      return
    }
    fetchCurrentUser()
      .then(setUser)
      .catch(() => clearSession())
      .finally(() => setLoading(false))
  }, [clearSession])

  const login = useCallback(async (username, password) => {
    const result = await apiLogin(username, password)
    setToken(result.access_token)
    setUser(result.user)
    return result.user
  }, [])

  const logout = useCallback(() => {
    // The backend is stateless JWT with no server-side session/logout
    // endpoint (confirmed in the API map) -- "logout" is purely a client-
    // side action: discard the token so it's no longer sent.
    clearSession()
  }, [clearSession])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
