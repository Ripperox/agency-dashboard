import cron from 'node-cron'
import { prisma } from '../lib/prisma'
import { logActivity } from '../services/activity'

// runs every minute. tasks past due that aren't done get flagged once and an activity row is written
export async function flagOverdueTasks() {
  const tasks = await prisma.task.findMany({
    where: {
      isOverdue: false,
      status: { not: 'DONE' },
      dueDate: { lt: new Date() },
    },
    select: { id: true, projectId: true, title: true },
  })

  for (const task of tasks) {
    await prisma.task.update({ where: { id: task.id }, data: { isOverdue: true } })
    await logActivity({ type: 'TASK_OVERDUE', taskId: task.id, projectId: task.projectId, actorId: null, toValue: task.title })
  }

  if (tasks.length > 0) {
    console.log(`[overdue job] flagged ${tasks.length} task(s)`)
  }
  return tasks.length
}

export function startOverdueJob() {
  cron.schedule('* * * * *', () => {
    flagOverdueTasks().catch((err) => console.error('[overdue job] failed', err))
  })
  // also run once on boot so a restart doesn't leave stale tasks unflagged for a minute
  flagOverdueTasks().catch((err) => console.error('[overdue job] failed', err))
}
