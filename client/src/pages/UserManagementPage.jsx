import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api.js'
import { useToast } from '../contexts/ToastContext.jsx'

function StatusBadge({ status }) {
  const cls =
    status === 'active'
      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
      : 'bg-stone-100 text-stone-700 border-stone-200'
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  )
}

function OnboardingBadge({ onboarding }) {
  if (!onboarding) return <span className="text-xs text-stone-400">—</span>
  const map = {
    admin: 'border-slate-200 bg-slate-50 text-slate-800',
    invite:
      onboarding.inviteStatus === 'accepted' || onboarding.label === 'Invite completed'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
        : onboarding.inviteStatus === 'pending'
          ? 'border-amber-200 bg-amber-50 text-amber-950'
          : onboarding.inviteStatus === 'expired'
            ? 'border-red-200 bg-red-50 text-red-900'
            : 'border-stone-200 bg-stone-50 text-stone-800',
    unknown: 'border-stone-200 bg-stone-50 text-stone-700',
  }
  const key = onboarding.source === 'admin' ? 'admin' : onboarding.source === 'invite' ? 'invite' : 'unknown'
  return (
    <span
      className={`inline-block max-w-[11rem] truncate rounded-full border px-2.5 py-0.5 text-xs font-medium ${map[key]}`}
      title={onboarding.label}
    >
      {onboarding.label}
    </span>
  )
}

function EnrollmentChips({ enrollments }) {
  const active = (enrollments || []).filter((e) => e.status === 'active')
  const other = (enrollments || []).filter((e) => e.status !== 'active')
  if (!active.length && !other.length) {
    return <span className="text-xs text-stone-400">Not enrolled</span>
  }
  return (
    <div className="flex max-w-xs flex-col gap-1">
      {active.length ? (
        <div className="flex flex-wrap gap-1">
          {active.map((e) => (
            <span
              key={e.id}
              className="inline-flex max-w-full items-center truncate rounded-lg border border-emerald-200 bg-emerald-50/90 px-2.5 py-0.5 text-xs font-medium text-emerald-900"
              title={e.courseTitle}
            >
              {e.courseTitle}
            </span>
          ))}
        </div>
      ) : null}
      {other.length ? (
        <p className="text-[10px] leading-tight text-stone-500">
          {other.map((e) => `${e.courseTitle} (${e.status})`).join(' · ')}
        </p>
      ) : null}
    </div>
  )
}

