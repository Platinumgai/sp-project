const TONE_MAP = {
  // Incident statuses
  new: 'blue', verified: 'green', rejected: 'red', assigned: 'amber',
  en_route: 'amber', arrived: 'amber', resolved: 'green', closed: 'slate', needs_review: 'violet',
  // Evidence upload statuses
  uploading: 'slate', uploaded: 'blue', archived: 'slate',
  // Constable statuses
  available: 'green', busy: 'amber',
  // Assignment statuses
  pending: 'amber', accepted: 'green', completed: 'green',
  // User account status
  active: 'green', inactive: 'slate',
  // Phase 1-3: Device status -- offline is safety-critical in this domain
  // (a lost/unreachable body-cam device), not merely "off shift", so it
  // gets a stronger tone than the old constable-status meaning did.
  online: 'green', stale: 'amber', offline: 'red',
  recording: 'red',
  // Alert severity/status
  open: 'red', acknowledged: 'amber',
  warning: 'amber', critical: 'red',
  // Recording status
  cancelled: 'slate', failed: 'red',
  // RemoteCommand status
  sent: 'blue', executed: 'green', timeout: 'red',
}

const TONE_CLASSES = {
  green: 'bg-signal-green/10 text-emerald-300 border-signal-green/30',
  amber: 'bg-signal-amber/10 text-amber-300 border-signal-amber/30',
  red: 'bg-signal-red/10 text-red-300 border-signal-red/30',
  blue: 'bg-signal-blue/10 text-sky-300 border-signal-blue/30',
  violet: 'bg-signal-violet/10 text-violet-300 border-signal-violet/30',
  slate: 'bg-base-600/40 text-ink-300 border-base-500/40',
}

export default function StatusBadge({ status, label }) {
  const tone = TONE_MAP[status] || 'slate'
  const text = label || (status ? status.replace(/_/g, ' ') : 'unknown')
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${TONE_CLASSES[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${TONE_CLASSES[tone].split(' ')[1].replace('text-', 'bg-')}`} />
      {text}
    </span>
  )
}
