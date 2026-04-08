import { useEffect, useState } from 'react'
import { api } from '../services/api.js'
import { useToast } from '../contexts/ToastContext.jsx'
import { LoadingSpinner } from '../components/LoadingSpinner.jsx'

const SCHEDULE_OPTIONS = [
  { value: '0 9 * * *', label: 'Daily at 9 AM' },
  { value: '0 9 */2 * *', label: 'Every 2 days' },
  { value: '0 9 */3 * *', label: 'Every 3 days' },
  { value: '0 9 * * 1', label: 'Weekly (Monday)' },
]

export function ReminderSettingsPage() {
  const { showToast } = useToast()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const { data } = await api.get('/api/admin/reminders/settings')
      setSettings(data)
    } catch {
      showToast({ variant: 'error', message: 'Failed to load settings.' })
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await api.patch('/api/admin/reminders/settings', settings)
      setSettings(data)
      showToast({ variant: 'success', message: 'Settings saved.' })
    } catch (err) {
      showToast({ variant: 'error', message: err.response?.data?.error || 'Save failed.' })
    } finally { setSaving(false) }
  }

  if (loading) return <LoadingSpinner label="Loading settings" />
  if (!settings) return null

  return (
    <div className="space-y-6">
      <div>
        <p className="ui-section-label">Reminders</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Reminder Settings</h1>
      </div>
      <form onSubmit={save} className="ui-surface max-w-lg space-y-5 p-5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-stone-700">Reminders enabled</label>
          <button type="button"
            onClick={() => setSettings((s) => ({ ...s, enabled: !s.enabled }))}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${settings.enabled ? 'bg-deep' : 'bg-stone-300'}`}>
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${settings.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Schedule</label>
          <select value={settings.cronSchedule}
            onChange={(e) => setSettings((s) => ({ ...s, cronSchedule: e.target.value }))}
            className="ui-input w-full">
            {SCHEDULE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Cooldown (days between reminders)</label>
          <input type="number" min="1" max="30" value={settings.cooldownDays}
            onChange={(e) => setSettings((s) => ({ ...s, cooldownDays: Number(e.target.value) }))}
            className="ui-input w-full" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Max reminders per trainee</label>
          <input type="number" min="1" max="20" value={settings.maxReminders}
            onChange={(e) => setSettings((s) => ({ ...s, maxReminders: Number(e.target.value) }))}
            className="ui-input w-full" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Warning email (days before due)</label>
          <input type="number" min="1" max="14" value={settings.warningDaysBefore}
            onChange={(e) => setSettings((s) => ({ ...s, warningDaysBefore: Number(e.target.value) }))}
            className="ui-input w-full" />
        </div>
        <button type="submit" disabled={saving} className="ui-btn-primary min-h-[44px]">
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </form>
    </div>
  )
}

export function ReminderLogPage() {
  const [data, setData] = useState({ data: [], total: 0, page: 1, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    setLoading(true)
    api.get(`/api/admin/reminders/log?page=${page}&limit=25`)
      .then(({ data: d }) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page])

  if (loading && data.data.length === 0) return <LoadingSpinner label="Loading log" />

  return (
    <div className="space-y-6">
      <div>
        <p className="ui-section-label">Reminders</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Reminder Log</h1>
        <p className="mt-1 text-sm text-stone-500">{data.total} total reminders sent</p>
      </div>
      {data.data.length === 0 ? (
        <div className="ui-surface p-8 text-center text-sm text-stone-500">No reminders sent yet.</div>
      ) : (
        <div className="ui-surface overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-stone-200/60 bg-stone-50/50">
              <tr>
                <th className="px-4 py-3 font-medium text-stone-600">Trainee</th>
                <th className="px-4 py-3 font-medium text-stone-600">Type</th>
                <th className="px-4 py-3 font-medium text-stone-600">Trigger</th>
                <th className="px-4 py-3 font-medium text-stone-600">#</th>
                <th className="px-4 py-3 font-medium text-stone-600">Progress</th>
                <th className="px-4 py-3 font-medium text-stone-600">Days Overdue</th>
                <th className="px-4 py-3 font-medium text-stone-600">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data.data.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-stone-800">{r.traineeName || r.traineeEmail}</p>
                    <p className="text-xs text-stone-500">{r.traineeEmail}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.type === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {r.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.trigger === 'manual' ? 'bg-purple-100 text-purple-700' : 'bg-stone-100 text-stone-600'}`}>
                      {r.trigger}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{r.reminderNumber}</td>
                  <td className="px-4 py-3 text-stone-600">{r.progressAtSend}%</td>
                  <td className="px-4 py-3 text-stone-600">{r.daysOverdue}</td>
                  <td className="px-4 py-3 text-xs text-stone-500">{r.sentAt ? new Date(r.sentAt).toLocaleDateString() : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="ui-btn-secondary !px-3 !py-1.5 text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-stone-600">Page {page} of {data.totalPages}</span>
          <button type="button" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="ui-btn-secondary !px-3 !py-1.5 text-sm disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  )
}

export function PendingRemindersPage() {
  const { showToast } = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const { data } = await api.get('/api/admin/reminders/pending')
      setRows(data)
    } catch {
      showToast({ variant: 'error', message: 'Failed to load.' })
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function sendNow(traineeId, enrollmentId) {
    try {
      await api.post('/api/admin/reminders/send', { traineeId, enrollmentId })
      showToast({ variant: 'success', message: 'Reminder sent.' })
      load()
    } catch (err) {
      showToast({ variant: 'error', message: err.response?.data?.error || 'Send failed.' })
    }
  }

  if (loading) return <LoadingSpinner label="Loading pending" />

  return (
    <div className="space-y-6">
      <div>
        <p className="ui-section-label">Reminders</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Pending Reminders</h1>
        <p className="mt-1 text-sm text-stone-500">Trainees who will receive a reminder on the next scheduled run.</p>
      </div>
      {rows.length === 0 ? (
        <div className="ui-surface p-8 text-center text-sm text-stone-500">No pending reminders.</div>
      ) : (
        <div className="ui-surface overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="border-b border-stone-200/60 bg-stone-50/50">
              <tr>
                <th className="px-4 py-3 font-medium text-stone-600">Trainee</th>
                <th className="px-4 py-3 font-medium text-stone-600">Progress</th>
                <th className="px-4 py-3 font-medium text-stone-600">Due Date</th>
                <th className="px-4 py-3 font-medium text-stone-600">Type</th>
                <th className="px-4 py-3 font-medium text-stone-600">Sent</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((r) => (
                <tr key={r.traineeId}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-stone-800">{r.name}</p>
                    <p className="text-xs text-stone-500">{r.email}</p>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{r.progress}%</td>
                  <td className="px-4 py-3 text-stone-600">{r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.type === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {r.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-500">{r.remindersSent}/{r.maxReminders}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => sendNow(r.traineeId, r.enrollmentId)}
                      className="text-sm font-semibold text-deep hover:underline">Send Now</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
