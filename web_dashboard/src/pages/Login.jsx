import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { friendlyErrorMessage } from '../api/client.js'
import { API_BASE_URL } from '../api/client.js'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await login(username, password)
      const redirectTo = location.state?.from?.pathname || '/'
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(friendlyErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-950 px-4">
      <div className="panel w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <div className="mb-2 text-3xl">🚨</div>
          <h1 className="text-lg font-semibold text-ink-100">Police Emergency Response</h1>
          <p className="mt-1 text-sm text-ink-500">Operations console sign in</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-ink-300">Phone / username</span>
            <input
              className="w-full rounded-lg border border-base-600 bg-base-700/60 px-3 py-2 text-ink-100 outline-none focus:border-signal-blue"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="9990001001"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-ink-300">Password</span>
            <input
              type="password"
              className="w-full rounded-lg border border-base-600 bg-base-700/60 px-3 py-2 text-ink-100 outline-none focus:border-signal-blue"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </label>

          {error && (
            <p className="rounded-lg border border-signal-red/40 bg-signal-red/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-signal-blue py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-ink-500">
          API: <span className="font-mono">{API_BASE_URL}</span>
        </p>
      </div>
    </div>
  )
}
