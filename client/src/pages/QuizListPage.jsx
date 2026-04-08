import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api.js'
import { useToast } from '../contexts/ToastContext.jsx'
import { LoadingSpinner } from '../components/LoadingSpinner.jsx'

export function QuizListPage() {
  const { showToast } = useToast()
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState('quiz')
  const [courseId, setCourseId] = useState('')
  const [courses, setCourses] = useState([])
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const [q, c] = await Promise.all([
        api.get('/api/quizzes'),
        api.get('/api/courses'),
      ])
      setQuizzes(q.data)
      setCourses(c.data)
      if (!courseId && c.data.length > 0) setCourseId(c.data[0].id)
    } catch {
      showToast({ variant: 'error', message: 'Failed to load quizzes.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function create(e) {
    e.preventDefault()
    if (!title.trim() || !courseId) return
    setBusy(true)
    try {
      await api.post('/api/quizzes', {
        title: title.trim(),
        type,
        courseId,
        description: '',
        questionOrder: 'fixed',
        optionOrder: 'fixed',
        displayMode: type === 'exam' ? 'one_per_page' : 'single_page',
      })
      setTitle('')
      setShowForm(false)
      await load()
      showToast({ variant: 'success', message: `${type === 'exam' ? 'Exam' : 'Quiz'} created.` })
    } catch (err) {
      showToast({ variant: 'error', message: err.response?.data?.error || 'Create failed.' })
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingSpinner label="Loading assessments" />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="ui-section-label">Content</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Assessments</h1>
        </div>
        <button type="button" className="ui-btn-primary min-h-[44px]" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ New assessment'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="ui-surface space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                className="ui-input w-full" placeholder="e.g. Module 2 Knowledge Check" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="ui-input w-full">
                <option value="quiz">Practice Quiz</option>
                <option value="exam">Formal Exam</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Course</label>
              <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="ui-input w-full">
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" disabled={busy} className="ui-btn-primary min-h-[44px]">
            {busy ? 'Creating…' : 'Create'}
          </button>
        </form>
      )}

      {quizzes.length === 0 ? (
        <div className="ui-surface p-8 text-center text-sm text-stone-500">
          No assessments yet. Create your first quiz or exam.
        </div>
      ) : (
        <div className="ui-surface overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200/60 bg-stone-50/50">
              <tr>
                <th className="px-4 py-3 font-medium text-stone-600">Title</th>
                <th className="px-4 py-3 font-medium text-stone-600">Type</th>
                <th className="px-4 py-3 font-medium text-stone-600">Questions</th>
                <th className="px-4 py-3 font-medium text-stone-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {quizzes.filter((q) => q.status !== 'archived').map((q) => (
                <tr key={q.id} className="transition-colors hover:bg-stone-50/50">
                  <td className="px-4 py-3 font-medium text-stone-900">{q.title}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${q.type === 'exam' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                      {q.type === 'exam' ? 'Exam' : 'Quiz'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{q.questionCount || 0}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${q.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'}`}>
                      {q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/admin/quizzes/${q.id}`} className="ui-link text-sm font-semibold text-deep hover:underline">
                      Edit
                    </Link>
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
