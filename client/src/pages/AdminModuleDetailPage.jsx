import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd'
import { api } from '../services/api.js'

const lessonTypes = [
  { value: 'reading', label: 'Reading' },
  { value: 'video', label: 'Video' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'exam', label: 'Exam' },
]

export function AdminModuleDetailPage() {
  const { courseId, moduleId } = useParams()
  const navigate = useNavigate()
  const [module, setModule] = useState(null)
  const [lessons, setLessons] = useState([])
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [lessonTitle, setLessonTitle] = useState('')
  const [lessonType, setLessonType] = useState('reading')

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
    try {
      await api.patch(`/api/modules/${moduleId}`, { title, description })
      await load()
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.')
    }
  }

  async function addLesson(e) {
    e.preventDefault()
    setError('')
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
    return <p className="text-sm text-stone-600">{error || 'Loading…'}</p>
  }

  return (
    <div className="space-y-8">
      <div>
        <button
          type="button"
          onClick={() => navigate(`/admin/courses/${courseId}`)}
          className="text-xs font-semibold text-stone-500 hover:text-stone-800"
        >
          ← Course
        </button>
        <h1 className="font-display text-2xl font-semibold text-stone-900">
          {module.title}
        </h1>
        <p className="text-sm text-stone-600">Lessons · {lessons.length}</p>
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={saveModule}
        className="grid gap-4 rounded-2xl border border-stone-200/80 bg-white/80 p-4 shadow-sm md:grid-cols-2"
      >
        <div className="space-y-1 md:col-span-2">
          <label className="text-xs font-medium text-stone-700">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none ring-deep/30 focus:ring-2"
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="text-xs font-medium text-stone-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none ring-deep/30 focus:ring-2"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Save module
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-stone-900">Lessons</h2>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="lessons">
            {(provided) => (
              <ul
                className="space-y-2 rounded-2xl border border-stone-200/80 bg-white/60 p-3"
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
                        className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm"
                      >
                        <div>
                          <p className="font-medium text-stone-900">{lesson.title}</p>
                          <p className="text-xs text-stone-500">
                            {lesson.type} · {lesson.status}
                          </p>
                        </div>
                        <Link
                          to={`/admin/lessons/${lesson.id}`}
                          className="text-xs font-semibold text-deep underline-offset-2 hover:underline"
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
          className="flex flex-col gap-2 rounded-2xl border border-dashed border-stone-300 p-4 md:flex-row md:items-end"
        >
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium text-stone-700">Lesson title</label>
            <input
              required
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none ring-deep/30 focus:ring-2"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-700">Type</label>
            <select
              value={lessonType}
              onChange={(e) => setLessonType(e.target.value)}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none ring-deep/30 focus:ring-2 md:w-40"
            >
              {lessonTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-full bg-deep px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Add lesson
          </button>
        </form>
      </section>
    </div>
  )
}
