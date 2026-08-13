import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { api } from '../services/api.js'
import { PasswordInput } from '../components/auth/PasswordInput.jsx'
import { LoadingSpinner } from '../components/LoadingSpinner.jsx'

function homeForRole() {
  return '/'
}

export function ForcedPasswordChangePage() {
  const { user, role, profile, loading, refreshClaims } = useAuth()
  const { showToast } = useToast()
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
      navigate(homeForRole(), { replace: true })
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
      const { profile: nextProfile } = await refreshClaims()
      if (nextProfile?.mustChangePassword === true) {
        setError('Password was updated but your session could not refresh. Try signing out and back in.')
        return
      }
      showToast({ variant: 'success', message: 'Password updated. Welcome in!' })
      navigate(homeForRole(), { replace: true })
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
    return <LoadingSpinner label="Loading your account" />
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-4">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-deep text-lg font-bold text-white shadow-warm">
        EP
      </div>
      <div className="w-full text-center">
        <h1 className="font-display text-2xl font-semibold text-stone-900">
          Choose a new password
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Your administrator created your account with a temporary password. Enter that password
          once, then set a new one you will use from now on.
        </p>
      </div>
      <form
        onSubmit={onSubmit}
        className="ui-surface mt-6 w-full space-y-5 p-7"
      >
        <PasswordInput
          label="Current (temporary) password"
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
        />
        <PasswordInput
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          policy={policy}
          showPolicy
          autoComplete="new-password"
        />
        {error ? (
          <p
            className="motion-safe:animate-in-up motion-reduce:animate-none rounded-xl bg-red-50/90 px-4 py-2.5 text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="ui-btn-primary w-full"
        >
          {busy ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </div>
  )
}
