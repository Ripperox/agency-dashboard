import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { idParam } from '../schemas'
import { notFound } from '../lib/errors'
import { unreadCount } from '../services/notifications'

const router = Router()
router.use(requireAuth)

router.get('/', async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  res.json({ notifications, unreadCount: await unreadCount(req.user.id) })
})

router.patch('/read-all', async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user.id, isRead: false },
    data: { isRead: true },
  })
  res.json({ unreadCount: 0 })
})

router.patch('/:id/read', async (req, res) => {
  const id = idParam.parse(req.params.id)
  const n = await prisma.notification.findFirst({ where: { id, userId: req.user.id } })
  if (!n) throw notFound('Notification not found')

  await prisma.notification.update({ where: { id }, data: { isRead: true } })
  res.json({ unreadCount: await unreadCount(req.user.id) })
})

export default router
