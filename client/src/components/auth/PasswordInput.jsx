import { useId, useState } from 'react'
import { PasswordPolicyChecklist } from './PasswordPolicyChecklist.jsx'

export function PasswordInput({
  label = 'Password',
  value,
  onChange,
  policy,
  showPolicy,
  autoComplete = 'new-password',
  disabled,
  placeholder,
}) {
  const id = useId()
  const [visible, setVisible] = useState(false)

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-stone-800">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="ui-input w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
        />
        <button
          type="button"
          className="ui-press shrink-0 rounded-xl border border-stone-200 px-3 text-xs font-medium text-stone-600 transition-colors duration-200 ease-soft hover:bg-stone-50"
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {showPolicy && policy ? (
        <PasswordPolicyChecklist password={value} policy={policy} />
      ) : null}
    </div>
  )
}
