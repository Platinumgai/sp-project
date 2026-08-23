import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useOperations } from '../../context/OperationsContext.jsx'
import { ROLE_LABELS, canViewStations, canViewRoster, canViewAudit, canViewSettings, canViewOperations } from '../../utils/roles.js'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true, show: () => true },
  { to: '/monitoring', label: 'Live Monitoring', show: canViewOperations },
  { to: '/map', label: 'Live Map', show: canViewOperations },
  { to: '/devices', label: 'Devices', show: canViewOperations },
  { to: '/recordings', label: 'Recordings', show: canViewOperations },
  { to: '/alerts', label: 'Alerts', show: canViewOperations },
  { to: '/commands', label: 'Commands', show: canViewOperations },
  { to: '/constables', label: 'Constables', show: canViewRoster },
  { to: '/stations', label: 'Police Stations', show: canViewStations },
  { to: '/audit', label: 'Audit Logs', show: canViewAudit },
  { to: '/settings', label: 'Settings', show: canViewSettings },
  { to: '/incidents', label: 'Incidents (legacy)', show: () => true },
  { to: '/evidence', label: 'Evidence (legacy)', show: () => true },
]

export default function AppShell() {
  const { user, logout } = useAuth()
  const { connected, counts } = useOperations()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-base-950 text-ink-100">
      <aside className="flex w-64 shrink-0 flex-col border-r border-base-700 bg-base-900">
        <div className="flex items-center gap-3 border-b border-base-700 px-5 py-5">
          <span className="text-2xl">🚨</span>
          <div>
            <p className="font-semibold leading-tight text-ink-100">Body-Camera Control Room</p>
            <p className="text-xs text-ink-500">Operations Console</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scrollbar-thin">
          {NAV_ITEMS.filter((item) => item.show(user?.role)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-signal-blue/15 text-sky-300' : 'text-ink-300 hover:bg-base-700/60 hover:text-ink-100'
                }`
              }
            >
              <span>{item.label}</span>
              {item.to === '/alerts' && counts.criticalAlerts > 0 && (
                <span className="rounded-full bg-signal-red px-1.5 py-0.5 text-xs font-semibold text-white">{counts.criticalAlerts}</span>
              )}
              {item.to === '/recordings' && counts.activeRecordings > 0 && (
                <span className="rounded-full bg-signal-red px-1.5 py-0.5 text-xs font-semibold text-white">{counts.activeRecordings}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-base-700 p-3">
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-2 py-2 text-sm ${isActive ? 'bg-base-700/60' : 'hover:bg-base-700/40'}`
            }
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-signal-blue/20 font-semibold text-sky-300">
              {(user?.phone || '?')[0]}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium text-ink-100">{user?.phone}</span>
              <span className="block truncate text-xs text-ink-500">{ROLE_LABELS[user?.role] || user?.role}</span>
            </span>
          </NavLink>
          <button
            onClick={handleLogout}
            className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm text-ink-500 hover:bg-base-700/40 hover:text-red-300"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-base-700 bg-base-900/60 px-6 py-3">
          <div className="flex items-center gap-2 text-sm text-ink-500">
            <span
              className={`h-2 w-2 rounded-full ${connected ? 'bg-signal-green animate-pulseSlow' : 'bg-base-500'}`}
              title={connected ? 'Live updates connected' : 'Live updates disconnected'}
            />
            {connected ? 'Live' : 'Offline'}
          </div>
          <div className="text-sm text-ink-500">
            Signed in as <span className="text-ink-100">{user?.phone}</span> · {ROLE_LABELS[user?.role] || user?.role}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
