import { Server as HttpServer } from 'http'
import { Server, Socket } from 'socket.io'
import { prisma } from '../lib/prisma'
import { verifyAccessToken } from '../lib/jwt'
import { config } from '../config'
import { AuthUser } from '../middleware/auth'

let io: Server

// userId -> set of socket ids, so one user with two tabs still counts once
const online = new Map<number, Set<string>>()

export function initSocket(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: config.clientOrigin, credentials: true },
    transports: ['websocket'],
  })

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined
    const payload = token ? verifyAccessToken(token) : null
    if (!payload) return next(new Error('unauthorized'))

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true },
    })
    if (!user) return next(new Error('unauthorized'))

    socket.data.user = user
    next()
  })

  io.on('connection', (socket) => {
    const user = socket.data.user as AuthUser

    socket.join(`user:${user.id}`)
    if (user.role === 'ADMIN') socket.join('admins')

    trackOnline(user.id, socket)
    sendPresence()

    socket.on('disconnect', () => {
      untrackOnline(user.id, socket)
      sendPresence()
    })
  })

  return io
}

function trackOnline(userId: number, socket: Socket) {
  if (!online.has(userId)) online.set(userId, new Set())
  online.get(userId)!.add(socket.id)
}

function untrackOnline(userId: number, socket: Socket) {
  const sockets = online.get(userId)
  if (!sockets) return
  sockets.delete(socket.id)
  if (sockets.size === 0) online.delete(userId)
}

export function onlineCount() {
  return online.size
}

function sendPresence() {
  // only the admin dashboard shows this number
  io.to('admins').emit('presence:count', { count: online.size })
}

export function getIo() {
  if (!io) throw new Error('socket.io not initialised')
  return io
}

export function emitToUser(userId: number, event: string, payload: unknown) {
  if (!io) return
  io.to(`user:${userId}`).emit(event, payload)
}

// figure out who is allowed to see an activity item and emit to exactly those rooms.
// socket.io dedupes if a socket is in more than one of the rooms.
export function emitActivity(payload: { projectOwnerId: number; assigneeId: number | null; [k: string]: unknown }) {
  if (!io) return
  const rooms = ['admins', `user:${payload.projectOwnerId}`]
  if (payload.assigneeId) rooms.push(`user:${payload.assigneeId}`)
  io.to(rooms).emit('activity:new', payload)
}
