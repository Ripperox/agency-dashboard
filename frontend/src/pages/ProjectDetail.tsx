import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Activity, Project, Task } from '../api/types'
import ActivityFeed from '../components/ActivityFeed'
import TaskFilters from '../components/TaskFilters'
import TaskForm from '../components/TaskForm'
import TaskTable from '../components/TaskTable'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { ProjectForm } from './Projects'

export default function ProjectDetail() {
  const { id } = useParams()
  const projectId = Number(id)
  const { user } = useAuth()
  const { socket } = useSocket()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Task | null | 'new'>(null)
  const [editingProject, setEditingProject] = useState(false)

  const loadProject = useCallback(() => {
    api
      .get<{ project: Project }>(`/projects/${projectId}`)
      .then((d) => setProject(d.project))
      .catch((e) => setError(e.message))
  }, [projectId])

  const loadTasks = useCallback(() => {
    const qs = new URLSearchParams(params)
    qs.set('projectId', String(projectId))
    api.get<{ tasks: Task[] }>(`/tasks?${qs}`).then((d) => setTasks(d.tasks))
  }, [projectId, params])

  useEffect(() => {
    loadProject()
  }, [loadProject])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  // someone else changed something in this project, pull the fresh list
  useEffect(() => {
    if (!socket) return
    const onActivity = (a: Activity) => {
      if (a.projectId === projectId) loadTasks()
    }
    socket.on('activity:new', onActivity)
    return () => {
      socket.off('activity:new', onActivity)
    }
  }, [socket, projectId, loadTasks])

  if (error) return <p className="error">{error}</p>
  if (!project) return <p className="muted">Loading…</p>

  const canManage = user?.role === 'ADMIN' || (user?.role === 'PROJECT_MANAGER' && project.ownerId === user.id)

  async function removeProject() {
    if (!confirm('Delete this project and all its tasks?')) return
    await api.delete(`/projects/${projectId}`)
    navigate('/projects')
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="crumb muted">
            <Link to="/projects">Projects</Link> / {project.client.name}
          </p>
          <h1>{project.name}</h1>
          {project.description && <p className="muted">{project.description}</p>}
          <p className="muted small">Managed by {project.owner.name}</p>
        </div>
        {canManage && (
          <div className="btn-row">
            <button className="btn ghost" onClick={() => setEditingProject(true)}>
              Edit
            </button>
            <button className="btn ghost danger" onClick={removeProject}>
              Delete
            </button>
            <button className="btn" onClick={() => setEditing('new')}>
              New task
            </button>
          </div>
        )}
      </div>

      <div className="two-col wide-left">
        <section className="card">
          <h2>Tasks</h2>
          <TaskFilters />
          <TaskTable tasks={tasks} onChanged={loadTasks} onEdit={canManage ? (t) => setEditing(t) : undefined} />
        </section>
        <section className="card">
          <h2>Activity</h2>
          <ActivityFeed projectId={projectId} />
        </section>
      </div>

      {editing && (
        <TaskForm
          projectId={projectId}
          task={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={loadTasks}
        />
      )}
      {editingProject && <ProjectForm project={project} onClose={() => setEditingProject(false)} onSaved={loadProject} />}
    </>
  )
}
