import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api.js'
import { LoadingSpinner } from '../components/LoadingSpinner.jsx'

function SummaryCard({ label, value, color = 'text-stone-900', sub }) {
  return (
    <div className="ui-surface flex flex-col items-center justify-center p-5 text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">{label}</p>
      <p className={`mt-1 font-display text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-stone-500">{sub}</p>}
    </div>
  )
}

export function AdminDashboardPage() {
  const [summary, setSummary] = useState(null)
  const [atRisk, setAtRisk] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [s, r, a] = await Promise.all([
          api.get('/api/admin/dashboard/summary'),
          api.get('/api/admin/dashboard/at-risk'),
          api.get('/api/admin/dashboard/recent-activity?limit=10'),
        ])
        setSummary(s.data)
        setAtRisk(r.data)
        setActivity(a.data)
      } catch {
        // fail silently
      } finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) return <LoadingSpinner label="Loading dashboard" />

  return (
    <div className="space-y-8">
      <div>
        <p className="ui-section-label">Admin</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Dashboard</h1>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard label="Total Trainees" value={summary.totalTrainees} />
          <SummaryCard label="Enrolled" value={summary.enrolled} color="text-blue-700" />
          <SummaryCard label="Completed" value={summary.completed} color="text-emerald-700" />
          <SummaryCard label="Overdue" value={summary.overdue} color={summary.overdue > 0 ? 'text-red-700' : 'text-stone-900'} />
          <SummaryCard label="Avg Progress" value={`${summary.averageProgress}%`} color="text-deep" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* At-risk trainees */}
        <div className="ui-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-stone-900">At-Risk Trainees</h2>
            <Link to="/admin/reports/overdue" className="text-sm font-semibold text-deep hover:underline">View all</Link>
          </div>
          {atRisk.length === 0 ? (
            <p className="mt-4 text-sm text-stone-500">No at-risk trainees. Great!</p>
          ) : (
            <div className="mt-3 space-y-2">
              {atRisk.slice(0, 5).map((t) => (
                <Link key={t.traineeId} to={`/admin/trainees/${t.traineeId}`}
                  className="flex items-center justify-between rounded-xl border border-stone-100 px-3 py-2.5 text-sm transition-colors hover:bg-stone-50">
                  <div>
                    <p className="font-medium text-stone-800">{t.name}</p>
                    <p className="text-xs text-stone-500">{t.progress}% complete</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${t.isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {t.isOverdue ? `${t.daysOverdue}d overdue` : 'Low progress'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="ui-surface p-5">
          <h2 className="font-display text-lg font-semibold text-stone-900">Recent Activity</h2>
          {activity.length === 0 ? (
            <p className="mt-4 text-sm text-stone-500">No recent activity yet.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {activity.map((ev, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl px-3 py-2 text-sm">
                  <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${
                    ev.type === 'exam_passed' ? 'bg-emerald-100 text-emerald-700' :
                    ev.type === 'exam_failed' ? 'bg-red-100 text-red-700' :
                    ev.type === 'lesson_completed' ? 'bg-blue-100 text-blue-700' :
                    'bg-stone-100 text-stone-600'
                  }`}>
                    {ev.type === 'exam_passed' ? '✓' : ev.type === 'exam_failed' ? '✗' : ev.type === 'lesson_completed' ? '📘' : '✏️'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-stone-700">
                      <span className="font-medium">{ev.traineeName}</span>{' '}
                      {ev.type === 'lesson_completed' ? 'completed a lesson' :
                       ev.type === 'exam_passed' ? `passed an exam (${ev.score}%)` :
                       ev.type === 'exam_failed' ? `failed an exam (${ev.score}%)` :
                       `submitted a quiz (${ev.score}%)`}
                    </p>
                    {ev.timestamp && <p className="text-xs text-stone-400">{new Date(ev.timestamp).toLocaleString()}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/admin/trainees" className="ui-surface flex items-center gap-3 p-4 transition-colors hover:bg-stone-50">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage-100 text-sage-700">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </span>
          <span className="font-medium text-stone-800">Trainee Performance</span>
        </Link>
        <Link to="/admin/reports/overdue" className="ui-surface flex items-center gap-3 p-4 transition-colors hover:bg-stone-50">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-clay-100 text-clay-700">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
            </svg>
          </span>
          <span className="font-medium text-stone-800">Overdue Report</span>
        </Link>
        <Link to="/admin/reports/assessments" className="ui-surface flex items-center gap-3 p-4 transition-colors hover:bg-stone-50">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-deep-100 text-deep-500">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </span>
          <span className="font-medium text-stone-800">Assessment Report</span>
        </Link>
        <Link to="/admin/reminders" className="ui-surface flex items-center gap-3 p-4 transition-colors hover:bg-stone-50">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage-50 text-sage-600">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </span>
          <span className="font-medium text-stone-800">Reminders</span>
        </Link>
      </div>
    </div>
  )
}
