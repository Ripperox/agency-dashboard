import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { onlineCount } from '../socket'

const router = Router()
router.use(requireAuth)

router.get('/', async (req, res) => {
  const user = req.user

  if (user.role === 'ADMIN') {
    const [totalProjects, byStatus, overdueCount, totalUsers] = await Promise.all([
      prisma.project.count(),
      prisma.task.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.task.count({ where: { isOverdue: true } }),
      prisma.user.count(),
    ])

    const tasksByStatus = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 }
    for (const row of byStatus) tasksByStatus[row.status] = row._count._all

    return res.json({
      role: 'ADMIN',
      totalProjects,
      totalTasks: Object.values(tasksByStatus).reduce((a, b) => a + b, 0),
      tasksByStatus,
      overdueCount,
      totalUsers,
      onlineCount: onlineCount(),
    })
  }

  if (user.role === 'PROJECT_MANAGER') {
    const projects = await prisma.project.findMany({
      where: { ownerId: user.id },
      include: {
        client: { select: { name: true } },
        tasks: { select: { status: true, priority: true, isOverdue: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const tasksByPriority = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }
    for (const p of projects) for (const t of p.tasks) tasksByPriority[t.priority]++

    const now = new Date()
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const upcoming = await prisma.task.findMany({
      where: {
        project: { ownerId: user.id },
        status: { not: 'DONE' },
        dueDate: { gte: now, lte: weekAhead },
      },
      include: { assignee: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } },
      orderBy: { dueDate: 'asc' },
    })

    return res.json({
      role: 'PROJECT_MANAGER',
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        client: p.client.name,
        total: p.tasks.length,
        done: p.tasks.filter((t) => t.status === 'DONE').length,
        overdue: p.tasks.filter((t) => t.isOverdue).length,
      })),
      tasksByPriority,
      upcoming,
    })
  }

  const tasks = await prisma.task.findMany({
    where: { assigneeId: user.id },
    include: { project: { select: { id: true, name: true } } },
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
  })

  res.json({
    role: 'DEVELOPER',
    tasks,
    open: tasks.filter((t) => t.status !== 'DONE').length,
    overdue: tasks.filter((t) => t.isOverdue).length,
  })
})

export default router
