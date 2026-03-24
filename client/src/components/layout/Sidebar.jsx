import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.jsx'

export function Sidebar() {
  const { user, role, profile } = useAuth()

  const links = [{ to: '/', label: 'Home' }]

  if (user && role === 'admin') {
    links.push(
      { to: '/admin/courses', label: 'Courses' },
      { to: '/admin/users', label: 'Users' },
      { to: '/profile', label: 'Profile' },
    )
  } else if (user && role === 'trainee') {
    if (profile?.mustChangePassword === true) {
      links.push({ to: '/account/change-password', label: 'Set new password' })
    } else {
      links.push(
        { to: '/dashboard', label: 'My course' },
        { to: '/profile', label: 'Profile' },
      )
    }
  } else if (user) {
    links.push({ to: '/profile', label: 'Profile' })
  }

  return (
    <aside className="hidden w-52 shrink-0 border-r border-stone-200/80 bg-white/50 p-4 backdrop-blur-sm md:block">
      <nav className="flex flex-col gap-1 text-sm">
        {links.map(({ to, label }) => (
          <NavLink
            key={`${to}-${label}`}
            to={to}
            className={({ isActive }) =>
              [
                'rounded-lg px-3 py-2 font-medium transition',
                isActive
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
              ].join(' ')
            }
            end={to === '/'}
          >
            {label}
          </NavLink>
        ))}
      </nav>
      {!user ? (
        <p className="mt-6 px-3 text-xs leading-relaxed text-stone-400">
          Sign in to access your learning workspace.
        </p>
      ) : null}
    </aside>
  )
}
