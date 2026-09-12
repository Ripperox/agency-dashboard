import { Prisma, Project, Task } from '@prisma/client'
import { AuthUser } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { forbidden, notFound } from '../lib/errors'

// All the "who can see what" rules live here so routes don't each reinvent them.

export function projectWhereForUser(user: AuthUser): Prisma.ProjectWhereInput {
  if (user.role === 'ADMIN') return {}
  if (user.role === 'PROJECT_MANAGER') return { ownerId: user.id }
  // developers only see projects where they have at least one task
  return { tasks: { some: { assigneeId: user.id } } }
}

export function taskWhereForUser(user: AuthUser): Prisma.TaskWhereInput {
  if (user.role === 'ADMIN') return {}
  if (user.role === 'PROJECT_MANAGER') return { project: { ownerId: user.id } }
  return { assigneeId: user.id }
}

export function activityWhereForUser(user: AuthUser): Prisma.ActivityLogWhereInput {
  if (user.role === 'ADMIN') return {}
  if (user.role === 'PROJECT_MANAGER') return { project: { ownerId: user.id } }
  return { task: { assigneeId: user.id } }
}

export async function getProjectOrThrow(user: AuthUser, projectId: number): Promise<Project> {
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) throw notFound('Project not found')
  if (!canViewProject(user, project)) {
    // 404 instead of 403 so a PM can't probe for other PMs' project ids
    throw notFound('Project not found')
  }
  return project
}

export function canViewProject(user: AuthUser, project: Project) {
  if (user.role === 'ADMIN') return true
  if (user.role === 'PROJECT_MANAGER') return project.ownerId === user.id
  return false // developers go through tasks, checked separately
}

export function canManageProject(user: AuthUser, project: Project) {
  if (user.role === 'ADMIN') return true
  if (user.role === 'PROJECT_MANAGER') return project.ownerId === user.id
  return false
}

export async function assertCanManageProject(user: AuthUser, project: Project) {
  if (!canManageProject(user, project)) throw forbidden()
}

export async function getTaskOrThrow(user: AuthUser, taskId: number) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { project: true },
  })
  if (!task) throw notFound('Task not found')
  if (!canViewTask(user, task)) throw notFound('Task not found')
  return task
}

export function canViewTask(user: AuthUser, task: Task & { project: Project }) {
  if (user.role === 'ADMIN') return true
  if (user.role === 'PROJECT_MANAGER') return task.project.ownerId === user.id
  return task.assigneeId === user.id
}

// developers can move status on their own tasks, everything else needs project manage rights
export function canChangeStatus(user: AuthUser, task: Task & { project: Project }) {
  if (user.role === 'DEVELOPER') return task.assigneeId === user.id
  return canManageProject(user, task.project)
}
