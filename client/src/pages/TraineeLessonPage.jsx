import DOMPurify from 'dompurify'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../services/api.js'

function typeIcon(type) {
  if (type === 'reading') return '📘'
  if (type === 'video') return '▶️'
  if (type === 'quiz') return '✏️'
  if (type === 'exam') return '📋'
  return '•'
}

export function TraineeLessonPage() {
  const { courseId, moduleId, lessonId } = useParams()
  const [lesson, setLesson] = useState(null)
  const [moduleData, setModuleData] = useState(null)
  const [error, setError] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [l, m] = await Promise.all([
        api.get(`/api/my/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`),
        api.get(`/api/my/courses/${courseId}/modules/${moduleId}`),
      ])
      setLesson(l.data)
      setModuleData(m.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load lesson.')
    }
  }, [courseId, moduleId, lessonId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const orderedLessons = useMemo(() => {
    const list = moduleData?.lessons || []
    return [...list].sort((a, b) => (a.order || 0) - (b.order || 0))
  }, [moduleData])

  const index = orderedLessons.findIndex((l) => l.id === lessonId)
  const prevId = index > 0 ? orderedLessons[index - 1].id : null
  const nextId =
    index >= 0 && index < orderedLessons.length - 1 ? orderedLessons[index + 1].id : null

  if (error) return <p className="text-sm text-red-700">{error}</p>
  if (!lesson || !moduleData) return <p className="text-sm text-stone-600">Loading…</p>

  const { lesson: doc, progress } = lesson

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside
        className={`lg:w-64 lg:shrink-0 ${
          drawerOpen ? 'block' : 'hidden lg:block'
        }`}
      >
        <div className="rounded-2xl border border-stone-200/80 bg-white/80 p-3 shadow-sm">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Lessons
          </p>
          <ul className="mt-2 space-y-1">
            {orderedLessons.map((l) => (
              <li key={l.id}>
                <Link
                  to={`/courses/${courseId}/modules/${moduleId}/lessons/${l.id}`}
                  className={`flex items-center gap-2 rounded-xl px-2 py-2 text-sm ${
                    l.id === lessonId
                      ? 'bg-deep text-white'
                      : 'text-stone-700 hover:bg-stone-100'
                  }`}
                  onClick={() => setDrawerOpen(false)}
                >
                  <span>{typeIcon(l.type)}</span>
                  <span className="flex-1 truncate">{l.title}</span>
                  {l.status === 'completed' ? <span>✓</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="min-w-0 flex-1 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-800 lg:hidden"
            onClick={() => setDrawerOpen((o) => !o)}
          >
            {drawerOpen ? 'Hide outline' : 'Lesson outline'}
          </button>
          <Link
            to={`/courses/${courseId}/modules/${moduleId}`}
            className="text-sm font-semibold text-deep underline-offset-2 hover:underline"
          >
            ← Back to module
          </Link>
        </div>

        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            {moduleData.module.title}
          </p>
          <h1 className="font-display text-2xl font-semibold text-stone-900">{doc.title}</h1>
        </header>

        {doc.type === 'reading' ? (
          <ReadingPane lessonId={lessonId} body={doc.content?.body} onDone={refresh} />
        ) : null}
        {doc.type === 'video' ? (
          <VideoPane
            lessonId={lessonId}
            initialUrl={doc.content?.downloadUrl}
            storagePath={doc.content?.storagePath}
            durationSeconds={doc.content?.durationSeconds}
            progress={progress}
            onRefresh={refresh}
          />
        ) : null}
        {doc.type === 'quiz' ? (
          <QuizPane lessonId={lessonId} quizId={doc.content?.quizId} onDone={refresh} />
        ) : null}
        {doc.type === 'exam' ? (
          <ExamPane quizId={doc.content?.quizId} />
        ) : null}

        <nav className="flex flex-wrap gap-3 border-t border-stone-200 pt-4">
          {prevId ? (
            <Link
              to={`/courses/${courseId}/modules/${moduleId}/lessons/${prevId}`}
              className="inline-flex min-h-[44px] min-w-[120px] items-center justify-center rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50"
            >
              Previous
            </Link>
          ) : (
            <span className="inline-flex min-h-[44px] min-w-[120px] items-center justify-center rounded-full border border-stone-100 px-4 py-2 text-sm text-stone-400">
              Previous
            </span>
          )}
          {nextId ? (
            <Link
              to={`/courses/${courseId}/modules/${moduleId}/lessons/${nextId}`}
              className="inline-flex min-h-[44px] min-w-[120px] items-center justify-center rounded-full bg-deep px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Next
            </Link>
          ) : (
            <Link
              to={`/courses/${courseId}/modules/${moduleId}`}
              className="inline-flex min-h-[44px] min-w-[160px] items-center justify-center rounded-full bg-deep px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Back to module
            </Link>
          )}
        </nav>
      </div>
    </div>
  )
}

function ReadingPane({ lessonId, body, onDone }) {
  const html = DOMPurify.sanitize(body || '')
  const words = (body || '').trim().split(/\s+/).filter(Boolean).length
  const minutes = Math.max(1, Math.round(words / 200))

  async function markComplete() {
    await api.post(`/api/my/progress/lessons/${lessonId}/complete`)
    onDone()
  }

  return (
    <article className="space-y-6">
      <p className="text-xs text-stone-500">About {minutes} min read</p>
      <div
        className="prose prose-stone max-w-3xl text-stone-800 prose-headings:font-display prose-a:text-deep"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <button
        type="button"
        onClick={markComplete}
        className="min-h-[44px] rounded-full bg-deep px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Mark as completed
      </button>
    </article>
  )
}

function VideoPane({
  lessonId,
  initialUrl,
  storagePath,
  durationSeconds,
  progress,
  onRefresh,
}) {
  const videoRef = useRef(null)
  const [url, setUrl] = useState(initialUrl)
  const [msg, setMsg] = useState('')
  const lastSent = useRef(0)

  useEffect(() => {
    setUrl(initialUrl)
  }, [initialUrl])

  useEffect(() => {
    const el = videoRef.current
    if (!el || !progress?.videoProgress?.lastPosition) return
    el.currentTime = progress.videoProgress.lastPosition
  }, [progress])

  async function refreshUrl() {
    try {
      const { data } = await api.get(`/api/my/lessons/${lessonId}/video-url`)
      setUrl(data.downloadUrl)
      setMsg('')
    } catch {
      setMsg('Still unable to load video.')
    }
  }

  async function sendProgress() {
    const el = videoRef.current
    if (!el) return
    const dur = el.duration || durationSeconds || 0
    if (!dur) return
    const maxReached = Math.max(el.currentTime, progress?.videoProgress?.maxReached || 0)
    const percent = Math.min(100, Math.round((maxReached / dur) * 100))
    await api.post(`/api/my/progress/lessons/${lessonId}/video-progress`, {
      lastPosition: el.currentTime,
      maxReached,
      percentWatched: percent,
    })
    onRefresh()
  }

  function onTimeUpdate() {
    const now = Date.now()
    if (now - lastSent.current < 15000) return
    lastSent.current = now
    void sendProgress()
  }

  if (!url && !storagePath) {
    return <p className="text-sm text-stone-600">Video is not available yet.</p>
  }

  return (
    <div className="space-y-3">
      <video
        ref={videoRef}
        src={url}
        controls
        className="w-full max-w-4xl rounded-2xl border border-stone-200 bg-black"
        onTimeUpdate={onTimeUpdate}
        onError={() => {
          setMsg('Video failed to load. Refreshing link…')
          void refreshUrl()
        }}
      >
        <track kind="captions" />
      </video>
      {msg ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-red-700">
          <span>{msg}</span>
          <button
            type="button"
            className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold"
            onClick={refreshUrl}
          >
            Retry
          </button>
        </div>
      ) : null}
      <p className="text-xs text-stone-500">
        Completes automatically after 90% watched. Progress saves every ~15s while playing.
      </p>
    </div>
  )
}

function QuizPane({ lessonId, quizId, onDone }) {
  async function complete() {
    await api.post(`/api/my/progress/lessons/${lessonId}/complete`)
    onDone()
  }

  return (
    <div className="space-y-4 rounded-2xl border border-stone-200/80 bg-white/80 p-4 shadow-sm">
      <p className="text-sm text-stone-700">
        Practice quiz {quizId ? `(id: ${quizId})` : ''}. The full quiz player ships in Module
        5.
      </p>
      <button
        type="button"
        onClick={complete}
        className="min-h-[44px] rounded-full bg-deep px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Mark lesson complete
      </button>
    </div>
  )
}

function ExamPane({ quizId }) {
  return (
    <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
      <p className="font-semibold">Formal exam</p>
      <p>
        Graded exams will run inside the Module 5 quiz engine
        {quizId ? ` (id: ${quizId})` : ''}. Until then, ask your administrator about completion
        requirements.
      </p>
      {/*TODO(Module 5): Mount exam player and call completion only on pass. */}
    </div>
  )
}
