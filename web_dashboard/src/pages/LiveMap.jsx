import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { Link } from 'react-router-dom'
import { useOperations } from '../context/OperationsContext.jsx'
import { useConstableLookup } from '../hooks/useConstableLookup.js'
import { LoadingSkeleton, ErrorState, PageHeader } from '../components/Primitives.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { formatDateTime, formatRelativeTime } from '../utils/format.js'

// Same three-way palette as StatusBadge's own online/offline tones (see
// components/StatusBadge.jsx TONE_CLASSES.green/red) -- not a new/separate
// color scheme invented for this page.
const ACTIVE_COLOR = '#22C55E'
const OFFLINE_COLOR = '#EF4444'
const NO_LOCATION_COLOR = '#9CA3AF'

// badge_number is admin-settable free text (see api/constables.js::createConstable)
// and gets inserted as raw HTML into a Leaflet divIcon below -- escaped here
// exactly like any other server-controlled-but-arbitrary string reaching innerHTML.
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

// A colored dot with the constable's name permanently visible underneath
// (not only inside the popup on click) -- react-leaflet has no first-class
// "labeled marker" component, so this is a divIcon combining both, which is
// the standard supported way to do this with Leaflet's existing marker
// system rather than replacing it.
function labeledIcon(color, label) {
  return L.divIcon({
    className: 'live-map-marker',
    html: `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;">
      <div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.6)"></div>
      <div style="margin-top:2px;padding:1px 6px;background:rgba(15,17,21,0.85);color:#fff;font-size:11px;line-height:1.5;border-radius:4px;white-space:nowrap;font-weight:600;">${escapeHtml(label)}</div>
    </div>`,
    iconSize: undefined,
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  })
}

// Bridges the sidebar (rendered OUTSIDE <MapContainer>) to the actual
// Leaflet map instance so clicking a constable in the list can pan/zoom to
// their marker -- react-leaflet v4 only exposes the live map instance via
// useMap() to components rendered INSIDE <MapContainer>.
function MapController({ mapRef }) {
  const map = useMap()
  useEffect(() => {
    mapRef.current = map
  }, [map, mapRef])
  return null
}

// ACTIVE is defined by the EXISTING effective device status computed
// server-side (see backend/app/routers/devices.py::compute_effective_status,
// based on heartbeat freshness) -- the exact same source of truth
// OperationsContext's own `counts.online` already uses elsewhere in this
// dashboard. Never a second/conflicting definition of "active".
function isActiveStatus(status) {
  return status === 'online' || status === 'recording'
}

function pickDeviceForConstable(devices, constableId) {
  const owned = devices.filter((d) => d.constable_id === constableId)
  if (owned.length === 0) return null
  const withLocation = owned.filter((d) => d.latitude != null && d.longitude != null)
  if (withLocation.length > 0) {
    // Current seed data is one device per constable, but this is never
    // assumed -- the most recently location-updated device wins if there's
    // ever more than one.
    return withLocation.reduce((a, b) => (new Date(b.location_updated_at || 0) > new Date(a.location_updated_at || 0) ? b : a))
  }
  return owned[0]
}

function constableLabel(c) {
  return c.badge_number || c.phone || String(c.id).slice(0, 8)
}

