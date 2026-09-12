import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '../api/types'
import { api, setAccessToken, refreshAccessToken, setOnAuthFail } from '../api/client'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // on first load try to get a fresh access token from the refresh cookie
  useEffect(() => {
    refreshAccessToken()
      .then((data) => setUser(data ? data.user : null))
      .finally(() => setLoading(false))

    setOnAuthFail(() => {
      setAccessToken(null)
      setUser(null)
    })
  }, [])

  async function login(email: string, password: string) {
    const data = await api.post<{ accessToken: string; user: User }>('/auth/login', { email, password })
    setAccessToken(data.accessToken)
    setUser(data.user)
  }

  async function logout() {
    await api.post('/auth/logout').catch(() => {})
    setAccessToken(null)
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
