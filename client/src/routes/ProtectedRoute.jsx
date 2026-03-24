import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { LoadingSpinner } from '../components/LoadingSpinner.jsx'

function defaultHomeForRole(role) {
  if (role === 'admin') return '/admin/courses'
  if (role === 'trainee') return '/dashboard'
  return '/'
}

export function ProtectedRoute({ children, roles }) {
  const { user, role, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LoadingSpinner label="Checking session" />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (roles?.length && (!role || !roles.includes(role))) {
    return (
      <Navigate to={defaultHomeForRole(role)} replace state={{ from: location }} />
    )
  }

  return children
}
