import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { api } from '../services/api.js'

function homeForRole(role) {
  if (role === 'admin') return '/admin/courses'
  if (role === 'trainee') return '/dashboard'
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
      navigate(from && from !== '/login' ? from : homeForRole(role), {
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
      navigate(from && from !== '/login' ? from : homeForRole(r), { replace: true })
    } catch (err) {
      const code = err?.code || err?.response?.data?.error
      setError(
        typeof code === 'string'
          ? code
          : 'Unable to sign in. Check your email and password.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-stone-900">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Use the email and password for your Elevate Pilates account.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-stone-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium text-stone-800">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none ring-deep/30 focus:ring-2"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium text-stone-800">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none ring-deep/30 focus:ring-2"
          />
        </div>
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy || loading}
          className="w-full rounded-full bg-deep py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-center text-sm text-stone-600">
          <Link to="/forgot-password" className="font-medium text-deep underline-offset-2 hover:underline">
            Forgot password?
          </Link>
        </p>
      </form>
    </div>
  )
}
