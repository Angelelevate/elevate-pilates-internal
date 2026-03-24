import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api.js'

function DueDateBanner({ dueDate }) {
  const [now, setNow] = useState(null)
  useEffect(() => {
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  if (!dueDate || now === null) return null
  const d = new Date(dueDate)
  const days = Math.ceil((d - now) / (1000 * 60 * 60 * 24))
  let tone = 'border-emerald-200 bg-emerald-50 text-emerald-950'
  if (days <= 14 && days > 7) tone = 'border-amber-200 bg-amber-50 text-amber-950'
  if (days <= 7) tone = 'border-red-200 bg-red-50 text-red-950'
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${tone}`}>
      <p className="font-semibold">Course due date</p>
      <p className="text-xs opacity-90">
        {d.toLocaleDateString()} ({days > 0 ? `${days} days left` : 'Due'})
      </p>
    </div>
  )
}

export function TraineeDashboardPage() {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [lockMsg, setLockMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data } = await api.get('/api/my/courses')
        if (!cancelled) setRows(data)
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || 'Could not load courses.')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return <p className="text-sm text-red-700">{error}</p>
  }

  if (!rows.length) {
    return (
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold text-stone-900">Dashboard</h1>
        <p className="text-sm text-stone-600">
          You are not enrolled in a published course yet. Your administrator will assign one.
        </p>
      </div>
    )
  }

  const primary = rows[0]

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold text-stone-900">
          {primary.course?.title || 'Your course'}
        </h1>
        <p className="text-sm text-stone-600">{primary.course?.description}</p>
      </div>

      <DueDateBanner dueDate={primary.enrollment?.dueDate || primary.course?.dueDate} />

      <div className="rounded-2xl border border-stone-200/80 bg-white/80 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-stone-800">Overall progress</span>
          <span className="text-stone-600">{primary.courseProgressPercent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full rounded-full bg-sage transition-all"
            style={{ width: `${primary.courseProgressPercent}%` }}
          />
        </div>
      </div>

      {lockMsg ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {lockMsg}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {primary.modules?.map((m) =>
          m.unlocked ? (
            <Link
              key={m.id}
              to={`/courses/${primary.course.id}/modules/${m.id}`}
              className="block rounded-2xl border border-stone-200/80 bg-white/90 px-4 py-4 shadow-sm transition hover:border-clay/60"
              onClick={() => setLockMsg('')}
            >
              <ModuleCardBody m={m} />
            </Link>
          ) : (
            <button
              key={m.id}
              type="button"
              onClick={() =>
                setLockMsg(
                  m.prerequisiteTitle
                    ? `Complete “${m.prerequisiteTitle}” to unlock this module.`
                    : 'This module is locked.',
                )
              }
              className="w-full rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-4 text-left shadow-sm opacity-70 transition hover:opacity-90"
            >
              <ModuleCardBody m={m} locked />
            </button>
          ),
        )}
      </div>
    </div>
  )
}

function ModuleCardBody({ m, locked }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-stone-900">{m.title}</p>
          <p className="text-xs text-stone-500 line-clamp-2">{m.description}</p>
        </div>
        {locked ? (
          <span className="text-lg" aria-hidden>
            🔒
          </span>
        ) : m.status === 'completed' ? (
          <span className="text-lg text-emerald-700" aria-hidden>
            ✓
          </span>
        ) : null}
      </div>
      <p className="text-xs text-stone-600">
        {m.completedLessonCount} / {m.lessonCount} lessons
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
        <div
          className="h-full rounded-full bg-deep/80"
          style={{ width: `${m.progressPercent}%` }}
        />
      </div>
    </>
  )
}
