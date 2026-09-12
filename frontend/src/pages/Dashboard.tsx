import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { AdminDashboard, Dashboard as DashboardData, DevDashboard, PmDashboard } from '../api/types'
import ActivityFeed from '../components/ActivityFeed'
import TaskTable from '../components/TaskTable'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { formatDate, PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS } from '../utils/format'

export default function Dashboard() {
  const { user } = useAuth()
  const { socket } = useSocket()
  const [data, setData] = useState<DashboardData | null>(null)
  const [online, setOnline] = useState<number | null>(null)

  const load = () => api.get<DashboardData>('/dashboard').then(setData)

  useEffect(() => {
    load()
  }, [])

  // any activity can change the counts, cheap enough to just refetch
  useEffect(() => {
    if (!socket) return
    const onActivity = () => load()
    const onPresence = (p: { count: number }) => setOnline(p.count)
    socket.on('activity:new', onActivity)
    socket.on('presence:count', onPresence)
    return () => {
      socket.off('activity:new', onActivity)
      socket.off('presence:count', onPresence)
    }
  }, [socket])

  if (!data || !user) return <p className="muted">Loading…</p>

  return (
    <>
      <div className="page-head">
        <h1>Good day, {user.name.split(' ')[0]}</h1>
      </div>
      {data.role === 'ADMIN' && <AdminView data={data} online={online ?? data.onlineCount} />}
      {data.role === 'PROJECT_MANAGER' && <PmView data={data} />}
      {data.role === 'DEVELOPER' && <DevView data={data} onChanged={load} />}
    </>
  )
}

function AdminView({ data, online }: { data: AdminDashboard; online: number }) {
  return (
    <>
      <div className="stats">
        <Stat label="Projects" value={data.totalProjects} to="/projects" />
        <Stat label="Tasks" value={data.totalTasks} to="/tasks" />
        <Stat label="Overdue" value={data.overdueCount} to="/tasks?overdue=true" tone={data.overdueCount > 0 ? 'bad' : undefined} />
        <Stat label="Online now" value={online} tone="live" hint="live via websocket" />
      </div>
      <div className="two-col">
        <section className="card">
          <h2>Tasks by status</h2>
          <ul className="bars">
            {STATUSES.map((s) => (
              <li key={s}>
                <Link to={`/tasks?status=${s}`}>{STATUS_LABELS[s]}</Link>
                <div className="bar">
                  <div className={`bar-fill status-${s.toLowerCase()}`} style={{ width: `${data.totalTasks ? (data.tasksByStatus[s] / data.totalTasks) * 100 : 0}%` }} />
                </div>
                <span className="mono">{data.tasksByStatus[s]}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h2>Activity across all projects</h2>
          <ActivityFeed limit={10} compact />
        </section>
      </div>
    </>
  )
}

function PmView({ data }: { data: PmDashboard }) {
  const totalTasks = Object.values(data.tasksByPriority).reduce((a, b) => a + b, 0)
  return (
    <>
      <div className="stats">
        <Stat label="My projects" value={data.projects.length} to="/projects" />
        <Stat label="Open tasks" value={totalTasks - data.projects.reduce((a, p) => a + p.done, 0)} to="/tasks" />
        <Stat label="Overdue" value={data.projects.reduce((a, p) => a + p.overdue, 0)} to="/tasks?overdue=true" tone="bad" />
        <Stat label="Due this week" value={data.upcoming.length} />
      </div>
      <div className="two-col">
        <div>
          <section className="card">
            <h2>Projects</h2>
            {data.projects.length === 0 && <p className="muted">You haven't created any projects yet.</p>}
            <ul className="project-list">
              {data.projects.map((p) => (
                <li key={p.id}>
                  <div>
                    <Link to={`/projects/${p.id}`}>
                      <strong>{p.name}</strong>
                    </Link>
                    <small className="muted"> · {p.client}</small>
                  </div>
                  <div className="progress">
                    <div className="bar">
                      <div className="bar-fill status-done" style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%` }} />
                    </div>
                    <span className="mono small">
                      {p.done}/{p.total}
                    </span>
                    {p.overdue > 0 && <span className="badge overdue">{p.overdue} overdue</span>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className="card">
            <h2>Tasks by priority</h2>
            <ul className="bars">
              {[...PRIORITIES].reverse().map((p) => (
                <li key={p}>
                  <Link to={`/tasks?priority=${p}`}>{PRIORITY_LABELS[p]}</Link>
                  <div className="bar">
                    <div className={`bar-fill priority-${p.toLowerCase()}`} style={{ width: `${totalTasks ? (data.tasksByPriority[p] / totalTasks) * 100 : 0}%` }} />
                  </div>
                  <span className="mono">{data.tasksByPriority[p]}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <div>
          <section className="card">
            <h2>Due in the next 7 days</h2>
            {data.upcoming.length === 0 && <p className="muted">Nothing due this week.</p>}
            <ul className="due-list">
              {data.upcoming.map((t) => (
                <li key={t.id}>
                  <Link to={`/tasks/${t.id}`}>{t.title}</Link>
                  <span className="muted small">
                    {t.assignee?.name ?? 'Unassigned'} · {formatDate(t.dueDate)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="card">
            <h2>Activity on my projects</h2>
            <ActivityFeed limit={10} compact />
          </section>
        </div>
      </div>
    </>
  )
}

function DevView({ data, onChanged }: { data: DevDashboard; onChanged: () => void }) {
  return (
    <>
      <div className="stats">
        <Stat label="Assigned to me" value={data.tasks.length} to="/tasks" />
        <Stat label="Open" value={data.open} />
        <Stat label="Overdue" value={data.overdue} to="/tasks?overdue=true" tone={data.overdue > 0 ? 'bad' : undefined} />
      </div>
      <section className="card">
        <h2>My tasks</h2>
        <p className="muted small">Sorted by priority, then due date.</p>
        <TaskTable tasks={data.tasks} showProject onChanged={onChanged} />
      </section>
      <section className="card">
        <h2>Activity on my tasks</h2>
        <ActivityFeed limit={10} compact />
      </section>
    </>
  )
}

function Stat({ label, value, to, tone, hint }: { label: string; value: number; to?: string; tone?: 'bad' | 'live'; hint?: string }) {
  const body = (
    <>
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${tone ?? ''}`}>{value}</span>
      {hint && <span className="stat-hint muted">{hint}</span>}
    </>
  )
  return to ? (
    <Link to={to} className="stat">
      {body}
    </Link>
  ) : (
    <div className="stat">{body}</div>
  )
}
