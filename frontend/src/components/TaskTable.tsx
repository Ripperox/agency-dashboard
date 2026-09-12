import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Task, TaskStatus } from '../api/types'
import { useAuth } from '../context/AuthContext'
import { formatDate, STATUSES, STATUS_LABELS } from '../utils/format'
import { PriorityBadge, StatusBadge } from './Badges'

interface Props {
  tasks: Task[]
  showProject?: boolean
  onChanged: () => void
  onEdit?: (task: Task) => void
}

export default function TaskTable({ tasks, showProject, onChanged, onEdit }: Props) {
  const { user } = useAuth()

  function canChangeStatus(t: Task) {
    if (!user) return false
    if (user.role === 'ADMIN') return true
    if (user.role === 'PROJECT_MANAGER') return t.project?.ownerId === user.id
    return t.assigneeId === user.id
  }

  async function changeStatus(t: Task, status: TaskStatus) {
    try {
      await api.patch(`/tasks/${t.id}/status`, { status })
      onChanged()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  if (tasks.length === 0) return <p className="muted">No tasks match.</p>

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Task</th>
            {showProject && <th>Project</th>}
            <th>Assignee</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Due</th>
            {onEdit && <th />}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} className={t.isOverdue ? 'row-overdue' : ''}>
              <td>
                <Link to={`/tasks/${t.id}`} className="task-title">
                  #{t.id} {t.title}
                </Link>
              </td>
              {showProject && <td>{t.project ? <Link to={`/projects/${t.project.id}`}>{t.project.name}</Link> : '—'}</td>}
              <td>{t.assignee?.name ?? <span className="muted">Unassigned</span>}</td>
              <td>
                <PriorityBadge priority={t.priority} />
              </td>
              <td>
                {canChangeStatus(t) ? (
                  <select className={`status-select status-${t.status.toLowerCase()}`} value={t.status} onChange={(e) => changeStatus(t, e.target.value as TaskStatus)}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <StatusBadge status={t.status} />
                )}
              </td>
              <td>
                {formatDate(t.dueDate)}
                {t.isOverdue && <span className="badge overdue">Overdue</span>}
              </td>
              {onEdit && (
                <td>
                  <button className="link-btn" onClick={() => onEdit(t)}>
                    Edit
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
