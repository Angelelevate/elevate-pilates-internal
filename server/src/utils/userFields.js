export const MAX_PROFILE_NAME_CHARS = 100

/** Allows digits, spaces, common phone punctuation, optional leading + */
const PHONE_RE = /^\+?[\d\s().-]{7,22}$/

export function normalizePersonName(value, label) {
  const s = String(value ?? '').trim()
  if (!s) {
    const err = new Error(`${label} is required`)
    err.status = 400
    throw err
  }
  if (s.length > MAX_PROFILE_NAME_CHARS) {
    const err = new Error(`${label} must be at most ${MAX_PROFILE_NAME_CHARS} characters`)
    err.status = 400
    throw err
  }
  return s
}

export function normalizeOptionalPhone(phone) {
  if (phone === undefined || phone === null || String(phone).trim() === '') return null
  const s = String(phone).trim()
  if (!PHONE_RE.test(s)) {
    const err = new Error('Enter a valid phone number (digits, spaces, +, parentheses, or dashes).')
    err.status = 400
    throw err
  }
  return s
}
