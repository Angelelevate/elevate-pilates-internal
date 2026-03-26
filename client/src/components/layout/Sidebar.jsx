import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.jsx'

function NavIcon({ name }) {
  const icons = {
    home: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
      </svg>
    ),
    courses: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    users: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    dashboard: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2zM14 13a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5z" />
      </svg>
    ),
    profile: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    password: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  }
  return icons[name] || null
}

const asideClass =
  'flex w-[min(18rem,88vw)] shrink-0 flex-col border-r border-stone-200/60 bg-gradient-to-b from-white/95 via-white/80 to-stone-50/50 p-4 shadow-warm-md backdrop-blur-sm md:w-56 md:from-white/70 md:via-white/50 md:to-stone-50/40 md:shadow-none'

function SidebarNav({ onNavigate }) {
  const { user, role, profile } = useAuth()

  const links = [{ to: '/', label: 'Home', icon: 'home' }]

  if (user && role === 'admin') {
    links.push(
      { to: '/admin/courses', label: 'Courses', icon: 'courses' },
      { to: '/admin/users', label: 'Users', icon: 'users' },
    )
  } else if (user && role === 'trainee') {
    if (profile?.mustChangePassword === true) {
      links.push({ to: '/account/change-password', label: 'Set new password', icon: 'password' })
    } else {
      links.push({ to: '/dashboard', label: 'My courses', icon: 'dashboard' })
    }
  }

  return (
    <>
      <nav className="flex flex-col gap-0.5 text-sm" aria-label="Main">
        <p className="ui-section-label mb-2 px-3">Navigation</p>
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={`${to}-${label}`}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              [
                'flex items-center gap-2.5 rounded-xl px-3 py-2 font-medium transition-[background-color,color,transform,box-shadow] duration-200 ease-soft motion-reduce:transition-colors',
                isActive
                  ? 'bg-deep text-white shadow-warm-sm'
                  : 'text-stone-600 hover:bg-stone-100/80 hover:text-stone-900 motion-safe:hover:translate-x-0.5 motion-reduce:hover:translate-x-0',
              ].join(' ')
            }
            end={to === '/'}
          >
            <NavIcon name={icon} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-6">
        <div className="ui-divider" />
        {!user ? (
          <p className="mt-4 px-3 text-xs leading-relaxed text-stone-400">
            Sign in to access your learning workspace.
          </p>
        ) : (
          <div className="mt-4 rounded-xl bg-clay-50/60 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-clay-600">Elevate Pilates</p>
            <p className="mt-0.5 text-[11px] text-clay-500">Professional training platform</p>
          </div>
        )}
      </div>
    </>
  )
}

export function Sidebar({ mobileNavOpen = false, onCloseMobileNav }) {
  useEffect(() => {
    if (!mobileNavOpen || !onCloseMobileNav) return
    function onKeyDown(e) {
      if (e.key === 'Escape') onCloseMobileNav()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mobileNavOpen, onCloseMobileNav])

  return (
    <>
      <div
        className={[
          'fixed inset-0 z-40 md:hidden',
          mobileNavOpen ? 'pointer-events-auto' : 'pointer-events-none',
        ].join(' ')}
        aria-hidden={!mobileNavOpen}
      >
        <button
          type="button"
          className={[
            'absolute inset-0 bg-stone-900/45 backdrop-blur-[2px] transition-opacity duration-200 ease-soft motion-reduce:transition-none',
            mobileNavOpen ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          onClick={onCloseMobileNav}
          tabIndex={mobileNavOpen ? 0 : -1}
          aria-label="Close menu"
        />
        <aside
          id="mobile-navigation"
          className={[
            asideClass,
            /* Below header (z-50): header is py-3 + h-10 row ≈ 4rem */
            'absolute bottom-0 left-0 top-16 overflow-y-auto transition-transform duration-200 ease-soft motion-reduce:transition-none md:hidden',
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full',
          ].join(' ')}
          aria-hidden={!mobileNavOpen}
          inert={!mobileNavOpen}
        >
          <SidebarNav onNavigate={onCloseMobileNav} />
        </aside>
      </div>

      <aside className={`${asideClass} hidden md:flex`} aria-label="Main navigation">
        <SidebarNav />
      </aside>
    </>
  )
}
