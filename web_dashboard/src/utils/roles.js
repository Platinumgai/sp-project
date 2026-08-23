// These functions only control which buttons/links are SHOWN. Every action
// they gate is independently re-checked and enforced by the backend; this
// file never grants an ability the API wouldn't also allow, it only avoids
// showing controls that would just fail against a real backend.

export const ROLE_LABELS = {
  admin: 'Administrator',
  control_room: 'Control Room',
  station: 'Police Station',
  constable: 'Constable',
  citizen: 'Citizen',
}

export function canManageStations(role) {
  return role === 'admin'
}

export function canViewStations(role) {
  return ['admin', 'control_room', 'station'].includes(role)
}

export function canViewRoster(role) {
  return ['admin', 'control_room', 'station'].includes(role)
}

export function canManageConstables(role) {
  return role === 'admin'
}

export function canViewAudit(role) {
  return ['admin', 'control_room', 'station'].includes(role)
}

export function canViewSettings(role) {
  return ['admin', 'control_room'].includes(role)
}

export function canEditSettings(role) {
  return role === 'admin'
}

export function canCreateIncident(role) {
  return ['admin', 'control_room', 'citizen'].includes(role)
}

export function canVerifyIncident(role) {
  return ['admin', 'control_room', 'station'].includes(role)
}

export function canDispatch(role) {
  return ['admin', 'control_room', 'station'].includes(role)
}

export function canUploadEvidence(role) {
  return ['admin', 'control_room', 'constable', 'citizen'].includes(role)
}

export function canVerifyEvidence(role) {
  return ['admin', 'control_room', 'station'].includes(role)
}

export function isConstable(role) {
  return role === 'constable'
}

// Phase 1-3 domain (devices/alerts/recordings/commands): every backend
// endpoint for these uses the SAME matrix -- admin/control_room: full;
// station: own-station only; constable: own device/recordings only;
// citizen: denied entirely. Mirrors app/routers/devices.py,
// commands.py, recordings.py, alerts.py exactly.
export function canViewOperations(role) {
  return ['admin', 'control_room', 'station', 'constable'].includes(role)
}

export function canIssueCommands(role) {
  return ['admin', 'control_room', 'station'].includes(role)
}
