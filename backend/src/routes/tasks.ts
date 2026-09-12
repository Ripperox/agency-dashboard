import { Router } from 'express'
import { Prisma, TaskStatus } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { requireAuth, requireRole } from '../middleware/auth'
import { validateBody, validateQuery, getQuery } from '../middleware/validate'
import { createTaskSchema, updateTaskSchema, updateStatusSchema, taskFilterSchema, idParam } from '../schemas'
import { forbidden, notFound, badRequest } from '../lib/errors'
import { taskWhereForUser, getProjectOrThrow, assertCanManageProject, getTaskOrThrow, canChangeStatus } from '../services/access'
import { logActivity } from '../services/activity'
import { notify } from '../services/notifications'

const router = Router()
router.use(requireAuth)

const taskInclude = {
  assignee: { select: { id: true, name: true } },
  project: { select: { id: true, name: true, ownerId: true } },
}

type Filters = {
  status?: TaskStatus
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  dueFrom?: string
  dueTo?: string
  projectId?: number
  assigneeId?: number
  overdue?: 'true' | 'false'
}

function buildFilter(f: Filters): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = {}
  if (f.status) where.status = f.status
  if (f.priority) where.priority = f.priority
  if (f.projectId) where.projectId = f.projectId
  if (f.assigneeId) where.assigneeId = f.assigneeId
  if (f.overdue) where.isOverdue = f.overdue === 'true'
  if (f.dueFrom || f.dueTo) {
    where.dueDate = {}
    if (f.dueFrom) where.dueDate.gte = new Date(f.dueFrom)
    if (f.dueTo) {
      // include the whole "to" day
      const end = new Date(f.dueTo)
      end.setUTCHours(23, 59, 59, 999)
      where.dueDate.lte = end
    }
  }
  return where
}

router.get('/', validateQuery(taskFilterSchema), async (req, res) => {
  const filters = getQuery<Filters>(req)
  const tasks = await prisma.task.findMany({
    where: { AND: [taskWhereForUser(req.user), buildFilter(filters)] },
    include: taskInclude,
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { id: 'asc' }],
  })
  res.json({ tasks })
})

router.get('/:id', async (req, res) => {
  const id = idParam.parse(req.params.id)
  await getTaskOrThrow(req.user, id)
  const task = await prisma.task.findUnique({ where: { id }, include: taskInclude })
  res.json({ task })
})

async function checkAssignee(assigneeId: number | null | undefined) {
  if (!assigneeId) return
  const dev = await prisma.user.findUnique({ where: { id: assigneeId } })
  if (!dev) throw notFound('Assignee not found')
  if (dev.role !== 'DEVELOPER') throw badRequest('Tasks can only be assigned to developers')
  return dev
}

router.post('/project/:projectId', requireRole('ADMIN', 'PROJECT_MANAGER'), validateBody(createTaskSchema), async (req, res) => {
  const projectId = idParam.parse(req.params.projectId)
  const project = await getProjectOrThrow(req.user, projectId)
  await assertCanManageProject(req.user, project)

  const dev = await checkAssignee(req.body.assigneeId)

  const task = await prisma.task.create({
    data: {
      title: req.body.title,
      description: req.body.description ?? null,
      projectId,
      assigneeId: req.body.assigneeId ?? null,
      createdById: req.user.id,
      status: req.body.status ?? 'TODO',
      priority: req.body.priority ?? 'MEDIUM',
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
    },
    include: taskInclude,
  })

  await logActivity({ type: 'TASK_CREATED', taskId: task.id, projectId, actorId: req.user.id, toValue: task.title })

  if (dev) {
    await logActivity({ type: 'ASSIGNEE_CHANGED', taskId: task.id, projectId, actorId: req.user.id, toValue: dev.name })
    await notify(dev.id, 'TASK_ASSIGNED', `${req.user.name} assigned you "${task.title}"`, task.id)
  }

  res.status(201).json({ task })
})

