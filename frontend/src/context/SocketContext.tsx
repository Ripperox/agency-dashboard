import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'
import { getAccessToken, refreshAccessToken } from '../api/client'

interface SocketState {
  socket: Socket | null
  connected: boolean
}

const SocketContext = createContext<SocketState>({ socket: null, connected: false })

const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL as string | undefined) || undefined

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!user) {
      setSocket(null)
      return
    }

    const s = io(SOCKET_URL, {
      transports: ['websocket'],
      // called on every (re)connect so an expired access token gets swapped for a fresh one
      auth: async (cb) => {
        let token = getAccessToken()
        if (!token) {
          const data = await refreshAccessToken()
          token = data?.accessToken ?? null
        }
        cb({ token })
      },
    })

    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))
    s.on('connect_error', async (err) => {
      // most likely the token expired while we were away, get a new one and let the client retry
      if (err.message === 'unauthorized') await refreshAccessToken()
    })

    setSocket(s)
    return () => {
      s.disconnect()
    }
  }, [user])

  return <SocketContext.Provider value={{ socket, connected }}>{children}</SocketContext.Provider>
}

export function useSocket() {
  return useContext(SocketContext)
}
