import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { getFirebaseAuth } from '../config/firebase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { PasswordInput } from '../components/auth/PasswordInput.jsx'

export function InviteAcceptPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { refreshClaims } = useAuth()

  const [loading, setLoading] = useState(true)
  const [valid, setValid] = useState(false)
  const [expired, setExpired] = useState(false)
  const [email, setEmail] = useState('')
  const [policy, setPolicy] = useState(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const pub = await axios.get('/api/config/public')
        if (!cancelled) setPolicy(pub.data.passwordPolicy)
        const { data } = await axios.get(`/api/invites/validate/${token}`)
        if (cancelled) return
        setValid(Boolean(data.valid))
        setExpired(Boolean(data.expired))
        setEmail(data.email || '')
      } catch {
        if (!cancelled) setValid(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [token])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await axios.post('/api/invites/accept', {
        token,
        firstName,
        lastName,
        phone: phone || undefined,
        password,
      })
      const auth = getFirebaseAuth()
      if (!auth) throw new Error('Firebase Auth is not configured')
      const cred = await signInWithEmailAndPassword(auth, email, password)
      await cred.user.getIdToken(true)
      await refreshClaims()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.failures?.[0]?.message ||
        err.message ||
        'Could not complete signup.'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-stone-600">Checking your invite…</p>
  }

  if (!valid) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-6 text-sm text-amber-950">
        <h1 className="font-display text-xl font-semibold">Invite unavailable</h1>
        <p>
          {expired
            ? 'This invite has expired. Contact your administrator for a new link.'
            : 'This invite link is not valid. Ask your administrator to resend it.'}
        </p>
        <Link to="/login" className="font-medium text-deep underline-offset-2 hover:underline">
          Go to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-stone-900">
          Create your account
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          You are joining as <span className="font-medium text-stone-800">{email}</span>
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-stone-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-stone-800">First name</label>
            <input
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none ring-deep/30 focus:ring-2"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-stone-800">Last name</label>
            <input
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none ring-deep/30 focus:ring-2"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-800">Phone (optional)</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none ring-deep/30 focus:ring-2"
          />
        </div>
        <PasswordInput
          label="Choose a password"
          value={password}
          onChange={setPassword}
          policy={policy}
          showPolicy
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
          {busy ? 'Creating account…' : 'Complete setup'}
        </button>
      </form>
    </div>
  )
}
