import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd'
import { api } from '../services/api.js'
import { useToast } from '../contexts/ToastContext.jsx'
import { TraineeVisibilityTip } from '../components/admin/TraineeVisibilityTip.jsx'
import { LoadingSpinner } from '../components/LoadingSpinner.jsx'

export function AdminCourseDetailPage() {
  const { showToast } = useToast()
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
  const [metaSaving, setMetaSaving] = useState(false)
  const [moduleAdding, setModuleAdding] = useState(false)
  const [validating, setValidating] = useState(false)
  const [publishBusy, setPublishBusy] = useState(false)
  const [withdrawingId, setWithdrawingId] = useState(null)

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
    if (!title.trim() || !description.trim()) {
      const msg = 'Course title and description are required.'
      setError(msg)
      showToast({ variant: 'error', message: msg })
      return
    }
    if (dueDate) {
      const cmp = new Date(dueDate)
      cmp.setHours(0, 0, 0, 0)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (cmp < today) {
        const msg = 'Due date cannot be in the past.'
        setError(msg)
        showToast({ variant: 'error', message: msg })
        return
      }
    }
    setMetaSaving(true)
    try {
      await api.patch(`/api/courses/${courseId}`, {
        title: title.trim(),
        description: description.trim(),
        dueDate: dueDate || null,
      })
      await load()
      showToast({ variant: 'success', message: 'Course details saved.' })
    } catch (err) {
      const msg = err.response?.data?.error || 'Save failed.'
      setError(msg)
      showToast({ variant: 'error', message: msg })
    } finally {
      setMetaSaving(false)
    }
  }

  async function addModule(e) {
    e.preventDefault()
    setError('')
    setModuleAdding(true)
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
      showToast({ variant: 'success', message: 'Module added.' })
    } catch (err) {
      const msg = err.response?.data?.error || 'Could not add module.'
      setError(msg)
      showToast({ variant: 'error', message: msg })
    } finally {
      setModuleAdding(false)
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
    setValidating(true)
    try {
      const { data } = await api.get(`/api/courses/${courseId}/validate`)
      setValidation(data)
      if (data.valid) {
        showToast({ variant: 'success', message: 'Course looks good to publish.' })
      } else {
        showToast({ variant: 'info', message: 'Fix the listed items before publishing.' })
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Validation failed.')
    } finally {
      setValidating(false)
    }
  }

  async function publish() {
    setError('')
    setPublishBusy(true)
    try {
      await api.patch(`/api/courses/${courseId}/status`, { status: 'published' })
      await load()
      showToast({ variant: 'success', message: 'Course published.' })
    } catch (err) {
      const issues = err.response?.data?.issues
      if (issues) setValidation({ valid: false, issues })
      setError(err.response?.data?.error || 'Publish failed.')
    } finally {
      setPublishBusy(false)
    }
  }

  async function unpublish() {
    setError('')
    setPublishBusy(true)
    try {
      await api.patch(`/api/courses/${courseId}/status`, { status: 'draft' })
      await load()
      showToast({ variant: 'success', message: 'Course moved back to draft.' })
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed.')
    } finally {
      setPublishBusy(false)
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
      showToast({ variant: 'success', message: 'Trainees added to this course.' })
    } catch (err) {
      setError(err.response?.data?.error || 'Enrollment failed.')
    } finally {
      setEnrollBusy(false)
    }
  }

  if (!course) {
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
    return <LoadingSpinner label="Loading course" />
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/admin/courses')}
            className="ui-press text-xs font-semibold text-stone-400 transition-colors duration-200 ease-soft hover:text-stone-700"
          >
            ← All courses
          </button>
          <h1 className="font-display text-2xl font-semibold text-stone-900">
            {course.title}
          </h1>
          <p className="mt-0.5 text-sm text-stone-500">Status: {course.status}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={validating || publishBusy}
            onClick={runValidate}
            className="ui-btn-secondary"
          >
            {validating ? 'Checking…' : 'Validate'}
          </button>
          {course.status === 'published' ? (
            <button
              type="button"
              disabled={publishBusy || validating}
              onClick={unpublish}
              className="ui-press rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-950 shadow-warm-sm transition-colors duration-200 ease-soft hover:bg-amber-100 disabled:pointer-events-none disabled:opacity-50"
            >
              {publishBusy ? 'Updating…' : 'Unpublish'}
            </button>
          ) : (
            <button
              type="button"
              disabled={publishBusy || validating}
              onClick={publish}
              className="ui-btn-primary"
            >
              {publishBusy ? 'Publishing…' : 'Publish'}
            </button>
          )}
        </div>
      </div>

      {validation && !validation.valid ? (
        <div className="motion-safe:animate-in-up motion-reduce:animate-none rounded-2xl border border-amber-200 bg-amber-50/80 p-5 text-sm text-amber-950 shadow-warm-sm">
          <p className="font-semibold">Publish blockers</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {(validation.issues || []).map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p
          className="motion-safe:animate-in-up motion-reduce:animate-none rounded-xl bg-red-50/90 px-4 py-2.5 text-sm text-red-800 shadow-warm-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <TraineeVisibilityTip />

      {course.status !== 'published' ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-5 py-3.5 text-sm text-amber-950 shadow-warm-sm">
          <p className="font-semibold">This course is not published yet</p>
          <p className="mt-1 text-amber-900/90">
            Trainees who are enrolled will not see it on their dashboard until you run{' '}
            <strong>Validate</strong> and then <strong>Publish</strong> above.
          </p>
        </div>
      ) : null}

      <form
        onSubmit={saveCourseMeta}
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
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-stone-600">Due date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="ui-input w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
          />
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={metaSaving} className="ui-btn-primary !bg-stone-900">
            {metaSaving ? 'Saving…' : 'Save course'}
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <p className="ui-section-label">Modules</p>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="modules">
            {(provided) => (
              <ul
                className="space-y-2 rounded-2xl border border-stone-200/60 bg-white/60 p-3 shadow-warm-sm"
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
                        className="flex items-center justify-between rounded-xl border border-stone-200/80 bg-white px-4 py-3 text-sm shadow-warm-sm transition-[box-shadow,border-color] duration-200 ease-soft hover:border-stone-300 hover:shadow-warm"
                      >
                        <div>
                          <p className="font-medium text-stone-900">{m.title}</p>
                          <p className="text-xs text-stone-500">
                            Order {m.order}
                            <span
                              className={
                                m.status === 'published'
                                  ? ' ml-2 font-medium text-emerald-700'
                                  : ' ml-2 font-medium text-amber-700'
                              }
                            >
                              · {m.status}
                            </span>
                          </p>
                        </div>
                        <Link
                          to={`/admin/courses/${courseId}/modules/${m.id}`}
                          className="ui-link text-xs font-semibold text-deep underline-offset-2 hover:underline"
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

        <form
          onSubmit={addModule}
          className="flex flex-col gap-3 rounded-2xl border border-dashed border-stone-300/80 p-5 transition-[border-color,box-shadow] duration-300 ease-soft hover:border-clay/40 hover:shadow-warm-sm md:flex-row md:items-end"
        >
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium text-stone-600">New module title</label>
            <input
              value={modTitle}
              onChange={(e) => setModTitle(e.target.value)}
              className="ui-input w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
            />
          </div>
          <div className="flex-[2] space-y-1.5">
            <label className="text-xs font-medium text-stone-600">Description</label>
            <input
              value={modDesc}
              onChange={(e) => setModDesc(e.target.value)}
              className="ui-input w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
            />
          </div>
          <button type="submit" disabled={moduleAdding} className="ui-btn-primary whitespace-nowrap">
            {moduleAdding ? 'Adding…' : 'Add module'}
          </button>
        </form>
      </section>

      <section className="space-y-6">
        <div className="ui-surface overflow-hidden !p-0">
          <div className="border-b border-stone-100/80 px-5 py-4">
            <h2 className="font-display text-base font-semibold text-stone-900">
              Enrolled on this course
            </h2>
            <p className="mt-0.5 text-sm text-stone-500">
              {enrollments.filter((e) => e.status === 'active').length} active ·{' '}
              {enrollments.length} total records (includes withdrawn / completed)
            </p>
          </div>
          {enrollments.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-stone-500">
              No enrollments yet. Add trainees below.
            </p>
          ) : (
            <ul className="divide-y divide-stone-100/80 px-2 py-2">
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
                          disabled={withdrawingId === en.id}
                          className="ui-press rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-800 shadow-warm-sm transition-colors duration-200 ease-soft hover:bg-red-50 disabled:pointer-events-none disabled:opacity-50"
                          onClick={async () => {
                            setWithdrawingId(en.id)
                            setError('')
                            try {
                              await api.patch(`/api/enrollments/${en.id}`, {
                                status: 'withdrawn',
                              })
                              await load()
                              showToast({ variant: 'success', message: 'Enrollment withdrawn.' })
                            } catch (err) {
                              setError(err.response?.data?.error || 'Withdraw failed.')
                            } finally {
                              setWithdrawingId(null)
                            }
                          }}
                        >
                          {withdrawingId === en.id ? 'Withdrawing…' : 'Withdraw'}
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

        <div className="ui-surface p-5">
          <h2 className="font-display text-base font-semibold text-stone-900">
            Add trainees to this course
          </h2>
          <p className="mt-1 text-sm text-stone-500">
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
                className="ui-input w-full flex-1 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectAllVisible}
                  disabled={!filteredTraineesToAdd.length}
                  className="ui-btn-secondary !px-3 !py-2 !text-xs"
                >
                  Select all shown
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={!selectedTrainees.length}
                  className="ui-btn-secondary !px-3 !py-2 !text-xs"
                >
                  Clear selection
                </button>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-stone-200/80 bg-white">
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
                        <label className="flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-stone-50">
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
            <div className="flex flex-col gap-3 border-t border-stone-200/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-stone-500">
                <span className="font-semibold text-stone-900">{selectedTrainees.length}</span>{' '}
                selected
              </p>
              <button
                type="submit"
                disabled={!selectedTrainees.length || enrollBusy}
                className="ui-btn-primary"
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
