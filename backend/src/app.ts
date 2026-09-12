import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { config } from './config'
import { errorHandler, notFound } from './lib/errors'
import authRoutes from './routes/auth'
import userRoutes from './routes/users'
import clientRoutes from './routes/clients'
import projectRoutes from './routes/projects'
import taskRoutes from './routes/tasks'
import activityRoutes from './routes/activity'
import notificationRoutes from './routes/notifications'
import dashboardRoutes from './routes/dashboard'

export function createApp() {
  const app = express()

  if (config.isProd) app.set('trust proxy', 1)
  app.disable('x-powered-by')

  app.use(cors({ origin: config.clientOrigin, credentials: true }))
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())

  app.get('/api/health', (_req, res) => res.json({ ok: true }))

  app.use('/api/auth', authRoutes)
  app.use('/api/users', userRoutes)
  app.use('/api/clients', clientRoutes)
  app.use('/api/projects', projectRoutes)
  app.use('/api/tasks', taskRoutes)
  app.use('/api/activity', activityRoutes)
  app.use('/api/notifications', notificationRoutes)
  app.use('/api/dashboard', dashboardRoutes)

  app.use((_req, _res, next) => next(notFound('Route not found')))
  app.use(errorHandler)

  return app
}
