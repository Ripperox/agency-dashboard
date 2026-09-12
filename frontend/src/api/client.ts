// access token lives in memory only. refresh token is an httpOnly cookie the browser sends on /api/auth/*
let accessToken: string | null = null
let onAuthFail: (() => void) | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

export function setOnAuthFail(cb: () => void) {
  onAuthFail = cb
}

export class ApiError extends Error {
  status: number
  code: string
  details?: { path: string; message: string }[]

  constructor(status: number, code: string, message: string, details?: { path: string; message: string }[]) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export async function refreshAccessToken(): Promise<{ accessToken: string; user: import('./types').User } | null> {
  const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
  if (!res.ok) return null
  const data = await res.json()
  accessToken = data.accessToken
  return data
}

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (accessToken) headers['authorization'] = `Bearer ${accessToken}`

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    const refreshed = await refreshAccessToken()
    if (refreshed) return request<T>(method, path, body, false)
    onAuthFail?.()
  }

  if (res.status === 204) return undefined as T

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = data?.error || {}
    throw new ApiError(res.status, err.code || 'ERROR', err.message || 'Request failed', err.details)
  }
  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