export default function LiveMap() {
  const { devices, loading, error, refresh } = useOperations()
  const { byId, loading: rosterLoading } = useConstableLookup()
  const mapRef = useRef(null)
  const [, setTick] = useState(0)

  // Re-renders periodically purely so "Updated Xs ago" in the sidebar
  // stays fresh even when no new WebSocket event has arrived -- display
  // only, never touches data/network (mirrors the mobile app's existing
  // 1s UI ticker pattern for its own recording timer).
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000)
    return () => clearInterval(id)
  }, [])

  const rows = useMemo(() => {
    // Roster-visible roles (admin/control_room/station) get every
    // constable from GET /constables/, including ones with no device/
    // location yet. A constable-role viewer never calls that endpoint
    // (useConstableLookup gates on canViewRoster) but still sees their OWN
    // device via GET /devices/ -- so any constable_id present on a device
    // but missing from the roster fetch is included too, with the same
    // id-prefix fallback label the app already used before this page
    // existed, never a fabricated name.
    const knownIds = new Set(Object.keys(byId))
    const extraIds = new Set(devices.map((d) => d.constable_id).filter((id) => id && !knownIds.has(id)))
    const allConstables = [
      ...Object.values(byId),
      ...Array.from(extraIds).map((id) => ({ id, badge_number: null, phone: null, station_name: null })),
    ]

    return allConstables.map((c) => {
      const device = pickDeviceForConstable(devices, c.id)
      const hasLocation = !!(device && device.latitude != null && device.longitude != null)
      const active = hasLocation && isActiveStatus(device.status)
      const category = !hasLocation ? 'no-location' : active ? 'active' : 'offline'
      return { constable: c, device, hasLocation, active, category }
    })
  }, [byId, devices])

  if (loading || rosterLoading) return <LoadingSkeleton rows={8} />
  if (error) return <ErrorState message={error} onRetry={refresh} />

  const activeRows = rows.filter((r) => r.category === 'active')
  const offlineRows = rows.filter((r) => r.category === 'offline')
  const noLocationRows = rows.filter((r) => r.category === 'no-location')
  const located = rows.filter((r) => r.hasLocation)

  const center =
    located.length > 0
      ? [located[0].device.latitude, located[0].device.longitude]
      : [20.5937, 78.9629] // India centroid -- a reasonable default MAP VIEW center, not a fabricated device location

  function focusOn(row) {
    if (!row.hasLocation || !mapRef.current) return
    mapRef.current.flyTo([row.device.latitude, row.device.longitude], 14, { duration: 0.6 })
  }

  return (
    <div>
      <PageHeader
        title="Live Map"
        subtitle={`${activeRows.length} active, ${offlineRows.length} offline with last known location, ${noLocationRows.length} without location data`}
      />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="panel overflow-hidden relative" style={{ height: '70vh' }}>
          <MapContainer center={center} zoom={located.length > 0 ? 11 : 5} style={{ height: '100%', width: '100%' }}>
            <MapController mapRef={mapRef} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {located.map((r) => (
              <Marker
                key={r.constable.id}
                position={[r.device.latitude, r.device.longitude]}
                icon={labeledIcon(r.active ? ACTIVE_COLOR : OFFLINE_COLOR, constableLabel(r.constable))}
              >
                <Popup>
                  <div className="text-sm space-y-1.5 min-w-[180px]">
                    <p className="font-semibold text-base">{constableLabel(r.constable)}</p>
                    <div className="flex items-center gap-2">
                      <span>Status:</span>
                      <StatusBadge status={r.active ? 'online' : 'offline'} label={r.active ? 'ACTIVE' : 'OFFLINE'} />
                    </div>
                    {!r.active && <p className="text-xs text-ink-500 -mt-1">Last known location</p>}
                    <p>
                      Location: {r.device.latitude.toFixed(6)}, {r.device.longitude.toFixed(6)}
                    </p>
                    <p>Last Update: {formatDateTime(r.device.location_updated_at)}</p>
                    {r.device.device_identifier && <p>Device: {r.device.device_identifier}</p>}
                    {r.constable.station_name && <p>Station: {r.constable.station_name}</p>}
                    <Link to={`/devices/${r.device.id}`} className="text-blue-600 underline">
                      View device details
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          <div className="absolute bottom-3 left-3 z-[1000] rounded-lg bg-base-800/90 border border-base-600/50 px-3 py-2 text-xs text-ink-200 space-y-1 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: ACTIVE_COLOR }} /> Active Constable
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: OFFLINE_COLOR }} /> Offline / Last Known Location
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: NO_LOCATION_COLOR }} /> No Location Available
            </div>
          </div>
        </div>

        <div className="panel p-3 overflow-y-auto" style={{ height: '70vh' }}>
          <SidebarSection title="Live Constables" tone="active" rows={activeRows} onSelect={focusOn} />
          <SidebarSection title="Offline / Last Known" tone="offline" rows={offlineRows} onSelect={focusOn} />
          <SidebarSection title="No Location" tone="no-location" rows={noLocationRows} onSelect={focusOn} />
          {rows.length === 0 && <p className="text-sm text-ink-500">No constables to display.</p>}
        </div>
      </div>
    </div>
  )
}

function SidebarSection({ title, tone, rows, onSelect }) {
  if (rows.length === 0) return null
  const dotColor = tone === 'active' ? ACTIVE_COLOR : tone === 'offline' ? OFFLINE_COLOR : NO_LOCATION_COLOR
  return (
    <div className="mb-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-2">{title}</h3>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <button
            key={r.constable.id}
            type="button"
            onClick={() => onSelect(r)}
            disabled={!r.hasLocation}
            className={`w-full text-left rounded-lg border border-base-600/40 px-2.5 py-2 text-sm transition-colors ${
              r.hasLocation ? 'hover:bg-base-700/60 cursor-pointer' : 'cursor-default opacity-80'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />
              <span className="font-medium truncate">{constableLabel(r.constable)}</span>
            </div>
            <div className="mt-0.5 pl-4 text-xs text-ink-500">
              {tone === 'no-location'
                ? 'No location reported yet'
                : tone === 'active'
                  ? `Active · Updated ${formatRelativeTime(r.device.location_updated_at)}`
                  : `Offline · Last update ${formatRelativeTime(r.device.location_updated_at)}`}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
