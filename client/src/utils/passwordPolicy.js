export function validatePasswordAgainstPolicy(password, policy) {
  const failures = []
  const p = policy || {}
  const str = typeof password === 'string' ? password : ''

  if (str.length < (p.minLength ?? 8)) {
    failures.push({ rule: 'minLength', message: `At least ${p.minLength ?? 8} characters` })
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
