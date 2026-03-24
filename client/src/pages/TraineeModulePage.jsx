import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../services/api.js'

function typeIcon(type) {
  if (type === 'reading') return '📘'
  if (type === 'video') return '▶️'
  if (type === 'quiz') return '✏️'
  if (type === 'exam') return '📋'
  return '•'
}

export function TraineeModulePage() {
  const { courseId, moduleId } = useParams()
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

  if (error) return <p className="text-sm text-red-700">{error}</p>
  if (!data) return <p className="text-sm text-stone-600">Loading module…</p>

  const continueTo = data.continueLessonId

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Module
        </p>
        <h1 className="font-display text-2xl font-semibold text-stone-900">
          {data.module.title}
        </h1>
        <p className="text-sm text-stone-600">{data.module.description}</p>
      </div>

      {continueTo ? (
        <Link
          to={`/courses/${courseId}/modules/${moduleId}/lessons/${continueTo}`}
          className="inline-flex rounded-full bg-deep px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Continue learning
        </Link>
      ) : (
        <p className="text-sm text-stone-500">No lessons available in this module.</p>
      )}

      <ul className="space-y-2">
        {data.lessons.map((lesson) => (
          <li key={lesson.id}>
            <Link
              to={`/courses/${courseId}/modules/${moduleId}/lessons/${lesson.id}`}
              className="flex items-center justify-between rounded-2xl border border-stone-200/80 bg-white/80 px-4 py-3 text-sm shadow-sm transition hover:border-clay/50"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg" aria-hidden>
                  {typeIcon(lesson.type)}
                </span>
                <div>
                  <p className="font-medium text-stone-900">{lesson.title}</p>
                  <p className="text-xs text-stone-500 capitalize">{lesson.status}</p>
                </div>
              </div>
              {lesson.status === 'completed' ? (
                <span className="text-emerald-700">Done</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
