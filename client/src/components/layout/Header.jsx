import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { useToast } from '../../contexts/ToastContext.jsx'
import { APP_NAME } from '../../utils/constants.js'

function MenuIcon({ open }) {
  if (open) {
    return (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    )
  }
  return (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

export function Header({ mobileNavOpen = false, onMobileNavToggle }) {
  const { user, signOut, profile } = useAuth()
  const { showToast } = useToast()

  async function handleSignOut() {
    try {
      await signOut()
      showToast({ variant: 'success', message: 'You are signed out. See you soon.' })
    } catch {
      showToast({ variant: 'error', message: 'Could not sign out. Try again.' })
    }
  }

  return (
    <header className="relative z-50 flex items-center justify-between gap-2 border-b border-stone-200/60 bg-white/80 px-3 py-3 backdrop-blur-xl transition-shadow duration-300 ease-soft sm:gap-4 sm:px-5 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-clay/20 to-transparent" />

      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5 md:flex-none">
        {onMobileNavToggle ? (
          <button
            type="button"
            className="ui-press -ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200/80 bg-white/90 text-stone-700 shadow-warm-sm md:hidden"
            onClick={onMobileNavToggle}
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-navigation"
            aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
          >
            <MenuIcon open={mobileNavOpen} />
          </button>
        ) : null}
        <Link
          to="/"
          className="ui-press group flex min-w-0 items-center gap-2 sm:gap-2.5"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-deep text-xs font-bold text-white shadow-warm-sm transition-shadow duration-200 group-hover:shadow-warm">
            EP
          </span>
          <span className="truncate font-display text-base font-semibold tracking-tight text-deep sm:text-lg">
            {APP_NAME}
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-2 text-sm">
        {user ? (
          <>
            <span className="hidden max-w-[200px] truncate text-stone-500 lg:inline" title={user.email}>
              {(() => {
                const fromProfile =
                  profile?.firstName || profile?.lastName
                    ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim()
                    : ''
                return fromProfile || user.displayName?.trim() || user.email || 'Account'
              })()}
            </span>
            <Link
              to={profile?.mustChangePassword ? '/account/change-password' : '/profile'}
              className="ui-btn-secondary hidden !px-3 !py-1.5 !text-xs sm:inline-flex"
            >
              {profile?.mustChangePassword ? 'Set password' : 'Profile'}
            </Link>
            <button
              type="button"
              className="ui-btn-secondary !px-3 !py-1.5 !text-xs"
              onClick={handleSignOut}
            >
              Log out
            </button>
          </>
        ) : (
          <Link to="/login" className="ui-btn-primary !px-4 !py-1.5 !text-xs">
            Sign in
          </Link>
        )}
      </div>
    </header>
  )
}
