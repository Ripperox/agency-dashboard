import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { Role } from '@prisma/client'
import { config } from '../config'

export interface AccessPayload {
  sub: number
  role: Role
}

export function signAccessToken(userId: number, role: Role) {
  return jwt.sign({ sub: String(userId), role }, config.accessSecret, {
    expiresIn: config.accessTtl as jwt.SignOptions['expiresIn'],
  })
}

export function verifyAccessToken(token: string): AccessPayload | null {
  try {
    const decoded = jwt.verify(token, config.accessSecret) as jwt.JwtPayload
    if (!decoded.sub) return null
    return { sub: Number(decoded.sub), role: decoded.role as Role }
  } catch {
    return null
  }
}

// refresh tokens are random strings, we only store the hash in the db
export function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex')
}

export function hashToken(token: string) {
  return crypto.createHmac('sha256', config.refreshSecret).update(token).digest('hex')
}
