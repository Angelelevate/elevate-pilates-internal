import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { api } from '../services/api.js'
import { mapAuthError } from '../utils/mapAuthError.js'

function homeForRole() {
  return '/'
}

export function LoginPage() {
  const { user, role, login, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!loading && user && role) {
      navigate(from && from !== '/login' ? from : homeForRole(), {
        replace: true,
      })
    }
  }, [user, role, loading, navigate, from])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email.trim(), password)
      const { data } = await api.post('/api/auth/verify-token')
      const r = data.role
      navigate(from && from !== '/login' ? from : homeForRole(), { replace: true })
    } catch (err) {
      const mapped = mapAuthError(err)
      const apiErr = err?.response?.data?.error
      setError(
        mapped ||
          (typeof apiErr === 'string' && !apiErr.startsWith('auth/')
            ? apiErr
            : null) ||
          'Unable to sign in. Check your email and password.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-4">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-deep text-lg font-bold text-white shadow-warm">
        EP
      </div>
      <div className="w-full text-center">
        <h1 className="font-display text-2xl font-semibold text-stone-900">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Use the email and password for your Elevate Pilates account.
        </p>
      </div>
      <form
        onSubmit={onSubmit}
        className="ui-surface mt-6 w-full space-y-5 p-7"
      >
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-stone-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="ui-input w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium text-stone-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="ui-input w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
          />
        </div>
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
          disabled={busy || loading}
          className="ui-btn-primary w-full"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-center text-sm text-stone-500">
          <Link
            to="/forgot-password"
            className="ui-link font-medium text-deep underline-offset-2 hover:underline"
          >
            Forgot password?
          </Link>
        </p>
      </form>
    </div>
  )
}
