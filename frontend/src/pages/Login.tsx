import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const DEMO = [
  ['Admin', 'admin@agency.com'],
  ['Project Manager', 'rahul@agency.com'],
  ['Project Manager', 'priya@agency.com'],
  ['Developer', 'ravi@agency.com'],
  ['Developer', 'sneha@agency.com'],
]

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="brand big">
          <span className="brand-dot" />
          Agency Board
        </div>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="demo-accounts">
          <p className="muted small">Demo accounts (password is <code>password123</code>)</p>
          {DEMO.map(([role, mail]) => (
            <button
              type="button"
              key={mail}
              className="demo-btn"
              onClick={() => {
                setEmail(mail)
                setPassword('password123')
              }}
            >
              <span>{role}</span>
              <code>{mail}</code>
            </button>
          ))}
        </div>
      </form>
    </div>
  )
}
