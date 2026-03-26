import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { Header } from './Header.jsx'
import { Sidebar } from './Sidebar.jsx'
import { Footer } from './Footer.jsx'

export function AppShell() {
  const { user, profile, loading } = useAuth()
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileNavOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [mobileNavOpen])

  const onForcedPasswordPage = location.pathname === '/account/change-password'
  const mustChange = Boolean(user && profile?.mustChangePassword === true)
  if (!loading && mustChange && !onForcedPasswordPage) {
    return <Navigate to="/account/change-password" replace />
  }

  return (
    <div className="flex min-h-svh flex-col">
      <Header
        mobileNavOpen={mobileNavOpen}
        onMobileNavToggle={() => setMobileNavOpen((open) => !open)}
      />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          mobileNavOpen={mobileNavOpen}
          onCloseMobileNav={() => setMobileNavOpen(false)}
        />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-5 sm:px-5 sm:py-6 lg:px-10 lg:py-8">
          <div
            key={location.pathname}
            className="mx-auto max-w-6xl motion-safe:animate-page-enter motion-reduce:animate-none"
          >
            <Outlet />
          </div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
