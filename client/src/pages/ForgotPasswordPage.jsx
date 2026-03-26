import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { sendPasswordResetEmail } from 'firebase/auth'
import { getFirebaseAuth } from '../config/firebase.js'
import { api } from '../services/api.js'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [policy, setPolicy] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .get('/api/config/public')
      .then(({ data }) => {
        if (!cancelled) setPolicy(data.passwordPolicy)
      })
      .catch(() => {
        if (!cancelled) setPolicy(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit(e) {
    e.preventDefault()
    setMessage('')
    setError('')
    const auth = getFirebaseAuth()
    if (!auth) {
      setError('Firebase Auth is not configured.')
      return
    }
    setBusy(true)
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setMessage('Check your inbox for reset instructions.')
    } catch {
      setError('Could not send reset email. Verify the address and try again.')
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
          Reset password
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          We will email you a link to choose a new password.
        </p>
        {policy ? (
          <div className="mx-auto mt-4 max-w-md rounded-xl border border-stone-200/80 bg-stone-50/90 px-4 py-3 text-left text-xs text-stone-600">
            <p className="font-semibold text-stone-800">Your new password must meet:</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>At least {policy.minLength ?? 8} characters</li>
              {policy.requireUppercase ? <li>One uppercase letter</li> : null}
              {policy.requireLowercase ? <li>One lowercase letter</li> : null}
              {policy.requireNumber ? <li>One number</li> : null}
              {policy.requireSymbol ? <li>One symbol</li> : null}
            </ul>
            <p className="mt-2 text-stone-500">
              If the password you pick on the reset page is too weak, the reset may fail — match these
              rules before submitting.
            </p>
          </div>
        ) : null}
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
        {message ? (
          <p
            className="motion-safe:animate-in-up motion-reduce:animate-none rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-2.5 text-sm text-emerald-900"
            role="status"
          >
            {message}
          </p>
        ) : null}
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
          {busy ? 'Sending…' : 'Send reset email'}
        </button>
        <p className="text-center text-sm text-stone-500">
          <Link to="/login" className="ui-link font-medium text-deep underline-offset-2 hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  )
}
