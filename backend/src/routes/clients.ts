import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth, requireRole } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { clientSchema, idParam } from '../schemas'
import { AppError, notFound } from '../lib/errors'

const router = Router()
router.use(requireAuth)

// PMs need the list to pick a client when creating a project
router.get('/', requireRole('ADMIN', 'PROJECT_MANAGER'), async (_req, res) => {
  const clients = await prisma.client.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { projects: true } } },
  })
  res.json({ clients })
})

router.post('/', requireRole('ADMIN'), validateBody(clientSchema), async (req, res) => {
  const client = await prisma.client.create({ data: req.body })
  res.status(201).json({ client })
})

router.patch('/:id', requireRole('ADMIN'), validateBody(clientSchema.partial()), async (req, res) => {
  const id = idParam.parse(req.params.id)
  const existing = await prisma.client.findUnique({ where: { id } })
  if (!existing) throw notFound('Client not found')

  const client = await prisma.client.update({ where: { id }, data: req.body })
  res.json({ client })
})

router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  const id = idParam.parse(req.params.id)
  const projects = await prisma.project.count({ where: { clientId: id } })
  if (projects > 0) throw new AppError(409, 'Client still has projects')

  await prisma.client.delete({ where: { id } })
  res.status(204).end()
})

export default router
