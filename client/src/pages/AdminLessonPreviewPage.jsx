import DOMPurify from 'dompurify'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../services/api.js'
import { LoadingSpinner } from '../components/LoadingSpinner.jsx'

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
  if (!lesson) return <LoadingSpinner label="Loading preview" />

  const html = DOMPurify.sanitize(lesson.content?.body || '')

  return (
    <div className="space-y-6">
      <Link
        to={`/admin/lessons/${lessonId}`}
        className="ui-link text-sm font-semibold text-deep underline-offset-2 hover:underline"
      >
        ← Back to editor
      </Link>
      <div className="ui-surface p-6">
        <p className="ui-section-label">Preview</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-stone-900">{lesson.title}</h1>
      </div>
      {lesson.type === 'reading' ? (
        <div
          className="prose prose-stone max-w-3xl text-stone-800 prose-headings:font-display prose-a:text-deep"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : null}
      {lesson.type === 'video' && lesson.content?.downloadUrl ? (
        <video
          src={lesson.content.downloadUrl}
          controls
          className="w-full max-w-3xl rounded-2xl border border-stone-200/60 shadow-warm"
        />
      ) : null}
      {lesson.type === 'quiz' || lesson.type === 'exam' ? (
        <div className="ui-surface p-5">
          <p className="text-sm text-stone-600">
            Quiz preview requires Module 5. Reference: {lesson.content?.quizId || '—'}
          </p>
        </div>
      ) : null}
    </div>
  )
}
