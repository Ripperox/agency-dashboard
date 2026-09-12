import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import type { Role, User } from '../api/types'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABELS } from '../utils/format'

const ROLES: Role[] = ['ADMIN', 'PROJECT_MANAGER', 'DEVELOPER']

export default function Users() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('DEVELOPER')
  const [error, setError] = useState('')

  const load = () => api.get<{ users: User[] }>('/users').then((d) => setUsers(d.users))

  useEffect(() => {
    load()
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await api.post('/users', { name, email, password, role })
      setName('')
      setEmail('')
      setPassword('')
      load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function changeRole(u: User, newRole: Role) {
    try {
      await api.patch(`/users/${u.id}`, { role: newRole })
      load()
    } catch (err) {
      alert((err as Error).message)
    }
  }

  async function remove(u: User) {
    if (!confirm(`Delete ${u.name}?`)) return
    try {
      await api.delete(`/users/${u.id}`)
      load()
    } catch (err) {
      alert((err as Error).message)
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Users</h1>
      </div>
      <div className="two-col wide-left">
        <section className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.name} {u.id === me?.id && <span className="muted small">(you)</span>}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <select value={u.role} onChange={(e) => changeRole(u, e.target.value as Role)} disabled={u.id === me?.id}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {u.id !== me?.id && (
                      <button className="link-btn danger" onClick={() => remove(u)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card">
          <h2>Add user</h2>
          <form className="form" onSubmit={submit}>
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            </label>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </label>
            <label>
              Role
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
            {error && <p className="error">{error}</p>}
            <button className="btn">Add</button>
          </form>
        </section>
      </div>
    </>
  )
}
