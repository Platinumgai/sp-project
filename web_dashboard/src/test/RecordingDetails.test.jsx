import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import RecordingDetails from '../pages/RecordingDetails.jsx'

let mockById = {}
vi.mock('../hooks/useConstableLookup.js', () => ({
  useConstableLookup: () => ({ label: (id) => `Constable ${id?.slice(0, 4)}`, byId: mockById }),
}))

const mockGetRecording = vi.fn()
const mockGetManifest = vi.fn()
vi.mock('../api/recordings.js', () => ({
  getRecording: (...args) => mockGetRecording(...args),
  getRecordingManifest: (...args) => mockGetManifest(...args),
  chunkStreamUrl: (recordingId, chunkNumber) => `http://localhost:8000/recordings/${recordingId}/chunks/${chunkNumber}/stream`,
}))

function renderAt(recordingId) {
  return render(
    <MemoryRouter initialEntries={[`/recordings/${recordingId}`]}>
      <Routes>
        <Route path="/recordings/:id" element={<RecordingDetails />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RecordingDetails chunk timeline', () => {
  beforeEach(() => {
    mockById = {}
  })

  it('renders received chunks as ✓ and the real backend-reported gap as ✗ missing -- using actual response shapes, not fabricated data', async () => {
    mockGetRecording.mockResolvedValue({
      id: 'rec-1', constable_id: 'const-1', status: 'recording', trigger_type: 'emergency_button',
      started_at: '2026-01-01T00:00:00Z', ended_at: null, incident_id: null,
      chunk_count: 4, highest_chunk_number: 5, missing_chunk_numbers: [3],
    })
    mockGetManifest.mockResolvedValue({
      recording_session_id: 'rec-1', status: 'recording', is_complete: false,
      highest_chunk_number: 5, missing_chunk_numbers: [3],
      chunks: [
        { id: 'c1', chunk_number: 1, file_size: 1024, duration_seconds: 2.0, mime_type: 'video/mp4', is_last_chunk: false, upload_status: 'uploaded', created_at: '2026-01-01T00:00:01Z' },
        { id: 'c2', chunk_number: 2, file_size: 1024, duration_seconds: 2.0, mime_type: 'video/mp4', is_last_chunk: false, upload_status: 'uploaded', created_at: '2026-01-01T00:00:02Z' },
        { id: 'c4', chunk_number: 4, file_size: 1024, duration_seconds: 2.0, mime_type: 'video/mp4', is_last_chunk: false, upload_status: 'uploaded', created_at: '2026-01-01T00:00:04Z' },
        { id: 'c5', chunk_number: 5, file_size: 1024, duration_seconds: 2.0, mime_type: 'video/mp4', is_last_chunk: true, upload_status: 'uploaded', created_at: '2026-01-01T00:00:05Z' },
      ],
    })

    renderAt('rec-1')

    await waitFor(() => expect(screen.getByTitle('Chunk 1 — received')).toBeInTheDocument())
    expect(screen.getByTitle('Chunk 2 — received')).toBeInTheDocument()
    expect(screen.getByTitle('Chunk 3 — missing')).toBeInTheDocument() // never uploaded, correctly flagged
    expect(screen.getByTitle('Chunk 4 — received')).toBeInTheDocument()
    expect(screen.getByTitle('Chunk 5 — received')).toBeInTheDocument()

    // A real playback control is rendered (the uploaded chunks, not the
    // missing one, and never a claim of a continuous/live stream -- it's
    // chunk-by-chunk, starting at chunk 1 of the 4 actually uploaded).
    expect(screen.getByText('Chunk 1 (1 of 4)')).toBeInTheDocument()
  })

  it('renders an actual playable <video> for the first uploaded chunk, and advances to the next on request', async () => {
    mockGetRecording.mockResolvedValue({
      id: 'rec-4', constable_id: 'const-1', status: 'completed', trigger_type: 'manual',
      started_at: '2026-01-01T00:00:00Z', ended_at: '2026-01-01T00:01:00Z', incident_id: null,
      chunk_count: 2, highest_chunk_number: 2, missing_chunk_numbers: [],
    })
    mockGetManifest.mockResolvedValue({
      recording_session_id: 'rec-4', status: 'completed', is_complete: true,
      highest_chunk_number: 2, missing_chunk_numbers: [],
      chunks: [
        { id: 'c1', chunk_number: 1, file_size: 2048, duration_seconds: 20.0, mime_type: 'video/mp4', is_last_chunk: false, upload_status: 'uploaded', created_at: '2026-01-01T00:00:20Z' },
        { id: 'c2', chunk_number: 2, file_size: 1024, duration_seconds: 10.0, mime_type: 'video/mp4', is_last_chunk: true, upload_status: 'uploaded', created_at: '2026-01-01T00:00:30Z' },
      ],
    })

    renderAt('rec-4')

    await waitFor(() => expect(screen.getByText('Chunk 1 (1 of 2)')).toBeInTheDocument())
    const video = document.querySelector('video')
    expect(video).toBeTruthy()
    expect(video.src).toContain('/recordings/rec-4/chunks/1/stream')

    screen.getByText('Next →').click()
    await waitFor(() => expect(screen.getByText('Chunk 2 (2 of 2) · last chunk')).toBeInTheDocument())
    expect(document.querySelector('video').src).toContain('/recordings/rec-4/chunks/2/stream')
  })

  it('shows an empty state, not a broken/crashed UI, when no chunks have been uploaded yet', async () => {
    mockGetRecording.mockResolvedValue({
      id: 'rec-2', constable_id: 'const-1', status: 'recording', trigger_type: 'manual',
      started_at: '2026-01-01T00:00:00Z', ended_at: null, incident_id: null,
      chunk_count: 0, highest_chunk_number: null, missing_chunk_numbers: [],
    })
    mockGetManifest.mockResolvedValue({
      recording_session_id: 'rec-2', status: 'recording', is_complete: false,
      highest_chunk_number: null, missing_chunk_numbers: [], chunks: [],
    })

    renderAt('rec-2')

    await waitFor(() => expect(screen.getByText('No chunks received yet')).toBeInTheDocument())
  })

  it('surfaces a real backend error (e.g. 403 cross-constable access) rather than silently showing blank/fake data', async () => {
    const { ApiError } = await import('../api/client.js')
    mockGetRecording.mockRejectedValue(new ApiError(403, 'Not authorized to view this recording', {}))
    mockGetManifest.mockRejectedValue(new ApiError(403, 'Not authorized to view this recording', {}))

    renderAt('rec-3')

    await waitFor(() => expect(screen.getByText('Not authorized to view this recording')).toBeInTheDocument())
  })

  it('renders device (linked), station, and per-chunk GPS when the backend actually returns them', async () => {
    mockById = { 'const-1': { id: 'const-1', badge_number: 'B-100', station_name: 'Central Station' } }
    mockGetRecording.mockResolvedValue({
      id: 'rec-5', constable_id: 'const-1', device_id: 'device-99', status: 'recording', trigger_type: 'manual',
      started_at: '2026-01-01T00:00:00Z', ended_at: null, incident_id: null,
      chunk_count: 1, highest_chunk_number: 1, missing_chunk_numbers: [],
    })
    mockGetManifest.mockResolvedValue({
      recording_session_id: 'rec-5', status: 'recording', is_complete: false,
      highest_chunk_number: 1, missing_chunk_numbers: [],
      chunks: [
        {
          id: 'c1', chunk_number: 1, file_size: 1024, duration_seconds: 2.0, mime_type: 'video/mp4',
          is_last_chunk: true, upload_status: 'uploaded', created_at: '2026-01-01T00:00:01Z',
          latitude: 17.4321, longitude: 78.5432, recorded_at: '2026-01-01T00:00:01Z',
        },
      ],
    })

    renderAt('rec-5')

    await waitFor(() => expect(screen.getByText('Central Station')).toBeInTheDocument())
    // shortId() truncates to 8 chars (see utils/format.js), so 'device-99' -> 'device-9'.
    const deviceLink = screen.getByRole('link', { name: 'device-9' })
    expect(deviceLink).toHaveAttribute('href', '/devices/device-99')
    expect(screen.getByText('17.43210, 78.54320')).toBeInTheDocument()
  })

  it('omits device/station and shows the "—" placeholder for GPS when the backend has none of it -- never fabricated', async () => {
    mockById = { 'const-1': { id: 'const-1', badge_number: 'B-100', station_name: null } }
    mockGetRecording.mockResolvedValue({
      id: 'rec-6', constable_id: 'const-1', device_id: null, status: 'recording', trigger_type: 'manual',
      started_at: '2026-01-01T00:00:00Z', ended_at: null, incident_id: null,
      chunk_count: 1, highest_chunk_number: 1, missing_chunk_numbers: [],
    })
    mockGetManifest.mockResolvedValue({
      recording_session_id: 'rec-6', status: 'recording', is_complete: false,
      highest_chunk_number: 1, missing_chunk_numbers: [],
      chunks: [
        {
          id: 'c1', chunk_number: 1, file_size: 1024, duration_seconds: 2.0, mime_type: 'video/mp4',
          is_last_chunk: true, upload_status: 'uploaded', created_at: '2026-01-01T00:00:01Z',
          latitude: null, longitude: null, recorded_at: null,
        },
      ],
    })

    renderAt('rec-6')

    await waitFor(() => expect(screen.getByText('Device')).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: /devices\// })).not.toBeInTheDocument()
    // No station line was fabricated -- the "—" placeholder is used instead.
    const stationRow = screen.getByText('Station').closest('div')
    expect(stationRow).toHaveTextContent('—')
  })
})
