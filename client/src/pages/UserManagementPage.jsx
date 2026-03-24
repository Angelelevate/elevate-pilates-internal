import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api.js'

function StatusBadge({ status }) {
  const cls =
    status === 'active'
      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
      : 'bg-stone-100 text-stone-700 border-stone-200'
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
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
      className={`inline-block max-w-[11rem] truncate rounded-full border px-2 py-0.5 text-xs font-medium ${map[key]}`}
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
              className="inline-flex max-w-full items-center truncate rounded-lg border border-emerald-200 bg-emerald-50/90 px-2 py-0.5 text-xs font-medium text-emerald-900"
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
    try {
      await api.patch(`/api/users/${uid}/status`, { status: next })
      await refresh()
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed.')
    }
  }

  async function createTrainee(e) {
    e.preventDefault()
    setError('')
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
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-stone-900">
            Users
          </h1>
          <p className="text-sm text-stone-600">
            Create trainee accounts with a temporary password. They sign in, then must choose a new
            password before using courses. Onboarding source and course enrollments are shown for
            each trainee.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-full bg-deep px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Add trainee
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-stone-900">Trainees & admins</h2>
          <input
            placeholder="Search…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-sm outline-none ring-deep/30 focus:ring-2"
          />
        </div>
        <div className="overflow-x-auto rounded-2xl border border-stone-200/80 bg-white/80 shadow-sm">
          <table className="min-w-[56rem] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50/80 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Onboarding</th>
                <th className="px-4 py-3 font-medium">Courses</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.uid} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3">
                    {u.firstName} {u.lastName}
                  </td>
                  <td className="px-4 py-3 text-stone-700">{u.email}</td>
                  <td className="px-4 py-3 capitalize">{u.role}</td>
                  <td className="px-4 py-3 align-top">
                    <OnboardingBadge onboarding={u.onboarding} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <EnrollmentChips enrollments={u.enrollments} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={
                        u.authDisabled || u.status === 'disabled'
                          ? 'disabled'
                          : 'active'
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    {u.role === 'trainee' ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-deep underline-offset-2 hover:underline"
                        onClick={() =>
                          toggleUser(
                            u.uid,
                            u.authDisabled || u.status === 'disabled'
                              ? 'active'
                              : 'disabled',
                          )
                        }
                      >
                        {u.authDisabled || u.status === 'disabled'
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <h3 className="font-display text-lg font-semibold text-stone-900">Add trainee</h3>
            <p className="mt-1 text-xs text-stone-500">
              Leave temporary password blank to generate one. Copy it from the confirmation dialog;
              it is not shown again.
            </p>
            <form className="mt-4 space-y-3" onSubmit={createTrainee}>
              <div className="space-y-1">
                <label className="text-sm font-medium text-stone-800">Email</label>
                <input
                  required
                  type="email"
                  value={traineeEmail}
                  onChange={(e) => setTraineeEmail(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none ring-deep/30 focus:ring-2"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-stone-800">First name</label>
                  <input
                    required
                    value={traineeFirstName}
                    onChange={(e) => setTraineeFirstName(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none ring-deep/30 focus:ring-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-stone-800">Last name</label>
                  <input
                    required
                    value={traineeLastName}
                    onChange={(e) => setTraineeLastName(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none ring-deep/30 focus:ring-2"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-stone-800">
                  Temporary password (optional)
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={traineeTempPassword}
                  onChange={(e) => setTraineeTempPassword(e.target.value)}
                  placeholder="Blank = auto-generate"
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none ring-deep/30 focus:ring-2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-stone-800">
                  Auto-enroll course (optional)
                </label>
                <select
                  value={traineeCourseId}
                  onChange={(e) => setTraineeCourseId(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none ring-deep/30 focus:ring-2"
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
                  className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-deep px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  Create account
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {createdCredentials ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <h3 className="font-display text-lg font-semibold text-stone-900">
              Share credentials once
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              Give the trainee their email and temporary password. They will be required to set a new
              password after signing in.
            </p>
            <dl className="mt-4 space-y-2 rounded-xl bg-stone-50 p-4 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">Email</dt>
                <dd className="font-mono text-stone-900">{createdCredentials.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">
                  Temporary password
                </dt>
                <dd className="break-all font-mono text-stone-900">
                  {createdCredentials.temporaryPassword}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              className="mt-4 w-full rounded-full bg-deep py-2.5 text-sm font-semibold text-white hover:opacity-90"
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
