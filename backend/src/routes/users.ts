import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { requireAuth, requireRole } from '../middleware/auth'
import { validateBody, validateQuery, getQuery } from '../middleware/validate'
import { createUserSchema, updateUserSchema, usersQuerySchema, idParam } from '../schemas'
import { AppError, notFound, badRequest } from '../lib/errors'

const router = Router()
router.use(requireAuth)

const safeSelect = { id: true, name: true, email: true, role: true, createdAt: true }

// admins get everyone, PMs only need the developer list to assign tasks
router.get('/', requireRole('ADMIN', 'PROJECT_MANAGER'), validateQuery(usersQuerySchema), async (req, res) => {
  const { role } = getQuery<{ role?: 'ADMIN' | 'PROJECT_MANAGER' | 'DEVELOPER' }>(req)

  if (req.user.role === 'PROJECT_MANAGER' && role !== 'DEVELOPER') {
    throw new AppError(403, 'Project managers can only list developers')
  }

  const users = await prisma.user.findMany({
    where: role ? { role } : {},
    select: safeSelect,
    orderBy: { name: 'asc' },
  })
  res.json({ users })
})

router.post('/', requireRole('ADMIN'), validateBody(createUserSchema), async (req, res) => {
  const { name, email, password, role } = req.body
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) throw new AppError(409, 'Email already in use')

  const user = await prisma.user.create({
    data: { name, email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 10), role },
    select: safeSelect,
  })
  res.status(201).json({ user })
})

router.patch('/:id', requireRole('ADMIN'), validateBody(updateUserSchema), async (req, res) => {
  const id = idParam.parse(req.params.id)
  if (id === req.user.id && req.body.role && req.body.role !== 'ADMIN') {
    throw badRequest('You cannot remove your own admin role')
  }
  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) throw notFound('User not found')

  const user = await prisma.user.update({ where: { id }, data: req.body, select: safeSelect })
  res.json({ user })
})

router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  const id = idParam.parse(req.params.id)
  if (id === req.user.id) throw badRequest('You cannot delete yourself')

  const owned = await prisma.project.count({ where: { ownerId: id } })
  if (owned > 0) throw new AppError(409, 'Reassign this user\'s projects before deleting them')

  await prisma.user.delete({ where: { id } })
  res.status(204).end()
})

export default router
