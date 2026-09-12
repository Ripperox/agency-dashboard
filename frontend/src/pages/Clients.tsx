import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import type { Client } from '../api/types'

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const load = () => api.get<{ clients: Client[] }>('/clients').then((d) => setClients(d.clients))

  useEffect(() => {
    load()
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await api.post('/clients', { name, company: company || null, email: email || null })
      setName('')
      setCompany('')
      setEmail('')
      load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function remove(c: Client) {
    if (!confirm(`Delete ${c.name}?`)) return
    try {
      await api.delete(`/clients/${c.id}`)
      load()
    } catch (err) {
      alert((err as Error).message)
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Clients</h1>
      </div>
      <div className="two-col wide-left">
        <section className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Email</th>
                <th>Projects</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.company ?? '—'}</td>
                  <td>{c.email ?? '—'}</td>
                  <td className="mono">{c._count?.projects ?? 0}</td>
                  <td>
                    <button className="link-btn danger" onClick={() => remove(c)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card">
          <h2>Add client</h2>
          <form className="form" onSubmit={submit}>
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            </label>
            <label>
              Company
              <input value={company} onChange={(e) => setCompany(e.target.value)} />
            </label>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="btn">Add</button>
          </form>
        </section>
      </div>
    </>
  )
}
