import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Client, Project } from '../api/types'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'

export default function Projects() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [creating, setCreating] = useState(false)

  const load = () => api.get<{ projects: Project[] }>('/projects').then((d) => setProjects(d.projects))

  useEffect(() => {
    load()
  }, [])

  const canCreate = user?.role === 'ADMIN' || user?.role === 'PROJECT_MANAGER'

  return (
    <>
      <div className="page-head">
        <h1>Projects</h1>
        {canCreate && (
          <button className="btn" onClick={() => setCreating(true)}>
            New project
          </button>
        )}
      </div>
      {user?.role === 'DEVELOPER' && <p className="muted">Projects you have tasks in.</p>}
      {projects.length === 0 && <p className="muted">No projects yet.</p>}
      <div className="project-grid">
        {projects.map((p) => (
          <Link key={p.id} to={`/projects/${p.id}`} className="card project-card">
            <h3>{p.name}</h3>
            <p className="muted small">{p.client.name}</p>
            {p.description && <p className="desc">{p.description}</p>}
            <div className="card-foot muted small">
              <span>{p._count.tasks} tasks</span>
              <span>PM: {p.owner.name}</span>
            </div>
          </Link>
        ))}
      </div>
      {creating && <ProjectForm onClose={() => setCreating(false)} onSaved={load} />}
    </>
  )
}

export function ProjectForm({ project, onClose, onSaved }: { project?: Project; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [clientId, setClientId] = useState(project ? String(project.clientId) : '')
  const [clients, setClients] = useState<Client[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<{ clients: Client[] }>('/clients').then((d) => setClients(d.clients))
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const body = { name, description: description || null, clientId: Number(clientId) }
      if (project) await api.patch(`/projects/${project.id}`, body)
      else await api.post('/projects', body)
      onSaved()
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <Modal title={project ? 'Edit project' : 'New project'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </label>
        <label>
          Client
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
            <option value="">Pick a client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn">{project ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </Modal>
  )
}
