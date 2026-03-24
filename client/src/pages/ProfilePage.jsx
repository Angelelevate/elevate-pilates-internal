import { useEffect, useState } from 'react'
import { api } from '../services/api.js'
import { PasswordInput } from '../components/auth/PasswordInput.jsx'

export function ProfilePage() {
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
  const [busy, setBusy] = useState(false)

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
    setBusy(true)
    try {
      const { data } = await api.patch('/api/profile', {
        firstName,
        lastName,
        phone: phone || null,
      })
      setProfile(data)
      setMessage('Profile saved.')
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  async function changePassword(e) {
    e.preventDefault()
    setMessage('')
    setError('')
    setBusy(true)
    try {
      await api.post('/api/profile/change-password', {
        currentPassword,
        newPassword,
      })
      setCurrentPassword('')
      setNewPassword('')
      setMessage('Password updated.')
    } catch (err) {
      setError(err.response?.data?.error || 'Password change failed.')
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) {
    return <p className="text-sm text-stone-600">Loading profile…</p>
  }

  if (!profile) {
    return (
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold text-stone-900">Profile</h1>
        <p className="text-sm text-stone-600">
          No profile document exists for this account yet. Trainee profiles are created when an admin
          adds you under Users or when you complete an invite link.
        </p>
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-10">
      <div>
        <h1 className="font-display text-2xl font-semibold text-stone-900">Profile</h1>
        <p className="text-sm text-stone-600">Update your details and password.</p>
      </div>
      <form onSubmit={saveProfile} className="space-y-4 rounded-2xl border border-stone-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
        <h2 className="text-sm font-semibold text-stone-900">Contact</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-stone-800">First name</label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none ring-deep/30 focus:ring-2"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-stone-800">Last name</label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none ring-deep/30 focus:ring-2"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-800">Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none ring-deep/30 focus:ring-2"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-deep px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          Save profile
        </button>
      </form>

      <form onSubmit={changePassword} className="space-y-4 rounded-2xl border border-stone-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
        <h2 className="text-sm font-semibold text-stone-900">Change password</h2>
        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-800">Current password</label>
          <input
            type="password"
            autoComplete="current-password"
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
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-stone-900 px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          Update password
        </button>
      </form>

      {message ? (
        <p className="text-sm text-emerald-800" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
