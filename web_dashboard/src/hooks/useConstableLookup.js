import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { listConstables } from '../api/constables.js'
import { canViewRoster } from '../utils/roles.js'

/**
 * Returns a map of constable_id -> constable record (as returned by
 * GET /constables/, i.e. {id, badge_number, phone, status, ...}) plus a
 * `label(constableId)` helper. The backend has no "name" field anywhere
 * in this project -- constables are identified by badge_number/phone
 * only -- so this never invents a display name beyond what the API
 * actually returns.
 */
export function useConstableLookup() {
  const { user } = useAuth()
  const [byId, setById] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!canViewRoster(user?.role)) {
      setLoading(false)
      return
    }
    let cancelled = false
    listConstables()
      .then((rows) => {
        if (cancelled) return
        const map = {}
        for (const c of rows) map[c.id] = c
        setById(map)
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [user?.role])

  function label(constableId) {
    if (!constableId) return '—'
    const c = byId[constableId]
    if (!c) return constableId.slice(0, 8)
    return c.badge_number || c.phone || constableId.slice(0, 8)
  }

  return { byId, label, loading }
}
