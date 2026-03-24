import DOMPurify from 'dompurify'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../services/api.js'

export function AdminLessonPreviewPage() {
  const { lessonId } = useParams()
  const [lesson, setLesson] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data } = await api.get(`/api/admin/lessons/${lessonId}/preview`)
        if (!cancelled) setLesson(data.lesson)
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || 'Preview failed.')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [lessonId])

  if (error) return <p className="text-sm text-red-700">{error}</p>
  if (!lesson) return <p className="text-sm text-stone-600">Loading preview…</p>

  const html = DOMPurify.sanitize(lesson.content?.body || '')

  return (
    <div className="space-y-6">
      <Link
        to={`/admin/lessons/${lessonId}`}
        className="text-sm font-semibold text-deep underline-offset-2 hover:underline"
      >
        ← Back to editor
      </Link>
      <h1 className="font-display text-2xl font-semibold text-stone-900">{lesson.title}</h1>
      {lesson.type === 'reading' ? (
        <div
          className="prose prose-stone max-w-3xl"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : null}
      {lesson.type === 'video' && lesson.content?.downloadUrl ? (
        <video
          src={lesson.content.downloadUrl}
          controls
          className="w-full max-w-3xl rounded-2xl border border-stone-200"
        />
      ) : null}
      {lesson.type === 'quiz' || lesson.type === 'exam' ? (
        <p className="text-sm text-stone-600">
          Quiz preview requires Module 5. Reference: {lesson.content?.quizId || '—'}
        </p>
      ) : null}
    </div>
  )
}
