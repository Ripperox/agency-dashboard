import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { validateQuery, getQuery } from '../middleware/validate'
import { activityQuerySchema } from '../schemas'
import { activityWhereForUser } from '../services/access'
import { activityInclude } from '../services/activity'

const router = Router()
router.use(requireAuth)

type Query = { limit: number; before?: number; after?: number; projectId?: number }

// same query serves the initial load, "load more" (before=id) and catch-up after a reconnect (after=id)
router.get('/', validateQuery(activityQuerySchema), async (req, res) => {
  const { limit, before, after, projectId } = getQuery<Query>(req)

  const activity = await prisma.activityLog.findMany({
    where: {
      AND: [
        activityWhereForUser(req.user),
        projectId ? { projectId } : {},
        before ? { id: { lt: before } } : {},
        after ? { id: { gt: after } } : {},
      ],
    },
    include: activityInclude,
    orderBy: { id: 'desc' },
    take: limit,
  })

  res.json({ activity })
})

export default router
