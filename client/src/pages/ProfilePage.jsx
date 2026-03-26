import { useEffect, useState } from 'react'
import { api } from '../services/api.js'
import { useToast } from '../contexts/ToastContext.jsx'
import { PasswordInput } from '../components/auth/PasswordInput.jsx'
import { LoadingSpinner } from '../components/LoadingSpinner.jsx'

const MAX_NAME_CHARS = 100

export function ProfilePage() {
  const { showToast } = useToast()
  const [profile, setProfile] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [policy, setPolicy] = useState(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [me, pub] = await Promise.all([
          api.get('/api/profile'),
          api.get('/api/config/public'),
        ])
        if (cancelled) return
        setPolicy(pub.data.passwordPolicy)
        const p = me.data.profile
        setProfile(p)
        if (p) {
          setFirstName(p.firstName || '')
          setLastName(p.lastName || '')
          setPhone(p.phone || '')
        }
      } catch {
        if (!cancelled) setError('Could not load profile.')
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function saveProfile(e) {
    e.preventDefault()
    setMessage('')
    setError('')
    if (!firstName.trim() || !lastName.trim()) {
      const msg = 'First and last name are required.'
      setError(msg)
      showToast({ variant: 'error', message: msg })
      return
    }
    setSavingProfile(true)
    try {
      const { data } = await api.patch('/api/profile', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() ? phone.trim() : null,
      })
      setProfile(data)
      setMessage('Profile saved.')
      showToast({ variant: 'success', message: 'Profile saved.' })
    } catch (err) {
      const msg = err.response?.data?.error || 'Save failed.'
      setError(msg)
      showToast({ variant: 'error', message: msg })
    } finally {
      setSavingProfile(false)
    }
  }

  async function changePassword(e) {
    e.preventDefault()
    setMessage('')
    setError('')
    setChangingPassword(true)
    try {
      await api.post('/api/profile/change-password', {
        currentPassword,
        newPassword,
      })
      setCurrentPassword('')
      setNewPassword('')
      setMessage('Password updated.')
      showToast({ variant: 'success', message: 'Password updated.' })
    } catch (err) {
      const msg =
        err.response?.data?.failures?.[0]?.message ||
        err.response?.data?.error ||
        'Password change failed.'
      setError(msg)
      showToast({ variant: 'error', message: msg })
    } finally {
      setChangingPassword(false)
    }
  }

  if (!loaded) {
    return <LoadingSpinner label="Loading profile" />
  }

  if (!profile) {
    return (
      <div className="ui-surface p-8">
        <h1 className="font-display text-2xl font-semibold text-stone-900">Profile</h1>
        <p className="mt-2 text-sm text-stone-600">
          No profile document exists for this account yet. Trainee profiles are created when an admin
          adds you under Users or when you complete an invite link.
        </p>
        {error ? (
          <p
            className="motion-safe:animate-in-up motion-reduce:animate-none mt-4 rounded-xl bg-red-50/90 px-4 py-2.5 text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-stone-900">Profile</h1>
          <p className="mt-1 text-sm text-stone-500">Update your details and password.</p>
        </div>

        <form onSubmit={saveProfile} className="ui-surface space-y-5 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" className="text-sage">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Contact
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700">First name</label>
              <input
                required
                maxLength={MAX_NAME_CHARS}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="ui-input w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700">Last name</label>
              <input
                required
                maxLength={MAX_NAME_CHARS}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="ui-input w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">Phone</label>
            <input
              value={phone}
              inputMode="tel"
              autoComplete="tel"
              onChange={(e) => setPhone(e.target.value.replace(/[^\d+().\-\s]/g, ''))}
              className="ui-input w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
            />
          </div>
          <button type="submit" disabled={savingProfile} className="ui-btn-primary">
            {savingProfile ? 'Saving…' : 'Save profile'}
          </button>
        </form>

        <form onSubmit={changePassword} className="ui-surface space-y-5 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" className="text-clay">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Change password
          </h2>
          <PasswordInput
            label="Current password"
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
          <button type="submit" disabled={changingPassword} className="ui-btn-primary !bg-stone-900">
            {changingPassword ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>

      <div className="space-y-4">
        <div className="ui-surface p-5">
          <p className="ui-section-label">Account</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-deep/10 font-display text-sm font-bold text-deep">
              {(firstName?.[0] || '?').toUpperCase()}{(lastName?.[0] || '').toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium text-stone-900">{firstName} {lastName}</p>
              <p className="truncate text-xs text-stone-500">{profile.email}</p>
            </div>
          </div>
        </div>

        {message ? (
          <p
            className="motion-safe:animate-in-up motion-reduce:animate-none rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-2.5 text-sm text-emerald-900 shadow-warm-sm"
            role="status"
          >
            {message}
          </p>
        ) : null}
        {error ? (
          <p
            className="motion-safe:animate-in-up motion-reduce:animate-none rounded-xl bg-red-50/90 px-4 py-2.5 text-sm text-red-800 shadow-warm-sm"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
