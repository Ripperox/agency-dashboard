import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth, requireRole } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { createProjectSchema, updateProjectSchema, idParam } from '../schemas'
import { notFound } from '../lib/errors'
import { projectWhereForUser, getProjectOrThrow, assertCanManageProject, taskWhereForUser } from '../services/access'

const router = Router()
router.use(requireAuth)

const projectInclude = {
  client: { select: { id: true, name: true, company: true } },
  owner: { select: { id: true, name: true } },
  _count: { select: { tasks: true } },
}

router.get('/', async (req, res) => {
  const projects = await prisma.project.findMany({
    where: projectWhereForUser(req.user),
    include: projectInclude,
    orderBy: { createdAt: 'desc' },
  })
  res.json({ projects })
})

router.post('/', requireRole('ADMIN', 'PROJECT_MANAGER'), validateBody(createProjectSchema), async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.body.clientId } })
  if (!client) throw notFound('Client not found')

  const project = await prisma.project.create({
    data: { ...req.body, ownerId: req.user.id },
    include: projectInclude,
  })
  res.status(201).json({ project })
})

router.get('/:id', async (req, res) => {
  const id = idParam.parse(req.params.id)

  // developers can open a project only if they have tasks in it, and they only get their tasks back
  if (req.user.role === 'DEVELOPER') {
    const project = await prisma.project.findFirst({
      where: { id, tasks: { some: { assigneeId: req.user.id } } },
      include: projectInclude,
    })
    if (!project) throw notFound('Project not found')
    return res.json({ project })
  }

  await getProjectOrThrow(req.user, id)
  const project = await prisma.project.findUnique({ where: { id }, include: projectInclude })
  res.json({ project })
})

router.patch('/:id', requireRole('ADMIN', 'PROJECT_MANAGER'), validateBody(updateProjectSchema), async (req, res) => {
  const id = idParam.parse(req.params.id)
  const project = await getProjectOrThrow(req.user, id)
  await assertCanManageProject(req.user, project)

  if (req.body.clientId) {
    const client = await prisma.client.findUnique({ where: { id: req.body.clientId } })
    if (!client) throw notFound('Client not found')
  }

  const updated = await prisma.project.update({ where: { id }, data: req.body, include: projectInclude })
  res.json({ project: updated })
})

router.delete('/:id', requireRole('ADMIN', 'PROJECT_MANAGER'), async (req, res) => {
  const id = idParam.parse(req.params.id)
  const project = await getProjectOrThrow(req.user, id)
  await assertCanManageProject(req.user, project)

  await prisma.project.delete({ where: { id } })
  res.status(204).end()
})

// tasks inside one project, still filtered by what the caller may see
router.get('/:id/tasks', async (req, res) => {
  const id = idParam.parse(req.params.id)

  if (req.user.role !== 'DEVELOPER') {
    await getProjectOrThrow(req.user, id)
  }

  const tasks = await prisma.task.findMany({
    where: { AND: [{ projectId: id }, taskWhereForUser(req.user)] },
    include: { assignee: { select: { id: true, name: true } } },
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
  })

  if (req.user.role === 'DEVELOPER' && tasks.length === 0) {
    throw notFound('Project not found')
  }

  res.json({ tasks })
})

export default router
