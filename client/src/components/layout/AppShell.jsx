import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { Header } from './Header.jsx'
import { Sidebar } from './Sidebar.jsx'
import { Footer } from './Footer.jsx'

export function AppShell() {
  const { user, profile, loading } = useAuth()
  const location = useLocation()
  const onForcedPasswordPage = location.pathname === '/account/change-password'
  const mustChange = Boolean(user && profile?.mustChangePassword === true)
  if (!loading && mustChange && !onForcedPasswordPage) {
    return <Navigate to="/account/change-password" replace />
  }

  return (
    <div className="flex min-h-svh flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-auto px-6 py-8">
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  )
}
