import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import DeviceDetails from '../pages/DeviceDetails.jsx'

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'admin-1', role: 'admin', phone: '9990001001' } }),
}))
vi.mock('../context/ToastContext.jsx', () => ({
  useToast: () => ({ notify: vi.fn() }),
}))
vi.mock('../context/OperationsContext.jsx', () => ({
  useOperations: () => ({ recordings: [] }),
}))
vi.mock('../hooks/useConstableLookup.js', () => ({
  useConstableLookup: () => ({ label: (id) => `Constable ${id?.slice(0, 4)}` }),
}))

const mockGetDevice = vi.fn()
vi.mock('../api/devices.js', () => ({
  getDevice: (...args) => mockGetDevice(...args),
}))
const mockListAlerts = vi.fn()
vi.mock('../api/alerts.js', () => ({
  listAlerts: (...args) => mockListAlerts(...args),
}))
const mockListDeviceCommands = vi.fn()
const mockIssueCommand = vi.fn()
vi.mock('../api/commands.js', () => ({
  listDeviceCommands: (...args) => mockListDeviceCommands(...args),
  issueCommand: (...args) => mockIssueCommand(...args),
  cancelCommand: vi.fn(),
}))

const DEVICE = {
  id: 'device-1', constable_id: 'const-1', device_identifier: 'pixel-7', platform: 'android',
  device_model: 'Pixel 7', app_version: '1.0', status: 'online', battery_percent: 80, is_charging: false,
  last_heartbeat_at: null, last_seen_at: null, latitude: null, longitude: null, location_updated_at: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: null,
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/devices/device-1']}>
      <Routes>
        <Route path="/devices/:id" element={<DeviceDetails />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('DeviceDetails remote command confirmation + lifecycle rendering', () => {
  beforeEach(() => {
    mockGetDevice.mockReset().mockResolvedValue(DEVICE)
    mockListAlerts.mockReset().mockResolvedValue([])
    mockListDeviceCommands.mockReset().mockResolvedValue([])
    mockIssueCommand.mockReset()
  })

  it('requires explicit confirmation before sending a command -- clicking "Start recording" does NOT call the API immediately', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Remote control')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /start recording/i }))

    // The confirm dialog must appear...
    expect(screen.getByText(/start emergency recording\?/i)).toBeInTheDocument()
    // ...and the API must NOT have been called yet.
    expect(mockIssueCommand).not.toHaveBeenCalled()
  })

  it('only calls issueCommand after the user explicitly clicks "Send command" in the confirmation dialog', async () => {
    mockIssueCommand.mockResolvedValue({ id: 'cmd-1', status: 'sent' })
    renderPage()
    await waitFor(() => expect(screen.getByText('Remote control')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /start recording/i }))
    fireEvent.click(screen.getByRole('button', { name: /send command/i }))

    await waitFor(() => expect(mockIssueCommand).toHaveBeenCalledWith('device-1', 'start_recording'))
  })

  it('cancelling the confirmation dialog never issues the command', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Remote control')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /start recording/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(mockIssueCommand).not.toHaveBeenCalled()
    expect(screen.queryByText(/start emergency recording\?/i)).not.toBeInTheDocument()
  })

  it('never renders EXECUTED just because the create-command API call succeeded -- only what the backend actually reports as command status', async () => {
    // The real backend contract: POST /devices/{id}/commands always
    // returns status "sent" (see commands.py::create_command) -- EXECUTED
    // is only ever reported later, via the command history list, once the
    // device genuinely reports back. This test proves the UI's command
    // history table renders EXACTLY the status field from the API, never
    // inferring/upgrading it based on the issue call having succeeded.
    mockListDeviceCommands.mockResolvedValue([
      {
        id: 'cmd-1', device_id: 'device-1', issued_by: 'admin-1', command_type: 'start_recording',
        status: 'sent', created_at: '2026-01-01T00:00:00Z', sent_at: '2026-01-01T00:00:00Z',
        acknowledged_at: null, executed_at: null, failure_reason: null,
      },
    ])
    renderPage()

    await waitFor(() => expect(screen.getByText('Start Recording')).toBeInTheDocument())
    // The progress indicator must reflect "sent", never jump ahead to executed.
    expect(screen.getByText('sent')).toBeInTheDocument()
    expect(screen.queryByText('executed')).not.toBeInTheDocument()
  })

  it('renders a genuinely EXECUTED command correctly once the backend reports it', async () => {
    mockListDeviceCommands.mockResolvedValue([
      {
        id: 'cmd-2', device_id: 'device-1', issued_by: 'admin-1', command_type: 'start_recording',
        status: 'executed', created_at: '2026-01-01T00:00:00Z', sent_at: '2026-01-01T00:00:01Z',
        acknowledged_at: '2026-01-01T00:00:02Z', executed_at: '2026-01-01T00:00:03Z', failure_reason: null,
      },
    ])
    renderPage()
    await waitFor(() => expect(screen.getByText('executed')).toBeInTheDocument())
  })

  it('renders a FAILED command with its real failure reason from the backend, not a generic message', async () => {
    mockListDeviceCommands.mockResolvedValue([
      {
        id: 'cmd-3', device_id: 'device-1', issued_by: 'admin-1', command_type: 'start_recording',
        status: 'failed', created_at: '2026-01-01T00:00:00Z', sent_at: '2026-01-01T00:00:01Z',
        acknowledged_at: '2026-01-01T00:00:02Z', executed_at: '2026-01-01T00:00:03Z',
        failure_reason: 'Camera permission denied',
      },
    ])
    renderPage()
    await waitFor(() => expect(screen.getByText('Camera permission denied')).toBeInTheDocument())
  })
})
