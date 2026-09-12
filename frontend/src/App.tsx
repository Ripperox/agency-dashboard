import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import Activity from './pages/Activity'
import Clients from './pages/Clients'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import ProjectDetail from './pages/ProjectDetail'
import Projects from './pages/Projects'
import TaskDetail from './pages/TaskDetail'
import Tasks from './pages/Tasks'
import Users from './pages/Users'

function RequireAuth() {
  const { user, loading } = useAuth()
  if (loading) return <p className="muted center">Loading…</p>
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

function RequireAdmin() {
  const { user } = useAuth()
  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />
  return <Outlet />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<RequireAuth />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:id" element={<ProjectDetail />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/tasks/:id" element={<TaskDetail />} />
                <Route path="/activity" element={<Activity />} />
                <Route element={<RequireAdmin />}>
                  <Route path="/clients" element={<Clients />} />
                  <Route path="/users" element={<Users />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
