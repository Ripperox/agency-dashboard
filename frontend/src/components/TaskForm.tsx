import { useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from '../api/client'
import type { Priority, Task, TaskStatus, User } from '../api/types'
import { PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS, toDateInput } from '../utils/format'
import Modal from './Modal'

interface Props {
  projectId: number
  task?: Task | null
  onClose: () => void
  onSaved: () => void
}

export default function TaskForm({ projectId, task, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [assigneeId, setAssigneeId] = useState<string>(task?.assigneeId ? String(task.assigneeId) : '')
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'MEDIUM')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'TODO')
  const [dueDate, setDueDate] = useState(toDateInput(task?.dueDate ?? null))
  const [devs, setDevs] = useState<User[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get<{ users: User[] }>('/users?role=DEVELOPER').then((d) => setDevs(d.users))
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const body = {
      title,
      description: description || null,
      assigneeId: assigneeId ? Number(assigneeId) : null,
      priority,
      status,
      dueDate: dueDate ? new Date(dueDate + 'T18:00:00').toISOString() : null,
    }
    try {
      if (task) await api.patch(`/tasks/${task.id}`, body)
      else await api.post(`/tasks/project/${projectId}`, body)
      onSaved()
      onClose()
    } catch (err) {
      if (err instanceof ApiError && err.details) setError(err.details.map((d) => `${d.path}: ${d.message}`).join(', '))
      else setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={task ? `Edit task #${task.id}` : 'New task'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>
        <div className="form-row">
          <label>
            Assignee
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {devs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Due date
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Saving…' : task ? 'Save changes' : 'Create task'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
