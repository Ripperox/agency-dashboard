import type { Activity, Priority, TaskStatus } from '../api/types'

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
}

export const ROLE_LABELS = {
  ADMIN: 'Admin',
  PROJECT_MANAGER: 'Project Manager',
  DEVELOPER: 'Developer',
}

export const STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']
export const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min${m === 1 ? '' : 's'} ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString()
}

export function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// yyyy-mm-dd for <input type="date">
export function toDateInput(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 10)
}

function label(value: string | null, map: Record<string, string>) {
  if (!value) return '—'
  return map[value] ?? value
}

// "Ravi moved Task #12 from In Progress → In Review"
export function describeActivity(a: Activity) {
  const who = a.actor ? a.actor.name.split(' ')[0] : 'System'
  const ref = `Task #${a.task.id}`
  switch (a.type) {
    case 'TASK_CREATED':
      return `${who} created ${ref} "${a.task.title}"`
    case 'STATUS_CHANGED':
      return `${who} moved ${ref} from ${label(a.fromValue, STATUS_LABELS)} → ${label(a.toValue, STATUS_LABELS)}`
    case 'ASSIGNEE_CHANGED':
      return a.toValue ? `${who} assigned ${ref} to ${a.toValue}` : `${who} unassigned ${ref}`
    case 'PRIORITY_CHANGED':
      return `${who} changed ${ref} priority from ${label(a.fromValue, PRIORITY_LABELS)} → ${label(a.toValue, PRIORITY_LABELS)}`
    case 'DUE_DATE_CHANGED':
      return `${who} changed ${ref} due date to ${a.toValue ? formatDate(a.toValue) : 'none'}`
    case 'TASK_OVERDUE':
      return `${ref} "${a.task.title}" is overdue`
    default:
      return `${who} updated ${ref}`
  }
}
