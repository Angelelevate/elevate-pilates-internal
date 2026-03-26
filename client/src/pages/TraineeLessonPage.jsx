import DOMPurify from 'dompurify'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../services/api.js'
import { useToast } from '../contexts/ToastContext.jsx'
import { LoadingSpinner } from '../components/LoadingSpinner.jsx'

function typeIcon(type) {
  if (type === 'reading') return '📘'
  if (type === 'video') return '▶️'
  if (type === 'quiz') return '✏️'
  if (type === 'exam') return '📋'
  return '•'
}

export function TraineeLessonPage() {
  const { courseId, moduleId, lessonId } = useParams()
  const navigate = useNavigate()
  const [lesson, setLesson] = useState(null)
  const [moduleData, setModuleData] = useState(null)
  const [error, setError] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [lessonNavLocked, setLessonNavLocked] = useState(false)

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

  useEffect(() => {
    setLessonNavLocked(false)
  }, [lessonId])

  const orderedLessons = useMemo(() => {
    const list = moduleData?.lessons || []
    return [...list].sort((a, b) => (a.order || 0) - (b.order || 0))
  }, [moduleData])

  const index = orderedLessons.findIndex((l) => l.id === lessonId)
  const prevId = index > 0 ? orderedLessons[index - 1].id : null
  const nextId =
    index >= 0 && index < orderedLessons.length - 1 ? orderedLessons[index + 1].id : null

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
  if (!lesson || !moduleData) return <LoadingSpinner label="Loading lesson" />

  const { lesson: doc, progress } = lesson

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside
        className={`lg:w-64 lg:shrink-0 ${
          drawerOpen ? 'block' : 'hidden lg:block'
        }`}
      >
        <div className="ui-surface p-3">
          <p className="ui-section-label px-2">Lessons</p>
          <ul className="mt-2 space-y-1">
            {orderedLessons.map((l) => (
              <li key={l.id}>
                <Link
                  to={`/courses/${courseId}/modules/${moduleId}/lessons/${l.id}`}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-[background-color,color,transform,box-shadow] duration-200 ease-soft ${
                    l.id === lessonId
                      ? 'bg-deep text-white shadow-warm-sm'
                      : 'text-stone-600 hover:bg-stone-50 motion-safe:hover:translate-x-0.5 motion-reduce:hover:translate-x-0'
                  }`}
                  onClick={() => setDrawerOpen(false)}
                >
                  <span className="text-sm">{typeIcon(l.type)}</span>
                  <span className="flex-1 truncate">{l.title}</span>
                  {l.status === 'completed' ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">✓</span>
                  ) : null}
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
            className="ui-btn-secondary min-h-[44px] lg:hidden"
            onClick={() => setDrawerOpen((o) => !o)}
          >
            {drawerOpen ? 'Hide outline' : 'Lesson outline'}
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="ui-link text-sm font-semibold text-stone-600 underline-offset-2 hover:underline"
            >
              ← My courses
            </button>
            <Link
              to={`/courses/${courseId}/modules/${moduleId}`}
              className="ui-link text-sm font-semibold text-deep underline-offset-2 hover:underline"
            >
              ← Module
            </Link>
          </div>
        </div>

        <div className="ui-surface p-6">
          <p className="ui-section-label">{moduleData.module.title}</p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-stone-900">{doc.title}</h1>
        </div>

        {doc.type === 'reading' ? (
          <ReadingPane
            lessonId={lessonId}
            body={doc.content?.body}
            onDone={refresh}
            alreadyComplete={progress?.status === 'completed'}
            onNavLockChange={setLessonNavLocked}
          />
        ) : null}
        {doc.type === 'video' ? (
          <VideoPane
            key={lessonId}
            lessonId={lessonId}
            initialUrl={doc.content?.downloadUrl}
            storagePath={doc.content?.storagePath}
            durationSeconds={doc.content?.durationSeconds}
            progress={progress}
            onRefresh={refresh}
          />
        ) : null}
        {doc.type === 'quiz' ? (
          <QuizPane
            lessonId={lessonId}
            quizId={doc.content?.quizId}
            onDone={refresh}
            alreadyComplete={progress?.status === 'completed'}
            onNavLockChange={setLessonNavLocked}
          />
        ) : null}
        {doc.type === 'exam' ? (
          <ExamPane quizId={doc.content?.quizId} />
        ) : null}

        <nav className="flex flex-wrap items-stretch gap-3 border-t border-stone-200/60 pt-5">
          {prevId && !lessonNavLocked ? (
            <Link
              to={`/courses/${courseId}/modules/${moduleId}/lessons/${prevId}`}
              className="ui-btn-secondary inline-flex min-h-[44px] min-w-[120px] items-center justify-center"
            >
              Previous
            </Link>
          ) : prevId ? (
            <span
              className="inline-flex min-h-[44px] min-w-[120px] cursor-not-allowed items-center justify-center rounded-full border border-stone-200/80 bg-stone-50 px-4 py-2 text-sm text-stone-400"
              aria-disabled="true"
            >
              Previous
            </span>
          ) : (
            <span className="inline-flex min-h-[44px] min-w-[120px] items-center justify-center rounded-full border border-stone-100 px-4 py-2 text-sm text-stone-400">
              Previous
            </span>
          )}
          {nextId && !lessonNavLocked ? (
            <Link
              to={`/courses/${courseId}/modules/${moduleId}/lessons/${nextId}`}
              className="ui-btn-primary inline-flex min-h-[44px] min-w-[120px] items-center justify-center"
            >
              Next
            </Link>
          ) : nextId ? (
            <span
              className="inline-flex min-h-[44px] min-w-[120px] cursor-not-allowed items-center justify-center rounded-full border border-stone-200/80 bg-stone-100 px-4 py-2 text-sm font-medium text-stone-400"
              aria-disabled="true"
            >
              Next
            </span>
          ) : (
            <Link
              to={`/courses/${courseId}/modules/${moduleId}`}
              className={`ui-btn-primary inline-flex min-h-[44px] min-w-[160px] items-center justify-center ${lessonNavLocked ? 'pointer-events-none opacity-50' : ''}`}
              aria-disabled={lessonNavLocked}
              onClick={(e) => lessonNavLocked && e.preventDefault()}
            >
              Back to module
            </Link>
          )}
        </nav>
      </div>
    </div>
  )
}

function ReadingPane({ lessonId, body, onDone, alreadyComplete, onNavLockChange }) {
  const { showToast } = useToast()
  const [marking, setMarking] = useState(false)
  const [markedThisSession, setMarkedThisSession] = useState(false)
  const html = DOMPurify.sanitize(body || '')
  const words = (body || '').trim().split(/\s+/).filter(Boolean).length
  const minutes = Math.max(1, Math.round(words / 200))
  const showCompleted = Boolean(alreadyComplete || markedThisSession)

  async function markComplete() {
    onNavLockChange?.(true)
    setMarking(true)
    try {
      await api.post(`/api/my/progress/lessons/${lessonId}/complete`)
      setMarkedThisSession(true)
      await onDone()
      showToast({ variant: 'success', message: 'Nice work — lesson marked complete.' })
    } catch {
      showToast({ variant: 'error', message: 'Could not save progress. Try again.' })
    } finally {
      setMarking(false)
      onNavLockChange?.(false)
    }
  }

  return (
    <article className="space-y-6">
      <p className="flex items-center gap-2 text-xs text-stone-400">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        About {minutes} min read
      </p>
      <div
        className="prose prose-stone max-w-3xl text-stone-800 prose-headings:font-display prose-a:text-deep"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <button
        type="button"
        disabled={marking || showCompleted}
        onClick={markComplete}
        className="ui-btn-primary min-h-[44px] disabled:pointer-events-none disabled:opacity-60"
      >
        {marking ? 'Saving…' : showCompleted ? 'Completed' : 'Mark as completed'}
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
  const restoredPosition = useRef(false)
  const nearEndSent = useRef(false)
  const wasCompletedRef = useRef(false)
  const [celebrate, setCelebrate] = useState(false)

  useEffect(() => {
    setUrl(initialUrl)
    restoredPosition.current = false
    nearEndSent.current = false
    lastSent.current = 0
  }, [lessonId, initialUrl])

  useEffect(() => {
    wasCompletedRef.current = progress?.status === 'completed'
  }, [progress?.status])

  function getDuration(el) {
    if (!el) return 0
    const d = el.duration
    if (Number.isFinite(d) && d > 0) return d
    const fallback = Number(durationSeconds)
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 0
  }

  function tryRestorePosition() {
    const el = videoRef.current
    if (!el || restoredPosition.current) return
    const lp = progress?.videoProgress?.lastPosition
    if (lp == null || !Number.isFinite(lp) || lp < 0.5) {
      restoredPosition.current = true
      return
    }
    const dur = getDuration(el)
    if (!(dur > 0)) return
    const seek = Math.min(Math.max(0, lp), Math.max(0, dur - 0.1))
    try {
      el.currentTime = seek
    } catch {
      /* seek may fail before data is ready */
    }
    restoredPosition.current = true
  }

  async function refreshUrl() {
    try {
      const { data } = await api.get(`/api/my/lessons/${lessonId}/video-url`)
      setUrl(data.downloadUrl)
      setMsg('')
    } catch {
      setMsg('Still unable to load video.')
    }
  }

  async function sendProgress(options = {}) {
    const el = videoRef.current
    if (!el) return null
    const watchedToEnd = Boolean(options.watchedToEnd)
    const dur = getDuration(el)
    const fallbackDur = Number(durationSeconds)
    const denom =
      dur > 0
        ? dur
        : Number.isFinite(fallbackDur) && fallbackDur > 0
          ? fallbackDur
          : 0

    let currentTime = el.currentTime
    if (watchedToEnd && denom > 0) currentTime = denom

    const prevMax = progress?.videoProgress?.maxReached || 0
    const maxReached = Math.max(
      currentTime,
      prevMax,
      watchedToEnd && denom > 0 ? denom : 0,
    )
    let percent = 0
    if (denom > 0) {
      percent = Math.min(100, Math.round((maxReached / denom) * 100))
    }
    if (watchedToEnd) percent = 100
    if (!watchedToEnd && maxReached < 0.05) return null

    try {
      const { data } = await api.post(`/api/my/progress/lessons/${lessonId}/video-progress`, {
        lastPosition: currentTime,
        maxReached,
        percentWatched: percent,
        watchedToEnd,
      })
      const nowCompleted = data.status === 'completed'
      if (nowCompleted && !wasCompletedRef.current) {
        setCelebrate(true)
        window.setTimeout(() => setCelebrate(false), 3300)
      }
      wasCompletedRef.current = nowCompleted
      onRefresh()
      return data
    } catch {
      return null
    }
  }

  function onLoadedMetadata() {
    tryRestorePosition()
  }

  function onTimeUpdate() {
    const el = videoRef.current
    if (!el) return
    const dur = getDuration(el)
    if (dur > 0) {
      const ratio = el.currentTime / dur
      if (ratio < 0.8) nearEndSent.current = false
      if (ratio >= 0.9 && !nearEndSent.current) {
        nearEndSent.current = true
        void sendProgress()
      }
    }
    const now = Date.now()
    if (now - lastSent.current < 12000) return
    lastSent.current = now
    void sendProgress()
  }

  function onEnded() {
    void sendProgress({ watchedToEnd: true })
  }

  function onPause() {
    void sendProgress()
  }

  useEffect(() => {
    const el = videoRef.current
    if (el && el.readyState >= 1 && !restoredPosition.current) tryRestorePosition()
  }, [progress?.videoProgress?.lastPosition])

  if (!url && !storagePath) {
    return <p className="text-sm text-stone-600">Video is not available yet.</p>
  }

  return (
    <div className="relative space-y-3">
      {celebrate ? (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-10 z-50 flex justify-center px-4"
          role="status"
          aria-live="polite"
        >
          <div className="animate-completion-toast flex max-w-md items-center gap-3 rounded-2xl border border-emerald-300/80 bg-white px-5 py-4 shadow-warm-lg">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-xl text-emerald-800"
              aria-hidden
            >
              ✓
            </span>
            <div>
              <p className="font-display text-base font-semibold text-emerald-950">Lesson complete</p>
              <p className="text-sm text-emerald-900/85">Your progress has been saved.</p>
            </div>
          </div>
        </div>
      ) : null}
      <video
        ref={videoRef}
        src={url}
        controls
        playsInline
        className="w-full max-w-4xl rounded-2xl border border-stone-200/60 bg-black shadow-warm"
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        onPause={onPause}
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
            className="ui-btn-secondary !border-red-200 !px-3 !py-1 !text-xs !text-red-800"
            onClick={refreshUrl}
          >
            Retry
          </button>
        </div>
      ) : null}
      <p className="text-xs text-stone-400">
        Completes automatically when you reach about 90% or when the video ends. Progress also
        saves every ~12s while playing and when you pause.
      </p>
    </div>
  )
}

function QuizPane({ lessonId, quizId, onDone, alreadyComplete, onNavLockChange }) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const [markedThisSession, setMarkedThisSession] = useState(false)
  const showCompleted = Boolean(alreadyComplete || markedThisSession)

  async function complete() {
    onNavLockChange?.(true)
    setBusy(true)
    try {
      await api.post(`/api/my/progress/lessons/${lessonId}/complete`)
      setMarkedThisSession(true)
      await onDone()
      showToast({ variant: 'success', message: 'Lesson marked complete.' })
    } catch {
      showToast({ variant: 'error', message: 'Could not save. Try again.' })
    } finally {
      setBusy(false)
      onNavLockChange?.(false)
    }
  }

  return (
    <div className="ui-surface space-y-4 p-5">
      <p className="text-sm text-stone-600">
        Practice quiz {quizId ? `(id: ${quizId})` : ''}. The full quiz player ships in Module 5.
      </p>
      <button
        type="button"
        disabled={busy || showCompleted}
        onClick={complete}
        className="ui-btn-primary min-h-[44px] disabled:pointer-events-none disabled:opacity-60"
      >
        {busy ? 'Saving…' : showCompleted ? 'Completed' : 'Mark lesson complete'}
      </button>
    </div>
  )
}

function ExamPane({ quizId }) {
  return (
    <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-5 text-sm text-amber-950 shadow-warm-sm">
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
