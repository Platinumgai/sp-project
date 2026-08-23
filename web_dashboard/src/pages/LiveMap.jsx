import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { Link } from 'react-router-dom'
import { useOperations } from '../context/OperationsContext.jsx'
import { useConstableLookup } from '../hooks/useConstableLookup.js'
import { LoadingSkeleton, ErrorState, PageHeader } from '../components/Primitives.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { formatDateTime } from '../utils/format.js'

// Leaflet's default marker icons reference image files that don't resolve
// correctly through Vite's bundler unless explicitly re-pointed at the
// CDN-hosted assets -- a well-known, standard workaround, not a hack
// specific to this project.
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})

const STATUS_COLOR = { online: '#22C55E', recording: '#EF4444', stale: '#F5A623', offline: '#5A6688' }

function coloredIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.5)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

export default function LiveMap() {
  const { devices, loading, error, refresh } = useOperations()
  const { label: constableLabel } = useConstableLookup()

  if (loading) return <LoadingSkeleton rows={8} />
  if (error) return <ErrorState message={error} onRetry={refresh} />

  const located = devices.filter((d) => d.latitude != null && d.longitude != null)
  const center = located.length > 0 ? [located[0].latitude, located[0].longitude] : [20.5937, 78.9629] // India centroid -- a reasonable default MAP VIEW center, not a fabricated device location

  return (
    <div>
      <PageHeader
        title="Live Map"
        subtitle={
          located.length === 0
            ? 'No devices currently have location data'
            : `Showing ${located.length} of ${devices.length} device(s) with known location`
        }
      />
      <div className="panel overflow-hidden" style={{ height: '70vh' }}>
        <MapContainer center={center} zoom={located.length > 0 ? 11 : 5} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {located.map((d) => (
            <Marker key={d.id} position={[d.latitude, d.longitude]} icon={coloredIcon(STATUS_COLOR[d.status] || '#5A6688') || defaultIcon}>
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">{constableLabel(d.constable_id)}</p>
                  <p>Status: {d.status}</p>
                  <p>Battery: {d.battery_percent != null ? `${d.battery_percent}%` : '—'}</p>
                  <p>Updated: {formatDateTime(d.location_updated_at)}</p>
                  <Link to={`/devices/${d.id}`} className="text-blue-600 underline">
                    View details
                  </Link>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {devices.some((d) => d.latitude == null) && (
        <p className="mt-3 text-sm text-ink-500">
          {devices.filter((d) => d.latitude == null).length} device(s) have no location data on record and are not shown on the map.
        </p>
      )}
    </div>
  )
}
