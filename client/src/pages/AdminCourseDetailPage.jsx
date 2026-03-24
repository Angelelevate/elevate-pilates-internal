import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd'
import { api } from '../services/api.js'

export function AdminCourseDetailPage() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const [course, setCourse] = useState(null)
  const [modules, setModules] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [users, setUsers] = useState([])
  const [validation, setValidation] = useState(null)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [modTitle, setModTitle] = useState('')
  const [modDesc, setModDesc] = useState('')
  const [selectedTrainees, setSelectedTrainees] = useState([])
  const [enrollSearch, setEnrollSearch] = useState('')
  const [enrollBusy, setEnrollBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [c, m, e, u] = await Promise.all([
        api.get(`/api/courses/${courseId}`),
        api.get(`/api/courses/${courseId}/modules`),
        api.get(`/api/courses/${courseId}/enrollments`),
        api.get('/api/users'),
      ])
      setCourse(c.data)
      setTitle(c.data.title)
      setDescription(c.data.description)
      setDueDate(c.data.dueDate ? String(c.data.dueDate).slice(0, 10) : '')
      setModules(m.data)
      setEnrollments(e.data)
      setUsers(u.data.filter((x) => x.role === 'trainee'))
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load course.')
    }
  }, [courseId])

  useEffect(() => {
    void load()
  }, [load])

  async function saveCourseMeta(e) {
    e.preventDefault()
    setError('')
    try {
      await api.patch(`/api/courses/${courseId}`, {
        title,
        description,
        dueDate: dueDate || null,
      })
      await load()
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.')
    }
  }

  async function addModule(e) {
    e.preventDefault()
    setError('')
    try {
      const nextOrder = modules.length ? Math.max(...modules.map((x) => x.order || 0)) + 1 : 1
      await api.post(`/api/courses/${courseId}/modules`, {
        title: modTitle,
        description: modDesc,
        order: nextOrder,
      })
      setModTitle('')
      setModDesc('')
      await load()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not add module.')
    }
  }

  async function onDragEnd(result) {
    if (!result.destination) return
    const items = Array.from(modules)
    const [removed] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, removed)
    setModules(items)
    try {
      await api.patch(`/api/courses/${courseId}/modules/reorder`, {
        orderedModuleIds: items.map((x) => x.id),
      })
    } catch {
      await load()
    }
  }

  async function runValidate() {
    setError('')
    try {
      const { data } = await api.get(`/api/courses/${courseId}/validate`)
      setValidation(data)
    } catch (err) {
      setError(err.response?.data?.error || 'Validation failed.')
    }
  }

  async function publish() {
    setError('')
    try {
      await api.patch(`/api/courses/${courseId}/status`, { status: 'published' })
      await load()
    } catch (err) {
      const issues = err.response?.data?.issues
      if (issues) setValidation({ valid: false, issues })
      setError(err.response?.data?.error || 'Publish failed.')
    }
  }

  async function unpublish() {
    setError('')
    try {
      await api.patch(`/api/courses/${courseId}/status`, { status: 'draft' })
      await load()
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed.')
    }
  }

  const activeEnrolledIds = useMemo(
    () =>
      new Set(
        enrollments.filter((e) => e.status === 'active').map((e) => e.traineeId),
      ),
    [enrollments],
  )

  const traineesAvailableToAdd = useMemo(
    () => users.filter((u) => !activeEnrolledIds.has(u.uid)),
    [users, activeEnrolledIds],
  )

  const filteredTraineesToAdd = useMemo(() => {
    const q = enrollSearch.trim().toLowerCase()
    if (!q) return traineesAvailableToAdd
    return traineesAvailableToAdd.filter((u) =>
      `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q),
    )
  }, [traineesAvailableToAdd, enrollSearch])

  function toggleTraineeSelect(uid) {
    setSelectedTrainees((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid],
    )
  }

  function selectAllVisible() {
    const ids = filteredTraineesToAdd.map((u) => u.uid)
    setSelectedTrainees((prev) => Array.from(new Set([...prev, ...ids])))
  }

  function clearSelection() {
    setSelectedTrainees([])
  }

  async function enroll(e) {
    e.preventDefault()
    if (!selectedTrainees.length) return
    setError('')
    setEnrollBusy(true)
    try {
      await api.post(`/api/courses/${courseId}/enrollments`, {
        traineeIds: selectedTrainees,
      })
      setSelectedTrainees([])
      setEnrollSearch('')
      await load()
    } catch (err) {
      setError(err.response?.data?.error || 'Enrollment failed.')
    } finally {
      setEnrollBusy(false)
    }
  }

  if (!course) {
    return <p className="text-sm text-stone-600">{error || 'Loading…'}</p>
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => navigate('/admin/courses')}
            className="text-xs font-semibold text-stone-500 hover:text-stone-800"
          >
            ← All courses
          </button>
          <h1 className="font-display text-2xl font-semibold text-stone-900">
            {course.title}
          </h1>
          <p className="text-sm text-stone-600">Status: {course.status}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runValidate}
            className="rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50"
          >
            Validate
          </button>
          {course.status === 'published' ? (
            <button
              type="button"
              onClick={unpublish}
              className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100"
            >
              Unpublish
            </button>
          ) : (
            <button
              type="button"
              onClick={publish}
              className="rounded-full bg-deep px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Publish
            </button>
          )}
        </div>
      </div>

      {validation && !validation.valid ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
          <p className="font-semibold">Publish blockers</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {(validation.issues || []).map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={saveCourseMeta}
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
        <div className="space-y-1">
          <label className="text-xs font-medium text-stone-700">Due date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none ring-deep/30 focus:ring-2"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Save course
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-stone-900">Modules</h2>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="modules">
            {(provided) => (
              <ul
                className="space-y-2 rounded-2xl border border-stone-200/80 bg-white/60 p-3"
                ref={provided.innerRef}
                {...provided.droppableProps}
              >
                {modules.map((m, index) => (
                  <Draggable key={m.id} draggableId={m.id} index={index}>
                    {(p) => (
                      <li
                        ref={p.innerRef}
                        {...p.draggableProps}
                        {...p.dragHandleProps}
                        className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm"
                      >
                        <div>
                          <p className="font-medium text-stone-900">{m.title}</p>
                          <p className="text-xs text-stone-500">Order {m.order}</p>
                        </div>
                        <Link
                          to={`/admin/courses/${courseId}/modules/${m.id}`}
                          className="text-xs font-semibold text-deep underline-offset-2 hover:underline"
                        >
                          Open
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

        <form onSubmit={addModule} className="flex flex-col gap-2 rounded-2xl border border-dashed border-stone-300 p-4 md:flex-row md:items-end">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium text-stone-700">New module title</label>
            <input
              value={modTitle}
              onChange={(e) => setModTitle(e.target.value)}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none ring-deep/30 focus:ring-2"
            />
          </div>
          <div className="flex-[2] space-y-1">
            <label className="text-xs font-medium text-stone-700">Description</label>
            <input
              value={modDesc}
              onChange={(e) => setModDesc(e.target.value)}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none ring-deep/30 focus:ring-2"
            />
          </div>
          <button
            type="submit"
            className="rounded-full bg-deep px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Add module
          </button>
        </form>
      </section>

      <section className="space-y-6">
        <div className="rounded-2xl border border-stone-200/80 bg-white/90 shadow-sm">
          <div className="border-b border-stone-100 px-5 py-4">
            <h2 className="font-display text-base font-semibold text-stone-900">
              Enrolled on this course
            </h2>
            <p className="mt-0.5 text-sm text-stone-600">
              {enrollments.filter((e) => e.status === 'active').length} active ·{' '}
              {enrollments.length} total records (includes withdrawn / completed)
            </p>
          </div>
          {enrollments.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-stone-500">
              No enrollments yet. Add trainees below.
            </p>
          ) : (
            <ul className="divide-y divide-stone-100 px-2 py-2">
              {enrollments.map((en) => {
                const name = en.trainee
                  ? `${en.trainee.firstName} ${en.trainee.lastName}`.trim()
                  : en.traineeId
                const email = en.trainee?.email
                const statusCls =
                  en.status === 'active'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : en.status === 'completed'
                      ? 'border-slate-200 bg-slate-50 text-slate-800'
                      : 'border-stone-200 bg-stone-50 text-stone-700'
                return (
                  <li
                    key={en.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-3 sm:flex-nowrap"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-deep/10 text-sm font-semibold text-deep">
                        {(name || '?')
                          .split(/\s+/)
                          .map((p) => p[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-stone-900">{name}</p>
                        {email ? (
                          <p className="truncate text-xs text-stone-500">{email}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusCls}`}
                      >
                        {en.status}
                      </span>
                      {en.status === 'active' ? (
                        <button
                          type="button"
                          className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-800 transition hover:bg-red-50"
                          onClick={async () => {
                            await api.patch(`/api/enrollments/${en.id}`, {
                              status: 'withdrawn',
                            })
                            await load()
                          }}
                        >
                          Withdraw
                        </button>
                      ) : en.status === 'withdrawn' ? (
                        <span className="text-xs text-stone-400">Can re-add from below</span>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-stone-200/80 bg-gradient-to-b from-white to-stone-50/80 p-5 shadow-sm">
          <h2 className="font-display text-base font-semibold text-stone-900">
            Add trainees to this course
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Search by name or email, select people, then add them. Anyone already active on this
            course is hidden from the list.
          </p>
          <form onSubmit={enroll} className="mt-4 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="search"
                placeholder="Search trainees…"
                value={enrollSearch}
                onChange={(e) => setEnrollSearch(e.target.value)}
                className="w-full flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none ring-deep/30 focus:ring-2"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectAllVisible}
                  disabled={!filteredTraineesToAdd.length}
                  className="rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-50 disabled:opacity-50"
                >
                  Select all shown
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={!selectedTrainees.length}
                  className="rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                >
                  Clear selection
                </button>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-stone-200 bg-white">
              {filteredTraineesToAdd.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-stone-500">
                  {traineesAvailableToAdd.length === 0
                    ? 'Every trainee is already active on this course.'
                    : 'No matches for your search.'}
                </p>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {filteredTraineesToAdd.map((u) => {
                    const checked = selectedTrainees.includes(u.uid)
                    return (
                      <li key={u.uid}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition hover:bg-stone-50">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTraineeSelect(u.uid)}
                            className="h-4 w-4 rounded border-stone-300 text-deep focus:ring-deep"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-stone-900">
                              {u.firstName} {u.lastName}
                            </p>
                            <p className="text-xs text-stone-500">{u.email}</p>
                          </div>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            <div className="flex flex-col gap-3 border-t border-stone-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-stone-600">
                <span className="font-semibold text-stone-900">{selectedTrainees.length}</span>{' '}
                selected
              </p>
              <button
                type="submit"
                disabled={!selectedTrainees.length || enrollBusy}
                className="rounded-full bg-deep px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {enrollBusy ? 'Adding…' : 'Add to course'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}
