import crypto from 'crypto'
import { DEFAULT_PASSWORD_POLICY } from './constants.js'

export function validatePasswordAgainstPolicy(password, policy = DEFAULT_PASSWORD_POLICY) {
  const failures = []
  const p = { ...DEFAULT_PASSWORD_POLICY, ...policy }
  const str = typeof password === 'string' ? password : ''

  if (str.length < p.minLength) {
    failures.push({ rule: 'minLength', message: `At least ${p.minLength} characters` })
  }
  if (p.requireUppercase && !/[A-Z]/.test(str)) {
    failures.push({ rule: 'requireUppercase', message: 'Include an uppercase letter' })
  }
  if (p.requireLowercase && !/[a-z]/.test(str)) {
    failures.push({ rule: 'requireLowercase', message: 'Include a lowercase letter' })
  }
  if (p.requireNumber && !/[0-9]/.test(str)) {
    failures.push({ rule: 'requireNumber', message: 'Include a number' })
  }
  if (p.requireSymbol && !/[^A-Za-z0-9]/.test(str)) {
    failures.push({ rule: 'requireSymbol', message: 'Include a symbol' })
  }

  return { valid: failures.length === 0, failures }
}

/** One-time temporary passwords for admin-provisioned accounts (meets merged policy). */
export function generateRandomPasswordAgainstPolicy(policy = DEFAULT_PASSWORD_POLICY) {
  const p = { ...DEFAULT_PASSWORD_POLICY, ...policy }
  const minLen = Math.max(p.minLength, 12)
  for (let attempt = 0; attempt < 100; attempt += 1) {
    let candidate = 'Aa9!'
    while (candidate.length < minLen) {
      candidate += crypto.randomBytes(8).toString('base64url')
    }
    candidate = candidate.slice(0, minLen)
    const result = validatePasswordAgainstPolicy(candidate, p)
    if (result.valid) return candidate
  }
  throw new Error('Could not generate a password meeting policy')
}
