import { useState } from 'react'
import { Link } from 'react-router-dom'
import { sendPasswordResetEmail } from 'firebase/auth'
import { getFirebaseAuth } from '../config/firebase.js'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-stone-900">
          Reset password
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          We will email you a link to choose a new password.
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
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-deep py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? 'Sending…' : 'Send reset email'}
        </button>
        <p className="text-center text-sm text-stone-600">
          <Link to="/login" className="font-medium text-deep underline-offset-2 hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  )
}
