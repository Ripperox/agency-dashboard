import type { Priority, TaskStatus } from '../api/types'
import { PRIORITY_LABELS, STATUS_LABELS } from '../utils/format'

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`badge status-${status.toLowerCase()}`}>{STATUS_LABELS[status]}</span>
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`badge priority-${priority.toLowerCase()}`}>{PRIORITY_LABELS[priority]}</span>
}
