import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd'
import { api } from '../services/api.js'
import { useToast } from '../contexts/ToastContext.jsx'
import { TraineeVisibilityTip } from '../components/admin/TraineeVisibilityTip.jsx'
import { LoadingSpinner } from '../components/LoadingSpinner.jsx'

const lessonTypes = [
  { value: 'reading', label: 'Reading' },
  { value: 'video', label: 'Video' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'exam', label: 'Exam' },
]

export function AdminModuleDetailPage() {
  const { showToast } = useToast()
  const { courseId, moduleId } = useParams()
  const navigate = useNavigate()
  const [module, setModule] = useState(null)
  const [lessons, setLessons] = useState([])
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [lessonTitle, setLessonTitle] = useState('')
  const [lessonType, setLessonType] = useState('reading')
  const [saveBusy, setSaveBusy] = useState(false)
  const [addLessonBusy, setAddLessonBusy] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [m, l] = await Promise.all([
        api.get(`/api/modules/${moduleId}`),
        api.get(`/api/modules/${moduleId}/lessons`),
      ])
      setModule(m.data)
      setTitle(m.data.title)
      setDescription(m.data.description)
      setLessons(l.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load module.')
    }
  }, [moduleId])

  useEffect(() => {
    void load()
  }, [load])

  async function saveModule(e) {
    e.preventDefault()
    setError('')
    setSaveBusy(true)
    try {
      await api.patch(`/api/modules/${moduleId}`, { title, description })
      await load()
      showToast({ variant: 'success', message: 'Module saved.' })
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.')
    } finally {
      setSaveBusy(false)
    }
  }

  async function addLesson(e) {
    e.preventDefault()
    setError('')
    setAddLessonBusy(true)
    try {
      const nextOrder = lessons.length ? Math.max(...lessons.map((x) => x.order || 0)) + 1 : 1
      const { data } = await api.post(`/api/modules/${moduleId}/lessons`, {
        title: lessonTitle,
        type: lessonType,
        order: nextOrder,
        content:
          lessonType === 'reading'
            ? { body: '<p></p>' }
            : lessonType === 'video'
              ? {}
              : { quizId: '' },
      })
      setLessonTitle('')
      navigate(`/admin/lessons/${data.id}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not add lesson.')
    } finally {
      setAddLessonBusy(false)
    }
  }

  const isDirty = useMemo(() => {
    if (!module) return false
    return (
      title !== (module.title ?? '') || description !== (module.description ?? '')
    )
  }, [module, title, description])

  async function setModuleStatus(status) {
    setError('')
    setStatusBusy(true)
    try {
      await api.patch(`/api/modules/${moduleId}/status`, { status })
      await load()
      showToast({
        variant: 'success',
        message: status === 'published' ? 'Module published.' : 'Module marked draft.',
      })
    } catch (err) {
      setError(err.response?.data?.error || 'Status update failed.')
    } finally {
      setStatusBusy(false)
    }
  }

  async function onDragEnd(result) {
    if (!result.destination) return
    const items = Array.from(lessons)
    const [removed] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, removed)
    setLessons(items)
    try {
      await api.patch(`/api/modules/${moduleId}/lessons/reorder`, {
        orderedLessonIds: items.map((x) => x.id),
      })
    } catch {
      await load()
    }
  }

  if (!module) {
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
    return <LoadingSpinner label="Loading module" />
  }

  const statusBadgeCls =
    module.status === 'published'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : module.status === 'archived'
        ? 'border-stone-200 bg-stone-100 text-stone-700'
        : 'border-amber-200 bg-amber-50 text-amber-950'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate(`/admin/courses/${courseId}`)}
            className="ui-press text-xs font-semibold text-stone-400 transition-colors duration-200 ease-soft hover:text-stone-700"
          >
            ← Course
          </button>
          <h1 className="font-display text-2xl font-semibold text-stone-900">
            {module.title}
          </h1>
          <p className="mt-0.5 text-sm text-stone-500">Lessons · {lessons.length}</p>
        </div>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusBadgeCls}`}
          >
            Module: {module.status}
          </span>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={statusBusy}
              onClick={() => setModuleStatus('draft')}
              className="ui-btn-secondary !px-3 !py-1.5 !text-xs"
            >
              {statusBusy ? 'Updating…' : 'Mark draft'}
            </button>
            <button
              type="button"
              disabled={statusBusy}
              onClick={() => setModuleStatus('published')}
              className="ui-btn-primary !px-3 !py-1.5 !text-xs"
            >
              {statusBusy ? 'Updating…' : 'Publish module'}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <p
          className="motion-safe:animate-in-up motion-reduce:animate-none rounded-xl bg-red-50/90 px-4 py-2.5 text-sm text-red-800 shadow-warm-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="rounded-xl border border-sky-100 bg-sky-50/40 px-4 py-2.5 shadow-warm-sm">
        <TraineeVisibilityTip variant="compact" />
      </div>

      {isDirty ? (
        <div className="motion-safe:animate-in-up motion-reduce:animate-none rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 shadow-warm-sm">
          <strong>Unsaved changes</strong> — the title and description below are not saved until you
          click <strong>Save module</strong>.
        </div>
      ) : null}

      {module.status !== 'published' ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-2.5 text-sm text-amber-950 shadow-warm-sm">
          This module is <strong>not published</strong>. Trainees cannot open its lessons until you
          click <strong>Publish module</strong> (and the course is published too).
        </div>
      ) : null}

      <form
        onSubmit={saveModule}
        className="ui-surface grid gap-4 p-5 md:grid-cols-2"
      >
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-medium text-stone-600">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="ui-input w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-medium text-stone-600">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="ui-input w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
          />
        </div>
        <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-end">
          <button type="submit" disabled={saveBusy} className="ui-btn-primary !bg-stone-900">
            {saveBusy ? 'Saving…' : 'Save module'}
          </button>
          <span className="text-xs text-stone-400">
            Required to persist title &amp; description edits
          </span>
        </div>
      </form>

      <section className="space-y-3">
        <p className="ui-section-label">Lessons</p>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="lessons">
            {(provided) => (
              <ul
                className="space-y-2 rounded-2xl border border-stone-200/60 bg-white/60 p-3 shadow-warm-sm"
                ref={provided.innerRef}
                {...provided.droppableProps}
              >
                {lessons.map((lesson, index) => (
                  <Draggable key={lesson.id} draggableId={lesson.id} index={index}>
                    {(p) => (
                      <li
                        ref={p.innerRef}
                        {...p.draggableProps}
                        {...p.dragHandleProps}
                        className="flex items-center justify-between rounded-xl border border-stone-200/80 bg-white px-4 py-3 text-sm shadow-warm-sm transition-[box-shadow,border-color] duration-200 ease-soft hover:border-stone-300 hover:shadow-warm"
                      >
                        <div>
                          <p className="font-medium text-stone-900">{lesson.title}</p>
                          <p className="text-xs text-stone-500">
                            <span className="capitalize">{lesson.type}</span>
                            <span
                              className={
                                lesson.status === 'published'
                                  ? ' text-emerald-700'
                                  : ' text-amber-700'
                              }
                            >
                              {' '}
                              · {lesson.status}
                            </span>
                          </p>
                        </div>
                        <Link
                          to={`/admin/lessons/${lesson.id}`}
                          className="ui-link text-xs font-semibold text-deep underline-offset-2 hover:underline"
                        >
                          Edit
                        </Link>
                      </li>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>

        <form
          onSubmit={addLesson}
          className="flex flex-col gap-3 rounded-2xl border border-dashed border-stone-300/80 p-5 transition-[border-color,box-shadow] duration-300 ease-soft hover:border-clay/40 hover:shadow-warm-sm md:flex-row md:items-end"
        >
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium text-stone-600">Lesson title</label>
            <input
              required
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              className="ui-input w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-stone-600">Type</label>
            <select
              value={lessonType}
              onChange={(e) => setLessonType(e.target.value)}
              className="ui-input w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2 md:w-40"
            >
              {lessonTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={addLessonBusy} className="ui-btn-primary whitespace-nowrap">
            {addLessonBusy ? 'Adding…' : 'Add lesson'}
          </button>
        </form>
      </section>
    </div>
  )
}
