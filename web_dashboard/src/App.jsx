import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/layout/ProtectedRoute.jsx'
import AppShell from './components/layout/AppShell.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Monitoring from './pages/Monitoring.jsx'
import LiveMap from './pages/LiveMap.jsx'
import Devices from './pages/Devices.jsx'
import DeviceDetails from './pages/DeviceDetails.jsx'
import Recordings from './pages/Recordings.jsx'
import RecordingDetails from './pages/RecordingDetails.jsx'
import Alerts from './pages/Alerts.jsx'
import Commands from './pages/Commands.jsx'
import Constables from './pages/Constables.jsx'
import ConstableDetails from './pages/ConstableDetails.jsx'
import Incidents from './pages/Incidents.jsx'
import IncidentDetails from './pages/IncidentDetails.jsx'
import Evidence from './pages/Evidence.jsx'
import PoliceStations from './pages/PoliceStations.jsx'
import AuditLogs from './pages/AuditLogs.jsx'
import Settings from './pages/Settings.jsx'
import Profile from './pages/Profile.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="monitoring" element={<Monitoring />} />
        <Route path="map" element={<LiveMap />} />
        <Route path="devices" element={<Devices />} />
        <Route path="devices/:id" element={<DeviceDetails />} />
        <Route path="recordings" element={<Recordings />} />
        <Route path="recordings/:id" element={<RecordingDetails />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="commands" element={<Commands />} />
        <Route path="constables" element={<Constables />} />
        <Route path="constables/:id" element={<ConstableDetails />} />
        <Route path="stations" element={<PoliceStations />} />
        <Route path="audit" element={<AuditLogs />} />
        <Route path="settings" element={<Settings />} />
        <Route path="profile" element={<Profile />} />
        {/* Legacy/secondary functionality, retained but not primary nav */}
        <Route path="incidents" element={<Incidents />} />
        <Route path="incidents/:id" element={<IncidentDetails />} />
        <Route path="evidence" element={<Evidence />} />
      </Route>
    </Routes>
  )
}
