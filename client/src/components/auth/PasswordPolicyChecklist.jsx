import { validatePasswordAgainstPolicy } from '../../utils/passwordPolicy.js'

export function PasswordPolicyChecklist({ password, policy }) {
  const { failures } = validatePasswordAgainstPolicy(password, policy)
  const failed = new Set(failures.map((f) => f.rule))

  const rules = [
    { key: 'minLength', label: `At least ${policy?.minLength ?? 8} characters` },
    { key: 'requireUppercase', label: 'One uppercase letter' },
    { key: 'requireLowercase', label: 'One lowercase letter' },
    { key: 'requireNumber', label: 'One number' },
    { key: 'requireSymbol', label: 'One symbol' },
  ].filter((r) => {
    if (r.key === 'minLength') return true
    if (r.key === 'requireUppercase') return policy?.requireUppercase
    if (r.key === 'requireLowercase') return policy?.requireLowercase
    if (r.key === 'requireNumber') return policy?.requireNumber
    if (r.key === 'requireSymbol') return policy?.requireSymbol
    return true
  })

  return (
    <ul className="mt-2 space-y-1 text-xs text-stone-600">
      {rules.map((r) => (
        <li
          key={r.key}
          className={
            failed.has(r.key) ? 'text-amber-700' : 'text-emerald-700'
          }
        >
          {failed.has(r.key) ? '○' : '✓'} {r.label}
        </li>
      ))}
    </ul>
  )
}
