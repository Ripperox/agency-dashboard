import { ActivityType } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { emitActivity } from '../socket'

interface LogInput {
  type: ActivityType
  taskId: number
  projectId: number
  actorId: number | null
  fromValue?: string | null
  toValue?: string | null
}

export const activityInclude = {
  actor: { select: { id: true, name: true } },
  task: { select: { id: true, title: true, assigneeId: true, status: true, priority: true, dueDate: true, isOverdue: true } },
  project: { select: { id: true, name: true, ownerId: true } },
} as const

// writes the log row first, then pushes it out. the db row is the source of truth,
// the socket event is just a hint to refresh.
export async function logActivity(input: LogInput) {
  const entry = await prisma.activityLog.create({
    data: {
      type: input.type,
      taskId: input.taskId,
      projectId: input.projectId,
      actorId: input.actorId,
      fromValue: input.fromValue ?? null,
      toValue: input.toValue ?? null,
    },
    include: activityInclude,
  })

  emitActivity({
    ...entry,
    projectOwnerId: entry.project.ownerId,
    assigneeId: entry.task.assigneeId,
  })

  return entry
}
