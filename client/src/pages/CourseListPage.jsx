import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api.js'

function StatusBadge({ status }) {
  const map = {
    draft: 'bg-amber-50 text-amber-900 border-amber-200',
    published: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    archived: 'bg-stone-100 text-stone-600 border-stone-200',
  }
  const cls = map[status] || map.draft
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {status}
    </span>
  )
}

export function CourseListPage() {
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
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create course.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-stone-900">Courses</h1>
        <p className="text-sm text-stone-600">Create and manage training programs.</p>
      </div>

      <form
        onSubmit={createCourse}
        className="flex flex-col gap-3 rounded-2xl border border-stone-200/80 bg-white/80 p-4 shadow-sm md:flex-row md:items-end"
      >
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-stone-700">Title</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none ring-deep/30 focus:ring-2"
          />
        </div>
        <div className="flex-[2] space-y-1">
          <label className="text-xs font-medium text-stone-700">Description</label>
          <input
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none ring-deep/30 focus:ring-2"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-deep px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          New course
        </button>
      </form>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white/80 shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50/80 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3 font-medium">Course</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Modules</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.id} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-3">
                  <Link
                    to={`/admin/courses/${c.id}`}
                    className="font-medium text-deep underline-offset-2 hover:underline"
                  >
                    {c.title}
                  </Link>
                  <p className="text-xs text-stone-500 line-clamp-2">{c.description}</p>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-4 py-3 text-stone-600">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
