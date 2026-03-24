import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { APP_NAME } from '../../utils/constants.js'

export function Header() {
  const { user, signOut, profile } = useAuth()

  return (
    <header className="flex items-center justify-between gap-4 border-b border-stone-200/80 bg-white/70 px-6 py-4 backdrop-blur-md">
      <Link
        to="/"
        className="font-display text-lg font-semibold tracking-tight text-deep"
      >
        {APP_NAME}
      </Link>
      <div className="flex items-center gap-3 text-sm">
        {user ? (
          <>
            <span className="hidden text-stone-600 sm:inline">
              {user.displayName || user.email}
            </span>
            <Link
              to={profile?.mustChangePassword ? '/account/change-password' : '/profile'}
              className="hidden rounded-full border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 sm:inline"
            >
              {profile?.mustChangePassword ? 'Set password' : 'Profile'}
            </Link>
            <button
              type="button"
              className="rounded-full border border-stone-300 px-3 py-1.5 font-medium text-stone-700 transition hover:border-stone-400 hover:bg-stone-50"
              onClick={() => signOut()}
            >
              Log out
            </button>
          </>
        ) : (
          <Link
            to="/login"
            className="rounded-full bg-deep px-4 py-2 font-medium text-white transition hover:opacity-90"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  )
}
