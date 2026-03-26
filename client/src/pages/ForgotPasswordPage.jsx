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
