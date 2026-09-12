import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Activity } from '../api/types'
import { useSocket } from '../context/SocketContext'
import { describeActivity, timeAgo } from '../utils/format'

interface Props {
  projectId?: number
  limit?: number
  compact?: boolean
}

export default function ActivityFeed({ projectId, limit = 20, compact }: Props) {
  const { socket } = useSocket()
  const [items, setItems] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [missed, setMissed] = useState(0)
  const [, setTick] = useState(0)
  const latestId = useRef(0)
  const connectedBefore = useRef(false)

  const qs = (extra: string) => `/activity?limit=${limit}${projectId ? `&projectId=${projectId}` : ''}${extra}`

  const load = useCallback(async () => {
    setLoading(true)
    const d = await api.get<{ activity: Activity[] }>(qs(''))
    setItems(d.activity)
    setHasMore(d.activity.length === limit)
    latestId.current = d.activity[0]?.id ?? 0
    setLoading(false)
  }, [projectId, limit])

  useEffect(() => {
    load()
  }, [load])

  // relative timestamps need a nudge every so often
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!socket) return

    const onNew = (a: Activity) => {
      if (projectId && a.projectId !== projectId) return
      setItems((prev) => (prev.some((x) => x.id === a.id) ? prev : [a, ...prev]))
      if (a.id > latestId.current) latestId.current = a.id
    }

    // after a reconnect, ask the db for whatever happened while we were gone
    const onConnect = async () => {
      if (!connectedBefore.current) {
        connectedBefore.current = true
        return
      }
      if (!latestId.current) return
      const d = await api.get<{ activity: Activity[] }>(qs(`&after=${latestId.current}`))
      if (d.activity.length === 0) return
      setItems((prev) => {
        const seen = new Set(prev.map((x) => x.id))
        const fresh = d.activity.filter((x) => !seen.has(x.id))
        return [...fresh, ...prev]
      })
      latestId.current = Math.max(latestId.current, d.activity[0].id)
      setMissed(d.activity.length)
    }

    socket.on('activity:new', onNew)
    socket.on('connect', onConnect)
    if (socket.connected) connectedBefore.current = true

    return () => {
      socket.off('activity:new', onNew)
      socket.off('connect', onConnect)
    }
  }, [socket, projectId])

  async function loadMore() {
    const oldest = items[items.length - 1]
    if (!oldest) return
    const d = await api.get<{ activity: Activity[] }>(qs(`&before=${oldest.id}`))
    setItems((prev) => [...prev, ...d.activity])
    setHasMore(d.activity.length === limit)
  }

  return (
    <div className={`feed ${compact ? 'compact' : ''}`}>
      {missed > 0 && (
        <div className="notice">
          You were offline. {missed} update{missed === 1 ? '' : 's'} caught up from the server.
          <button className="link-btn" onClick={() => setMissed(0)}>
            dismiss
          </button>
        </div>
      )}
      {loading && items.length === 0 && <p className="muted">Loading…</p>}
      {!loading && items.length === 0 && <p className="muted">No activity yet.</p>}
      <ul className="feed-list">
        {items.map((a) => (
          <li key={a.id} className={`feed-item type-${a.type.toLowerCase()}`}>
            <div className="feed-text">
              {describeActivity(a)}
              {!projectId && (
                <>
                  {' '}
                  <span className="muted">in</span> <Link to={`/projects/${a.project.id}`}>{a.project.name}</Link>
                </>
              )}
            </div>
            <div className="feed-meta muted">
              <Link to={`/tasks/${a.task.id}`}>{a.task.title}</Link> · {timeAgo(a.createdAt)}
            </div>
          </li>
        ))}
      </ul>
      {hasMore && !compact && (
        <button className="btn ghost" onClick={loadMore}>
          Load older
        </button>
      )}
    </div>
  )
}
