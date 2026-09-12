import ActivityFeed from '../components/ActivityFeed'
import { useAuth } from '../context/AuthContext'

export default function Activity() {
  const { user } = useAuth()
  const scope = user?.role === 'ADMIN' ? 'Everything, across all projects.' : user?.role === 'PROJECT_MANAGER' ? 'Activity on projects you manage.' : 'Activity on tasks assigned to you.'

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Activity</h1>
          <p className="muted">{scope}</p>
        </div>
      </div>
      <section className="card">
        <ActivityFeed limit={20} />
      </section>
    </>
  )
}