export function UserManagementPage() {
  const { showToast } = useToast()
  const [users, setUsers] = useState([])
  const [filter, setFilter] = useState('')
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [courses, setCourses] = useState([])
  const [traineeEmail, setTraineeEmail] = useState('')
  const [traineeFirstName, setTraineeFirstName] = useState('')
  const [traineeLastName, setTraineeLastName] = useState('')
  const [traineeTempPassword, setTraineeTempPassword] = useState('')
  const [traineeCourseId, setTraineeCourseId] = useState('')
  const [createdCredentials, setCreatedCredentials] = useState(null)
  const [creatingTrainee, setCreatingTrainee] = useState(false)
  const [togglingUid, setTogglingUid] = useState(null)

  async function refresh() {
    setError('')
    try {
      const [u, c] = await Promise.all([api.get('/api/users'), api.get('/api/courses')])
      setUsers(u.data)
      setCourses(c.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load data.')
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const filteredUsers = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return users
    return users.filter((row) => {
      const hay = `${row.email} ${row.firstName} ${row.lastName}`.toLowerCase()
      return hay.includes(q)
    })
  }, [users, filter])

  async function toggleUser(uid, next) {
    setError('')
    setTogglingUid(uid)
    try {
      await api.patch(`/api/users/${uid}/status`, { status: next })
      await refresh()
      showToast({
        variant: 'success',
        message: next === 'active' ? 'Account enabled.' : 'Account disabled.',
      })
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed.')
    } finally {
      setTogglingUid(null)
    }
  }

  async function createTrainee(e) {
    e.preventDefault()
    setError('')
    setCreatingTrainee(true)
    try {
      const body = {
        email: traineeEmail.trim(),
        firstName: traineeFirstName.trim(),
        lastName: traineeLastName.trim(),
        courseId: traineeCourseId.trim() || undefined,
      }
      if (traineeTempPassword.trim()) {
        body.temporaryPassword = traineeTempPassword
      }
      const { data } = await api.post('/api/users/trainees', body)
      setModalOpen(false)
      setTraineeEmail('')
      setTraineeFirstName('')
      setTraineeLastName('')
      setTraineeTempPassword('')
      setTraineeCourseId('')
      await refresh()
      showToast({ variant: 'success', message: 'Trainee account created.' })
      if (data.temporaryPassword) {
        setCreatedCredentials({
          email: data.email,
          temporaryPassword: data.temporaryPassword,
        })
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.failures?.[0]?.message ||
          'Could not create trainee.',
      )
    } finally {
      setCreatingTrainee(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-stone-900">
            Users
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Create trainee accounts with a temporary password. They sign in, then must choose a new
            password before using courses.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="ui-btn-primary"
        >
          Add trainee
        </button>
      </div>

      {error ? (
        <p
          className="motion-safe:animate-in-up motion-reduce:animate-none rounded-xl bg-red-50/90 px-4 py-2.5 text-sm text-red-800 shadow-warm-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="ui-section-label">Trainees & admins</p>
          <input
            placeholder="Search…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="ui-input rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
          />
        </div>
        <div className="ui-surface overflow-x-auto !p-0">
          <table className="min-w-[56rem] text-left text-sm">
            <thead className="border-b border-stone-200/60 bg-stone-50/60 text-xs uppercase tracking-wide text-stone-400">
              <tr>
                <th className="px-5 py-3.5 font-medium">Name</th>
                <th className="px-5 py-3.5 font-medium">Email</th>
                <th className="px-5 py-3.5 font-medium">Role</th>
                <th className="px-5 py-3.5 font-medium">Onboarding</th>
                <th className="px-5 py-3.5 font-medium">Courses</th>
                <th className="px-5 py-3.5 font-medium">Status</th>
                <th className="px-5 py-3.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.uid} className="border-b border-stone-100/80 last:border-0 transition-colors hover:bg-stone-50/50">
                  <td className="px-5 py-3.5">
                    {u.firstName} {u.lastName}
                  </td>
                  <td className="px-5 py-3.5 text-stone-600">{u.email}</td>
                  <td className="px-5 py-3.5 capitalize">{u.role}</td>
                  <td className="px-5 py-3.5 align-top">
                    <OnboardingBadge onboarding={u.onboarding} />
                  </td>
                  <td className="px-5 py-3.5 align-top">
                    <EnrollmentChips enrollments={u.enrollments} />
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge
                      status={
                        u.authDisabled || u.status === 'disabled'
                          ? 'disabled'
                          : 'active'
                      }
                    />
                  </td>
                  <td className="px-5 py-3.5">
                    {u.role === 'trainee' ? (
                      <button
                        type="button"
                        disabled={togglingUid === u.uid}
                        className="ui-press text-xs font-semibold text-deep underline-offset-2 hover:underline disabled:pointer-events-none disabled:opacity-50"
                        onClick={() =>
                          toggleUser(
                            u.uid,
                            u.authDisabled || u.status === 'disabled'
                              ? 'active'
                              : 'disabled',
                          )
                        }
                      >
                        {togglingUid === u.uid
                          ? 'Updating…'
                          : u.authDisabled || u.status === 'disabled'
                            ? 'Enable'
                            : 'Disable'}
                      </button>
                    ) : (
                      <span className="text-xs text-stone-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 backdrop-blur-sm motion-safe:animate-backdrop-in motion-reduce:animate-none">
          <div className="ui-surface w-full max-w-md !border-stone-200 p-6 !shadow-warm-lg motion-safe:animate-modal-in motion-reduce:animate-none">
            <h3 className="font-display text-lg font-semibold text-stone-900">Add trainee</h3>
            <p className="mt-1 text-xs text-stone-400">
              Leave temporary password blank to generate one. Copy it from the confirmation dialog;
              it is not shown again.
            </p>
            <form className="mt-5 space-y-4" onSubmit={createTrainee}>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-stone-700">Email</label>
                <input
                  required
                  type="email"
                  value={traineeEmail}
                  onChange={(e) => setTraineeEmail(e.target.value)}
                  className="ui-input w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-stone-700">First name</label>
                  <input
                    required
                    value={traineeFirstName}
                    onChange={(e) => setTraineeFirstName(e.target.value)}
                    className="ui-input w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-stone-700">Last name</label>
                  <input
                    required
                    value={traineeLastName}
                    onChange={(e) => setTraineeLastName(e.target.value)}
                    className="ui-input w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-stone-700">
                  Temporary password (optional)
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={traineeTempPassword}
                  onChange={(e) => setTraineeTempPassword(e.target.value)}
                  placeholder="Blank = auto-generate"
                  className="ui-input w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-stone-700">
                  Auto-enroll course (optional)
                </label>
                <select
                  value={traineeCourseId}
                  onChange={(e) => setTraineeCourseId(e.target.value)}
                  className="ui-input w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
                >
                  <option value="">None</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="ui-btn-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTrainee}
                  className="ui-btn-primary"
                >
                  {creatingTrainee ? 'Creating…' : 'Create account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {createdCredentials ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 backdrop-blur-sm motion-safe:animate-backdrop-in motion-reduce:animate-none">
          <div className="ui-surface w-full max-w-md !border-stone-200 p-6 !shadow-warm-lg motion-safe:animate-modal-in motion-reduce:animate-none">
            <h3 className="font-display text-lg font-semibold text-stone-900">
              Share credentials once
            </h3>
            <p className="mt-2 text-sm text-stone-500">
              Give the trainee their email and temporary password. They will be required to set a new
              password after signing in.
            </p>
            <dl className="mt-4 space-y-3 rounded-xl bg-stone-50 p-4 text-sm">
              <div>
                <dt className="ui-section-label">Email</dt>
                <dd className="mt-1 font-mono text-stone-900">{createdCredentials.email}</dd>
              </div>
              <div>
                <dt className="ui-section-label">Temporary password</dt>
                <dd className="mt-1 break-all font-mono text-stone-900">
                  {createdCredentials.temporaryPassword}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              className="ui-btn-primary mt-5 w-full"
              onClick={() => setCreatedCredentials(null)}
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