router.patch('/:id', requireRole('ADMIN', 'PROJECT_MANAGER'), validateBody(updateTaskSchema), async (req, res) => {
  const id = idParam.parse(req.params.id)
  const task = await getTaskOrThrow(req.user, id)
  await assertCanManageProject(req.user, task.project)

  const body = req.body
  const data: Prisma.TaskUpdateInput = {}

  if (body.title !== undefined) data.title = body.title
  if (body.description !== undefined) data.description = body.description
  if (body.priority !== undefined) data.priority = body.priority
  if (body.dueDate !== undefined) {
    data.dueDate = body.dueDate ? new Date(body.dueDate) : null
    // cron will re-flag it if it's still in the past
    data.isOverdue = false
  }

  let newAssignee = undefined
  if (body.assigneeId !== undefined && body.assigneeId !== task.assigneeId) {
    newAssignee = await checkAssignee(body.assigneeId)
    data.assignee = body.assigneeId ? { connect: { id: body.assigneeId } } : { disconnect: true }
  }

  if (body.status !== undefined && body.status !== task.status) {
    data.status = body.status
    if (body.status === 'DONE') data.isOverdue = false
  }

  const updated = await prisma.task.update({ where: { id }, data, include: taskInclude })

  if (body.priority && body.priority !== task.priority) {
    await logActivity({ type: 'PRIORITY_CHANGED', taskId: id, projectId: task.projectId, actorId: req.user.id, fromValue: task.priority, toValue: body.priority })
  }
  if (body.dueDate !== undefined) {
    const before = task.dueDate ? task.dueDate.toISOString() : null
    const after = updated.dueDate ? updated.dueDate.toISOString() : null
    if (before !== after) {
      await logActivity({ type: 'DUE_DATE_CHANGED', taskId: id, projectId: task.projectId, actorId: req.user.id, fromValue: before, toValue: after })
    }
  }
  if (body.assigneeId !== undefined && body.assigneeId !== task.assigneeId) {
    const oldAssignee = task.assigneeId ? await prisma.user.findUnique({ where: { id: task.assigneeId } }) : null
    await logActivity({ type: 'ASSIGNEE_CHANGED', taskId: id, projectId: task.projectId, actorId: req.user.id, fromValue: oldAssignee?.name ?? null, toValue: newAssignee?.name ?? null })
    if (newAssignee) {
      await notify(newAssignee.id, 'TASK_ASSIGNED', `${req.user.name} assigned you "${updated.title}"`, id)
    }
  }
  if (body.status && body.status !== task.status) {
    await handleStatusChange(task, body.status, req.user)
  }

  res.json({ task: updated })
})

// developers hit this one, it's the only write they're allowed
router.patch('/:id/status', validateBody(updateStatusSchema), async (req, res) => {
  const id = idParam.parse(req.params.id)
  const task = await getTaskOrThrow(req.user, id)
  if (!canChangeStatus(req.user, task)) throw forbidden()

  const status = req.body.status as TaskStatus
  if (status === task.status) {
    const same = await prisma.task.findUnique({ where: { id }, include: taskInclude })
    return res.json({ task: same })
  }

  const updated = await prisma.task.update({
    where: { id },
    data: { status, isOverdue: status === 'DONE' ? false : task.isOverdue },
    include: taskInclude,
  })

  await handleStatusChange(task, status, req.user)
  res.json({ task: updated })
})

async function handleStatusChange(
  task: { id: number; title: string; status: TaskStatus; projectId: number; project: { ownerId: number } },
  status: TaskStatus,
  actor: { id: number; name: string },
) {
  await logActivity({ type: 'STATUS_CHANGED', taskId: task.id, projectId: task.projectId, actorId: actor.id, fromValue: task.status, toValue: status })

  // PM who owns the project gets pinged when something lands in review
  if (status === 'IN_REVIEW' && task.project.ownerId !== actor.id) {
    await notify(task.project.ownerId, 'TASK_IN_REVIEW', `${actor.name} moved "${task.title}" to In Review`, task.id)
  }
}

router.delete('/:id', requireRole('ADMIN', 'PROJECT_MANAGER'), async (req, res) => {
  const id = idParam.parse(req.params.id)
  const task = await getTaskOrThrow(req.user, id)
  await assertCanManageProject(req.user, task.project)

  await prisma.task.delete({ where: { id } })
  res.status(204).end()
})

router.get('/:id/activity', async (req, res) => {
  const id = idParam.parse(req.params.id)
  await getTaskOrThrow(req.user, id)

  const activity = await prisma.activityLog.findMany({
    where: { taskId: id },
    include: { actor: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ activity })
})

export default router
