import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadingSpinner } from '../components/LoadingSpinner.jsx'
import { api } from '../services/api.js'

function DueDateBanner({ dueDate, courseComplete }) {
  const [now, setNow] = useState(null)
  useEffect(() => {
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  if (!dueDate || now === null) return null
  const d = new Date(dueDate)
  const days = Math.ceil((d - now) / (1000 * 60 * 60 * 24))
  let tone = 'border-emerald-200 bg-emerald-50/80 text-emerald-950'
  let icon = '✓'
  let sub = `${d.toLocaleDateString()} (${days > 0 ? `${days} days left` : days === 0 ? 'Due today' : `${Math.abs(days)} days ago`})`
  if (courseComplete) {
    sub = `${d.toLocaleDateString()} — course completed; due date is for your records.`
  } else {
    if (days <= 14 && days > 7) {
      tone = 'border-amber-200 bg-amber-50/80 text-amber-950'
      icon = '⏳'
    }
    if (days <= 7) {
      tone = 'border-red-200 bg-red-50/80 text-red-950'
      icon = '⚠'
    }
  }
  return (
    <div
      className={`motion-safe:animate-in-up motion-reduce:animate-none flex items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-warm-sm ${tone}`}
    >
      <span className="text-lg" aria-hidden>{icon}</span>
      <div>
        <p className="text-sm font-semibold">Course due date</p>
        <p className="text-xs opacity-80">{sub}</p>
      </div>
    </div>
  )
}

export function TraineeDashboardPage() {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [lockMsg, setLockMsg] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data } = await api.get('/api/my/courses')
        if (!cancelled) setRows(data)
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || 'Could not load courses.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <LoadingSpinner label="Loading your courses" />
  }

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

  if (!rows.length) {
    return (
      <div className="ui-surface p-8 text-center">
        <h1 className="font-display text-2xl font-semibold text-stone-900">Home</h1>
        <p className="mt-2 text-sm text-stone-600">
          You are not enrolled in a published course yet. Your administrator will assign one.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <div>
        <p className="ui-section-label">Learning</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-stone-900">Your courses</h1>
        <p className="mt-1 text-sm text-stone-600">
          Select a course to continue. Each course has its own modules and progress.
        </p>
      </div>

      {rows.map((row) => (
        <section key={row.enrollment?.id ?? row.course?.id} className="space-y-4">
          <div className="ui-surface p-6">
            <p className="ui-section-label">Course</p>
            <h2 className="mt-2 font-display text-xl font-semibold text-stone-900">
              {row.course?.title || 'Course'}
            </h2>
            <p className="mt-1 text-sm text-stone-600">{row.course?.description}</p>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-stone-700">Overall progress</span>
                <span className="rounded-md bg-sage-50 px-2 py-0.5 text-xs font-semibold text-sage-700">
                  {row.courseProgressPercent}%
                </span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sage to-deep transition-[width] duration-700 ease-soft-out"
                  style={{ width: `${row.courseProgressPercent}%` }}
                />
              </div>
            </div>
          </div>

          <DueDateBanner
            dueDate={row.enrollment?.dueDate || row.course?.dueDate}
            courseComplete={row.courseProgressPercent >= 100}
          />

          {lockMsg ? (
            <p className="motion-safe:animate-in-up motion-reduce:animate-none rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 shadow-warm-sm">
              {lockMsg}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {row.modules?.map((m, i) =>
              m.unlocked ? (
                <Link
                  key={`${row.course?.id}-${m.id}`}
                  to={`/courses/${row.course?.id}/modules/${m.id}`}
                  className="ui-card block rounded-2xl border border-stone-200/60 bg-white/90 px-5 py-5 shadow-card-elevated hover:border-clay/50"
                  onClick={() => setLockMsg('')}
                  style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
                >
                  <ModuleCardBody m={m} />
                </Link>
              ) : (
                <button
                  key={`${row.course.id}-${m.id}`}
                  type="button"
                  onClick={() =>
                    setLockMsg(
                      m.prerequisiteTitle
                        ? `Complete "${m.prerequisiteTitle}" to unlock this module.`
                        : 'This module is locked.',
                    )
                  }
                  className="ui-press w-full rounded-2xl border border-stone-200/50 bg-stone-50/60 px-5 py-5 text-left opacity-65 shadow-warm-sm transition-[opacity,transform] duration-200 ease-soft hover:opacity-80"
                >
                  <ModuleCardBody m={m} locked />
                </button>
              ),
            )}
          </div>
        </section>
      ))}
    </div>
  )
}

function ModuleCardBody({ m, locked }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-stone-900">{m.title}</p>
          <p className="mt-0.5 text-xs text-stone-500 line-clamp-2">{m.description}</p>
        </div>
        {locked ? (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs" aria-hidden>
            🔒
          </span>
        ) : m.status === 'completed' ? (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm text-emerald-700" aria-hidden>
            ✓
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-stone-500">
        <span>{m.completedLessonCount} / {m.lessonCount} lessons</span>
        <span className="font-medium text-stone-600">{m.progressPercent}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-deep/70 to-deep transition-[width] duration-700 ease-soft-out"
          style={{ width: `${m.progressPercent}%` }}
        />
      </div>
    </>
  )
}
