import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Task } from '../api/types'
import TaskFilters from '../components/TaskFilters'
import TaskTable from '../components/TaskTable'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'

export default function Tasks() {
  const { user } = useAuth()
  const { socket } = useSocket()
  const [params] = useSearchParams()
  const [tasks, setTasks] = useState<Task[]>([])

  const load = useCallback(() => {
    api.get<{ tasks: Task[] }>(`/tasks?${params}`).then((d) => setTasks(d.tasks))
  }, [params])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!socket) return
    socket.on('activity:new', load)
    return () => {
      socket.off('activity:new', load)
    }
  }, [socket, load])

  const title = user?.role === 'DEVELOPER' ? 'My tasks' : user?.role === 'PROJECT_MANAGER' ? 'Tasks on my projects' : 'All tasks'

  return (
    <>
      <div className="page-head">
        <h1>{title}</h1>
      </div>
      <section className="card">
        <TaskFilters />
        <TaskTable tasks={tasks} showProject onChanged={load} />
      </section>
    </>
  )
}
