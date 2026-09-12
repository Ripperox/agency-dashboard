import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { ROLE_LABELS } from '../utils/format'
import NotificationBell from './NotificationBell'

export default function Layout() {
  const { user, logout } = useAuth()
  const { connected } = useSocket()
  const navigate = useNavigate()

  if (!user) return null

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          Agency Board
        </div>
        <nav>
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/projects">Projects</NavLink>
          <NavLink to="/tasks">Tasks</NavLink>
          <NavLink to="/activity">Activity</NavLink>
          {user.role === 'ADMIN' && <NavLink to="/clients">Clients</NavLink>}
          {user.role === 'ADMIN' && <NavLink to="/users">Users</NavLink>}
        </nav>
        <div className="topbar-right">
          <span className={`live-dot ${connected ? 'on' : 'off'}`} title={connected ? 'Live updates connected' : 'Reconnecting…'} />
          <NotificationBell />
          <div className="whoami">
            <strong>{user.name}</strong>
            <small>{ROLE_LABELS[user.role]}</small>
          </div>
          <button className="btn ghost" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
