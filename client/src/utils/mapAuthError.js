/** Map Firebase / API auth codes to user-facing copy. */
export function mapAuthError(err) {
  const code =
    err?.code ||
    err?.response?.data?.code ||
    (typeof err?.response?.data?.error === 'string' && err.response.data.error.includes('/')
      ? err.response.data.error.split('/').pop()
      : null)

  const normalized = String(code || '')
    .replace(/^auth\//, '')
    .toLowerCase()

  const map = {
    'invalid-credential': 'Email or password is incorrect.',
    'invalid-credentials': 'Email or password is incorrect.',
    wrongpassword: 'Email or password is incorrect.',
    invalidemail: 'Enter a valid email address.',
    'user-disabled': 'This account has been disabled. Contact your administrator.',
    'user-not-found': 'Email or password is incorrect.',
    'too-many-requests':
      'Too many sign-in attempts. Wait a few minutes, then try again.',
    'network-request-failed': 'Network error. Check your connection and try again.',
    'invalid-login-credentials': 'Email or password is incorrect.',
  }

  if (normalized && map[normalized]) return map[normalized]

  const msg = err?.response?.data?.error
  if (typeof msg === 'string' && msg.startsWith('auth/')) {
    const tail = msg.replace(/^auth\//, '').toLowerCase().replace(/-/g, '')
    for (const [k, v] of Object.entries(map)) {
      if (k.replace(/-/g, '') === tail) return v
    }
  }

  return null
}
