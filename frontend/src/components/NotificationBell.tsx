import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Notification } from '../api/types'
import { useSocket } from '../context/SocketContext'
import { timeAgo } from '../utils/format'

export default function NotificationBell() {
  const { socket } = useSocket()
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.get<{ notifications: Notification[]; unreadCount: number }>('/notifications').then((d) => {
      setItems(d.notifications)
      setUnread(d.unreadCount)
    })
  }, [])

  useEffect(() => {
    if (!socket) return
    const onNew = (p: { notification: Notification; unreadCount: number }) => {
      setItems((prev) => [p.notification, ...prev].slice(0, 30))
      setUnread(p.unreadCount)
    }
    socket.on('notification:new', onNew)
    return () => {
      socket.off('notification:new', onNew)
    }
  }, [socket])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function markRead(n: Notification) {
    if (n.isRead) return
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)))
    const d = await api.patch<{ unreadCount: number }>(`/notifications/${n.id}/read`)
    setUnread(d.unreadCount)
  }

  async function markAll() {
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })))
    await api.patch('/notifications/read-all')
    setUnread(0)
  }

  return (
    <div className="bell-wrap" ref={wrapRef}>
      <button className="bell" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="dropdown">
          <div className="dropdown-head">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button className="link-btn" onClick={markAll}>
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 && <p className="muted small pad">Nothing here yet.</p>}
          <ul className="notif-list">
            {items.map((n) => (
              <li key={n.id} className={n.isRead ? '' : 'unread'} onClick={() => markRead(n)}>
                {n.taskId ? (
                  <Link to={`/tasks/${n.taskId}`} onClick={() => setOpen(false)}>
                    {n.message}
                  </Link>
                ) : (
                  <span>{n.message}</span>
                )}
                <small className="muted">{timeAgo(n.createdAt)}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
