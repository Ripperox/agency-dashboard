import request from 'supertest'
import { createApp } from '../src/app'

export const app = createApp()

export async function loginAs(name: string) {
  const res = await request(app).post('/api/auth/login').send({ email: `${name}@agency.com`, password: 'password123' })
  if (res.status !== 200) throw new Error(`login failed for ${name}: ${res.status}`)
  const cookie = res.headers['set-cookie']
  return { token: res.body.accessToken as string, cookie: (Array.isArray(cookie) ? cookie : [cookie]) as string[], user: res.body.user }
}

export const auth = (token: string) => ({ authorization: `Bearer ${token}` })
