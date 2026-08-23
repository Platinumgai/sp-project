import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import RecordingDetails from '../pages/RecordingDetails.jsx'

vi.mock('../hooks/useConstableLookup.js', () => ({
  useConstableLookup: () => ({ label: (id) => `Constable ${id?.slice(0, 4)}` }),
}))

const mockGetRecording = vi.fn()
const mockGetManifest = vi.fn()
vi.mock('../api/recordings.js', () => ({
  getRecording: (...args) => mockGetRecording(...args),
  getRecordingManifest: (...args) => mockGetManifest(...args),
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
        { id: 'c1', chunk_number: 1, file_size: 1024, duration_seconds: 2.0, mime_type: 'video/mp4', is_last_chunk: false, created_at: '2026-01-01T00:00:01Z' },
        { id: 'c2', chunk_number: 2, file_size: 1024, duration_seconds: 2.0, mime_type: 'video/mp4', is_last_chunk: false, created_at: '2026-01-01T00:00:02Z' },
        { id: 'c4', chunk_number: 4, file_size: 1024, duration_seconds: 2.0, mime_type: 'video/mp4', is_last_chunk: false, created_at: '2026-01-01T00:00:04Z' },
        { id: 'c5', chunk_number: 5, file_size: 1024, duration_seconds: 2.0, mime_type: 'video/mp4', is_last_chunk: true, created_at: '2026-01-01T00:00:05Z' },
      ],
    })

    renderAt('rec-1')

    await waitFor(() => expect(screen.getByTitle('Chunk 1 — received')).toBeInTheDocument())
    expect(screen.getByTitle('Chunk 2 — received')).toBeInTheDocument()
    expect(screen.getByTitle('Chunk 3 — missing')).toBeInTheDocument() // never uploaded, correctly flagged
    expect(screen.getByTitle('Chunk 4 — received')).toBeInTheDocument()
    expect(screen.getByTitle('Chunk 5 — received')).toBeInTheDocument()

    // Never claims a live video stream exists.
    expect(screen.getByText(/not a continuous live video stream/i)).toBeInTheDocument()
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
})
