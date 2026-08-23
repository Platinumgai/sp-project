import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatusBadge from './StatusBadge.jsx'

describe('StatusBadge', () => {
  it('renders device statuses with visually distinct tones (online vs offline must not look the same)', () => {
    const { container: onlineContainer } = render(<StatusBadge status="online" />)
    const { container: offlineContainer } = render(<StatusBadge status="offline" />)
    const { container: staleContainer } = render(<StatusBadge status="stale" />)

    expect(onlineContainer.querySelector('span')?.className).toContain('signal-green')
    // Device 'offline' is intentionally mapped to the RED/critical tone
    // (not a neutral one) -- a lost/unreachable body-cam device is
    // safety-critical, unlike the old "off duty" meaning this same string
    // has for Constable.status. See TONE_MAP's own comment in StatusBadge.jsx.
    expect(offlineContainer.querySelector('span')?.className).toContain('signal-red')
    expect(staleContainer.querySelector('span')?.className).toContain('signal-amber')
  })

  it('renders "recording" (an active/urgent state) with the red/critical tone, not a neutral one', () => {
    const { container } = render(<StatusBadge status="recording" />)
    expect(container.querySelector('span')?.className).toContain('signal-red')
  })

  it('renders command lifecycle states distinctly (executed=success vs failed=danger must differ)', () => {
    const { container: executedContainer } = render(<StatusBadge status="executed" />)
    const { container: failedContainer } = render(<StatusBadge status="failed" />)
    expect(executedContainer.querySelector('span')?.className).toContain('signal-green')
    expect(failedContainer.querySelector('span')?.className).toContain('signal-red')
  })

  it('renders alert severity/status correctly: open=red (needs attention), resolved should not also be red', () => {
    render(<StatusBadge status="open" />)
    expect(screen.getByText('open')).toBeInTheDocument()
  })

  it('falls back to a neutral tone for an unrecognized status rather than crashing', () => {
    const { container } = render(<StatusBadge status="some_future_status_not_yet_mapped" />)
    expect(container.querySelector('span')?.className).toContain('base-600')
    expect(screen.getByText('some future status not yet mapped')).toBeInTheDocument()
  })

  it('handles a missing status gracefully', () => {
    render(<StatusBadge status={undefined} />)
    expect(screen.getByText('unknown')).toBeInTheDocument()
  })
})
