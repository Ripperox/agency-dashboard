import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { config } from '../config'
import { signAccessToken, generateRefreshToken, hashToken } from '../lib/jwt'
import { unauthorized } from '../lib/errors'
import { validateBody } from '../middleware/validate'
import { requireAuth } from '../middleware/auth'
import { loginSchema } from '../schemas'

const router = Router()

const COOKIE_NAME = 'refresh_token'

const cookieOptions = {
  httpOnly: true,
  secure: config.isProd,
  sameSite: 'lax' as const,
  path: '/api/auth',
  maxAge: config.refreshDays * 24 * 60 * 60 * 1000,
}

async function issueRefreshToken(userId: number, res: Response) {
  const token = generateRefreshToken()
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + cookieOptions.maxAge),
    },
  })
  res.cookie(COOKIE_NAME, token, cookieOptions)
}

function publicUser(u: { id: number; name: string; email: string; role: string }) {
  return { id: u.id, name: u.name, email: u.email, role: u.role }
}

router.post('/login', validateBody(loginSchema), async (req: Request, res: Response) => {
  const { email, password } = req.body
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })

  // same message either way so we don't leak which emails exist
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw unauthorized('Invalid email or password')
  }

  await issueRefreshToken(user.id, res)
  res.json({ accessToken: signAccessToken(user.id, user.role), user: publicUser(user) })
})

router.post('/refresh', async (req: Request, res: Response) => {
  const raw = req.cookies?.[COOKIE_NAME] as string | undefined
  if (!raw) throw unauthorized('No refresh token')

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: true },
  })

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    res.clearCookie(COOKIE_NAME, { path: cookieOptions.path })
    throw unauthorized('Refresh token expired')
  }

  // rotate: old one is dead, new one goes out
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } })
  await issueRefreshToken(stored.userId, res)

  res.json({ accessToken: signAccessToken(stored.user.id, stored.user.role), user: publicUser(stored.user) })
})

router.post('/logout', async (req: Request, res: Response) => {
  const raw = req.cookies?.[COOKIE_NAME] as string | undefined
  if (raw) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(raw), revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }
  res.clearCookie(COOKIE_NAME, { path: cookieOptions.path })
  res.json({ ok: true })
})

router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.user })
})

export default router
