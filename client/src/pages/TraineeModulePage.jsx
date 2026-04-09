import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../services/api.js'
import { LoadingSpinner } from '../components/LoadingSpinner.jsx'

function formatLessonStatus(status) {
  const map = {
    not_started: 'Not started',
    in_progress: 'In progress',
    completed: 'Completed',
  }
  if (map[status]) return map[status]
  return String(status || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function typeIcon(type) {
  if (type === 'reading') return '📘'
  if (type === 'video') return '▶️'
  if (type === 'quiz') return '✏️'
  if (type === 'exam') return '📋'
  return '•'
}

export function TraineeModulePage() {
  const { courseId, moduleId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: payload } = await api.get(
          `/api/my/courses/${courseId}/modules/${moduleId}`,
        )
        if (!cancelled) setData(payload)
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || 'Could not load module.')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [courseId, moduleId])

  if (error) {
    return (
      <p
        className="motion-safe:animate-in-up motion-reduce:animate-none rounded-xl bg-red-50/90 px-4 py-3 text-sm text-red-800 shadow-warm-sm"
        role="alert"
      >
        {error}
      </p>
    )
  }
  if (!data) return <LoadingSpinner label="Loading module" />

  const continueTo = data.continueLessonId

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="ui-btn-secondary !px-3 !py-1.5 !text-xs"
        >
          ← Back to my courses
        </button>
      </div>
      <div className="ui-surface p-6">
        <p className="ui-section-label">Module</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-stone-900">
          {data.module.title}
        </h1>
        <p className="mt-1 text-sm text-stone-600">{data.module.description}</p>

        {continueTo ? (
          <Link
            to={`/courses/${courseId}/modules/${moduleId}/lessons/${continueTo}`}
            className="ui-btn-primary mt-5 inline-flex"
          >
            {data.lessons?.some((l) => l.status !== 'not_started') ? 'Continue learning' : 'Start learning'}
          </Link>
        ) : (
          <p className="mt-4 text-sm text-stone-500">No lessons available in this module.</p>
        )}
      </div>

      <div>
        <p className="ui-section-label mb-3 px-1">Lessons</p>
        <ul className="space-y-2">
          {data.lessons.map((lesson, index) => (
            <li
              key={lesson.id}
              className="motion-safe:animate-in-up motion-reduce:animate-none"
              style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
            >
              <Link
                to={`/courses/${courseId}/modules/${moduleId}/lessons/${lesson.id}`}
                className="ui-card flex items-center justify-between rounded-2xl border border-stone-200/60 bg-white/90 px-5 py-4 text-sm hover:border-clay/40"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-50 text-base" aria-hidden>
                    {typeIcon(lesson.type)}
                  </span>
                  <div>
                    <p className="font-medium text-stone-900">{lesson.title}</p>
                    <p className="text-xs text-stone-500">{formatLessonStatus(lesson.status)}</p>
                  </div>
                </div>
                {lesson.status === 'completed' ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">✓</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
