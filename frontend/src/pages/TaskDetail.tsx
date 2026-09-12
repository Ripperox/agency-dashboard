import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Activity, Task, TaskStatus } from '../api/types'
import { PriorityBadge, StatusBadge } from '../components/Badges'
import TaskForm from '../components/TaskForm'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { describeActivity, formatDate, STATUSES, STATUS_LABELS, timeAgo } from '../utils/format'

export default function TaskDetail() {
  const { id } = useParams()
  const taskId = Number(id)
  const { user } = useAuth()
  const { socket } = useSocket()
  const [task, setTask] = useState<Task | null>(null)
  const [activity, setActivity] = useState<Activity[]>([])
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)

  const load = useCallback(() => {
    api
      .get<{ task: Task }>(`/tasks/${taskId}`)
      .then((d) => setTask(d.task))
      .catch((e) => setError(e.message))
    api.get<{ activity: Activity[] }>(`/tasks/${taskId}/activity`).then((d) => setActivity(d.activity))
  }, [taskId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!socket) return
    const onActivity = (a: Activity) => {
      if (a.taskId === taskId) load()
    }
    socket.on('activity:new', onActivity)
    return () => {
      socket.off('activity:new', onActivity)
    }
  }, [socket, taskId, load])

  if (error) return <p className="error">{error}</p>
  if (!task || !user) return <p className="muted">Loading…</p>

  const canManage = user.role === 'ADMIN' || (user.role === 'PROJECT_MANAGER' && task.project?.ownerId === user.id)
  const canChangeStatus = canManage || task.assigneeId === user.id

  async function changeStatus(status: TaskStatus) {
    await api.patch(`/tasks/${taskId}/status`, { status })
    load()
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="crumb muted">
            <Link to="/projects">Projects</Link> / <Link to={`/projects/${task.projectId}`}>{task.project?.name}</Link>
          </p>
          <h1>
            <span className="muted">#{task.id}</span> {task.title}
          </h1>
        </div>
        {canManage && (
          <button className="btn ghost" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>

      <div className="two-col wide-left">
        <section className="card">
          <dl className="details">
            <dt>Status</dt>
            <dd>
              {canChangeStatus ? (
                <select className={`status-select status-${task.status.toLowerCase()}`} value={task.status} onChange={(e) => changeStatus(e.target.value as TaskStatus)}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              ) : (
                <StatusBadge status={task.status} />
              )}
              {task.isOverdue && <span className="badge overdue">Overdue</span>}
            </dd>
            <dt>Priority</dt>
            <dd>
              <PriorityBadge priority={task.priority} />
            </dd>
            <dt>Assignee</dt>
            <dd>{task.assignee?.name ?? <span className="muted">Unassigned</span>}</dd>
            <dt>Due date</dt>
            <dd>{formatDate(task.dueDate)}</dd>
            <dt>Description</dt>
            <dd className="pre">{task.description || <span className="muted">No description</span>}</dd>
          </dl>
        </section>

        <section className="card">
          <h2>History</h2>
          <ul className="feed-list">
            {activity.map((a) => (
              <li key={a.id} className={`feed-item type-${a.type.toLowerCase()}`}>
                <div className="feed-text">{describeActivity({ ...a, task: { ...task, id: task.id, title: task.title } as Activity['task'], project: { id: task.projectId, name: task.project?.name ?? '', ownerId: task.project?.ownerId ?? 0 } })}</div>
                <div className="feed-meta muted">{timeAgo(a.createdAt)}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {editing && <TaskForm projectId={task.projectId} task={task} onClose={() => setEditing(false)} onSaved={load} />}
    </>
  )
}
