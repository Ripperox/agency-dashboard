import { describe, it, expect } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app, loginAs, auth } from './helpers'

describe('auth', () => {
  it('rejects a bad password with a structured error', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@agency.com', password: 'nope' })
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } })
  })

  it('validates the login body', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain('email')
  })

  it('sets the refresh token as an httpOnly cookie, not in the body', async () => {
    const { cookie } = await loginAs('ravi')
    const refresh = cookie.find((c) => c.startsWith('refresh_token='))
    expect(refresh).toBeDefined()
    expect(refresh).toMatch(/HttpOnly/i)
    expect(refresh).toMatch(/Path=\/api\/auth/)
  })

  it('refresh rotates the token and the old one stops working', async () => {
    const { cookie } = await loginAs('ravi')
    const first = await request(app).post('/api/auth/refresh').set('Cookie', cookie)
    expect(first.status).toBe(200)
    expect(first.body.accessToken).toBeTruthy()

    const replay = await request(app).post('/api/auth/refresh').set('Cookie', cookie)
    expect(replay.status).toBe(401)
  })

  it('rejects a token signed with the wrong secret even if the role says admin', async () => {
    const forged = jwt.sign({ sub: '1', role: 'ADMIN' }, 'not-the-real-secret', { expiresIn: '15m' })
    const res = await request(app).get('/api/users').set(auth(forged))
    expect(res.status).toBe(401)
  })

  it('rejects requests without a token', async () => {
    const res = await request(app).get('/api/projects')
    expect(res.status).toBe(401)
  })

  it('logout revokes the refresh token', async () => {
    const { cookie } = await loginAs('sneha')
    await request(app).post('/api/auth/logout').set('Cookie', cookie)
    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie)
    expect(res.status).toBe(401)
  })
})
