import { Request, Response, NextFunction } from 'express'
import { Role, User } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { verifyAccessToken } from '../lib/jwt'
import { unauthorized, forbidden } from '../lib/errors'

export type AuthUser = Pick<User, 'id' | 'name' | 'email' | 'role'>

declare global {
  namespace Express {
    interface Request {
      user: AuthUser
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return next(unauthorized())
  }

  const payload = verifyAccessToken(header.slice(7))
  if (!payload) {
    return next(unauthorized('Invalid or expired token'))
  }

  // role comes from the db, not the token, so a changed role applies immediately
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, name: true, email: true, role: true },
  })
  if (!user) {
    return next(unauthorized('User no longer exists'))
  }

  req.user = user
  next()
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized())
    if (!roles.includes(req.user.role)) {
      return next(forbidden())
    }
    next()
  }
}
