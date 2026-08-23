import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Login from '../pages/Login.jsx'

const mockLogin = vi.fn()
vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ login: mockLogin }),
}))

describe('Login page', () => {
  beforeEach(() => {
    mockLogin.mockReset()
  })

  function renderLogin() {
    return render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<div>Dashboard landed here</div>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('calls the real login function with the entered credentials and navigates away on success', async () => {
    mockLogin.mockResolvedValue({ id: '1', role: 'admin' })
    renderLogin()

    fireEvent.change(screen.getByPlaceholderText('9990001001'), { target: { value: '9990001001' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'Demo@12345' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('9990001001', 'Demo@12345'))
    await waitFor(() => expect(screen.getByText('Dashboard landed here')).toBeInTheDocument())
  })

  it('displays the actual backend error message on failed login, not a generic fallback', async () => {
    const { ApiError } = await import('../api/client.js')
    mockLogin.mockRejectedValue(new ApiError(401, 'Incorrect username or password', {}))
    renderLogin()

    fireEvent.change(screen.getByPlaceholderText('9990001001'), { target: { value: 'wrong-user' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrong-pass' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(screen.getByText('Incorrect username or password')).toBeInTheDocument())
    // Must NOT have navigated away on failure.
    expect(screen.queryByText('Dashboard landed here')).not.toBeInTheDocument()
  })

  it('shows the rate-limit message from the backend (429) rather than a generic error', async () => {
    const { ApiError } = await import('../api/client.js')
    mockLogin.mockRejectedValue(new ApiError(429, 'Too many failed login attempts. Please try again later.', {}))
    renderLogin()

    fireEvent.change(screen.getByPlaceholderText('9990001001'), { target: { value: '9990001001' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(screen.getByText(/too many failed login attempts/i)).toBeInTheDocument())
  })
})
