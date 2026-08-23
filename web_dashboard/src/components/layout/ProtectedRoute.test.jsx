import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute.jsx'

const mockUseAuth = vi.fn()
vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => mockUseAuth(),
}))

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <div>Secret Dashboard Content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  it('shows a loading state while the auth check is in progress, revealing nothing', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, loading: true })
    renderAt('/')
    expect(screen.getByText(/checking session/i)).toBeInTheDocument()
    expect(screen.queryByText('Secret Dashboard Content')).not.toBeInTheDocument()
  })

  it('redirects to /login when unauthenticated -- protected content is never rendered', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, loading: false })
    renderAt('/')
    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Secret Dashboard Content')).not.toBeInTheDocument()
  })

  it('renders the protected content when authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, loading: false })
    renderAt('/')
    expect(screen.getByText('Secret Dashboard Content')).toBeInTheDocument()
  })
})
