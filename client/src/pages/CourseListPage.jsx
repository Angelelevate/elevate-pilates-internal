import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api.js'
import { useToast } from '../contexts/ToastContext.jsx'
import { TraineeVisibilityTip } from '../components/admin/TraineeVisibilityTip.jsx'
import {
  MAX_COURSE_DESCRIPTION_LENGTH,
  MAX_COURSE_TITLE_LENGTH,
} from '../utils/constants.js'

function StatusBadge({ status }) {
  const map = {
    draft: 'bg-amber-50 text-amber-900 border-amber-200',
    published: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    archived: 'bg-stone-100 text-stone-600 border-stone-200',
  }
  const cls = map[status] || map.draft
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {status}
    </span>
  )
}

export function CourseListPage() {
  const { showToast } = useToast()
  const [courses, setCourses] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  async function load() {
    setError('')
    try {
      const { data } = await api.get('/api/courses')
      setCourses(data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load courses.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function createCourse(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.post('/api/courses', { title, description })
      setTitle('')
      setDescription('')
      await load()
      showToast({ variant: 'success', message: 'Course created.' })
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        (err.response?.status === 409
          ? 'A course with the same title and description already exists.'
          : 'Could not create course.')
      setError(msg)
      showToast({ variant: 'error', message: msg })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-stone-900">Courses</h1>
          <p className="mt-1 text-sm text-stone-500">Create and manage training programs.</p>
        </div>
      </div>

      <div className="rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-2.5 shadow-warm-sm">
        <TraineeVisibilityTip variant="compact" />
      </div>

      <form
        onSubmit={createCourse}
        className="ui-surface flex flex-col gap-4 p-5 md:flex-row md:items-end"
      >
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-medium text-stone-600">Title</label>
          <input
            required
            maxLength={MAX_COURSE_TITLE_LENGTH}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="ui-input w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
          />
          <p className="text-[10px] text-stone-400">{title.length}/{MAX_COURSE_TITLE_LENGTH}</p>
        </div>
        <div className="flex-[2] space-y-1.5">
          <label className="text-xs font-medium text-stone-600">Description</label>
          <input
            required
            maxLength={MAX_COURSE_DESCRIPTION_LENGTH}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="ui-input w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
          />
          <p className="text-[10px] text-stone-400">
            {description.length}/{MAX_COURSE_DESCRIPTION_LENGTH}
          </p>
        </div>
        <button type="submit" disabled={busy} className="ui-btn-primary whitespace-nowrap">
          {busy ? 'Creating…' : 'New course'}
        </button>
      </form>

      {error ? (
        <p
          className="motion-safe:animate-in-up motion-reduce:animate-none rounded-xl bg-red-50/90 px-4 py-2.5 text-sm text-red-800 shadow-warm-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="ui-surface overflow-hidden !p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-stone-200/60 bg-stone-50/60 text-xs uppercase tracking-wide text-stone-400">
            <tr>
              <th className="px-5 py-3.5 font-medium">Course</th>
              <th className="px-5 py-3.5 font-medium">Status</th>
              <th className="px-5 py-3.5 font-medium">Modules</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr
                key={c.id}
                className="border-b border-stone-100/80 transition-colors duration-200 ease-soft last:border-0 hover:bg-stone-50/60"
              >
                <td className="px-5 py-4">
                  <Link
                    to={`/admin/courses/${c.id}`}
                    className="ui-link font-medium text-deep underline-offset-2 hover:underline"
                  >
                    {c.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-stone-500 line-clamp-2">{c.description}</p>
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-5 py-4 tabular-nums text-stone-700">
                  {typeof c.moduleCount === 'number' ? c.moduleCount : 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
