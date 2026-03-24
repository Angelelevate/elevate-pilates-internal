import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { api } from '../services/api.js'
import { PasswordInput } from '../components/auth/PasswordInput.jsx'

function homeForRole(role) {
  if (role === 'admin') return '/admin/courses'
  if (role === 'trainee') return '/dashboard'
  return '/'
}

export function ForcedPasswordChangePage() {
  const { user, role, profile, loading, refreshClaims } = useAuth()
  const navigate = useNavigate()
  const [policy, setPolicy] = useState(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data } = await api.get('/api/config/public')
        if (!cancelled) setPolicy(data.passwordPolicy)
      } catch {
        if (!cancelled) setPolicy(null)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (loading) return
    if (!user) {
      navigate('/login', { replace: true })
      return
    }
    if (profile && profile.mustChangePassword !== true) {
      navigate(homeForRole(role), { replace: true })
    }
  }, [loading, user, profile, role, navigate])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api.post('/api/profile/change-password', {
        currentPassword,
        newPassword,
      })
      setCurrentPassword('')
      setNewPassword('')
      const { role: nextRole, profile: nextProfile } = await refreshClaims()
      if (nextProfile?.mustChangePassword === true) {
        setError('Password was updated but your session could not refresh. Try signing out and back in.')
        return
      }
      navigate(homeForRole(nextRole), { replace: true })
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.failures?.[0]?.message ||
        'Could not update password.'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  if (loading || !user || !profile?.mustChangePassword) {
    return <p className="text-sm text-stone-600">Loading…</p>
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-stone-900">
          Choose a new password
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Your administrator created your account with a temporary password. Enter that password
          once, then set a new one you will use from now on.
        </p>
      </div>
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-stone-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-sm"
      >
        <div className="space-y-1">
          <label htmlFor="current" className="text-sm font-medium text-stone-800">
            Current (temporary) password
          </label>
          <input
            id="current"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none ring-deep/30 focus:ring-2"
          />
        </div>
        <PasswordInput
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          policy={policy}
          showPolicy
          autoComplete="new-password"
        />
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-deep py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </div>
  )
}
