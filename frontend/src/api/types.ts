export type Role = 'ADMIN' | 'PROJECT_MANAGER' | 'DEVELOPER'
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface User {
  id: number
  name: string
  email: string
  role: Role
  createdAt?: string
}

export interface Client {
  id: number
  name: string
  company: string | null
  email: string | null
  _count?: { projects: number }
}

export interface Project {
  id: number
  name: string
  description: string | null
  clientId: number
  ownerId: number
  createdAt: string
  client: { id: number; name: string; company: string | null }
  owner: { id: number; name: string }
  _count: { tasks: number }
}

export interface Task {
  id: number
  title: string
  description: string | null
  projectId: number
  assigneeId: number | null
  status: TaskStatus
  priority: Priority
  dueDate: string | null
  isOverdue: boolean
  createdAt: string
  updatedAt: string
  assignee: { id: number; name: string } | null
  project?: { id: number; name: string; ownerId?: number }
}

export type ActivityType =
  | 'TASK_CREATED'
  | 'STATUS_CHANGED'
  | 'ASSIGNEE_CHANGED'
  | 'PRIORITY_CHANGED'
  | 'DUE_DATE_CHANGED'
  | 'TASK_OVERDUE'

export interface Activity {
  id: number
  type: ActivityType
  taskId: number
  projectId: number
  actorId: number | null
  fromValue: string | null
  toValue: string | null
  createdAt: string
  actor: { id: number; name: string } | null
  task: { id: number; title: string; assigneeId: number | null; status: TaskStatus; priority: Priority; dueDate: string | null; isOverdue: boolean }
  project: { id: number; name: string; ownerId: number }
}

export interface Notification {
  id: number
  type: 'TASK_ASSIGNED' | 'TASK_IN_REVIEW'
  message: string
  taskId: number | null
  isRead: boolean
  createdAt: string
}

export interface AdminDashboard {
  role: 'ADMIN'
  totalProjects: number
  totalTasks: number
  tasksByStatus: Record<TaskStatus, number>
  overdueCount: number
  totalUsers: number
  onlineCount: number
}

export interface PmDashboard {
  role: 'PROJECT_MANAGER'
  projects: { id: number; name: string; client: string; total: number; done: number; overdue: number }[]
  tasksByPriority: Record<Priority, number>
  upcoming: Task[]
}

export interface DevDashboard {
  role: 'DEVELOPER'
  tasks: Task[]
  open: number
  overdue: number
}

export type Dashboard = AdminDashboard | PmDashboard | DevDashboard
