import { NotificationType } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { emitToUser } from '../socket'

export async function notify(userId: number, type: NotificationType, message: string, taskId?: number) {
  const notification = await prisma.notification.create({
    data: { userId, type, message, taskId: taskId ?? null },
  })

  const unreadCount = await prisma.notification.count({ where: { userId, isRead: false } })
  emitToUser(userId, 'notification:new', { notification, unreadCount })

  return notification
}

export async function unreadCount(userId: number) {
  return prisma.notification.count({ where: { userId, isRead: false } })
}
