import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../services/api.js'
import { useToast } from '../contexts/ToastContext.jsx'
import { LoadingSpinner } from '../components/LoadingSpinner.jsx'

export function OverdueReportPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()

  useEffect(() => {
    api.get('/api/admin/dashboard/reports/overdue')
      .then(({ data }) => setRows(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function sendReminder(traineeId, enrollmentId) {
    try {
      await api.post('/api/admin/reminders/send', { traineeId, enrollmentId })
      showToast({ variant: 'success', message: 'Reminder sent.' })
    } catch (err) {
      showToast({ variant: 'error', message: err.response?.data?.error || 'Send failed.' })
    }
  }

  if (loading) return <LoadingSpinner label="Loading report" />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="ui-section-label">Reports</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Overdue Trainees</h1>
        </div>
        <button type="button" onClick={() => window.open(`${api.defaults.baseURL}/api/admin/export/overdue`, '_blank')}
          className="ui-btn-secondary min-h-[44px]">Export CSV</button>
      </div>
      {rows.length === 0 ? (
        <div className="ui-surface p-8 text-center text-sm text-stone-500">No overdue trainees.</div>
      ) : (
        <div className="ui-surface overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="border-b border-stone-200/60 bg-stone-50/50">
              <tr>
                <th className="px-4 py-3 font-medium text-stone-600">Name</th>
                <th className="px-4 py-3 font-medium text-stone-600">Progress</th>
                <th className="px-4 py-3 font-medium text-stone-600">Due Date</th>
                <th className="px-4 py-3 font-medium text-stone-600">Days Overdue</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((r) => (
                <tr key={r.traineeId}>
                  <td className="px-4 py-3">
                    <Link to={`/admin/trainees/${r.traineeId}`} className="font-medium text-deep hover:underline">{r.name}</Link>
                    <p className="text-xs text-stone-500">{r.email}</p>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{r.progress}%</td>
                  <td className="px-4 py-3 text-stone-600">{r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 font-semibold text-red-600">{r.daysOverdue}d</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => sendReminder(r.traineeId, r.enrollmentId)}
                      className="text-sm font-semibold text-deep hover:underline">Send Reminder</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function AssessmentReportPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/admin/dashboard/reports/assessments')
      .then(({ data }) => setRows(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner label="Loading report" />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="ui-section-label">Reports</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Assessment Performance</h1>
        </div>
        <button type="button" onClick={() => window.open(`${api.defaults.baseURL}/api/admin/export/assessments`, '_blank')}
          className="ui-btn-secondary min-h-[44px]">Export CSV</button>
      </div>
      {rows.length === 0 ? (
        <div className="ui-surface p-8 text-center text-sm text-stone-500">No assessment data yet.</div>
      ) : (
        <div className="ui-surface overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-stone-200/60 bg-stone-50/50">
              <tr>
                <th className="px-4 py-3 font-medium text-stone-600">Assessment</th>
                <th className="px-4 py-3 font-medium text-stone-600">Type</th>
                <th className="px-4 py-3 font-medium text-stone-600">Total Attempts</th>
                <th className="px-4 py-3 font-medium text-stone-600">Unique Trainees</th>
                <th className="px-4 py-3 font-medium text-stone-600">Avg Score</th>
                <th className="px-4 py-3 font-medium text-stone-600">Pass Rate</th>
                <th className="px-4 py-3 font-medium text-stone-600">1st Attempt Pass</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((r) => (
                <tr key={r.quizId}>
                  <td className="px-4 py-3 font-medium text-stone-800">{r.title}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.type === 'exam' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                      {r.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{r.totalAttempts}</td>
                  <td className="px-4 py-3 text-stone-600">{r.uniqueTrainees}</td>
                  <td className="px-4 py-3 font-semibold text-stone-800">{r.averageScore}%</td>
                  <td className="px-4 py-3 text-stone-600">{r.passRate != null ? `${r.passRate}%` : '—'}</td>
                  <td className="px-4 py-3 text-stone-600">{r.firstAttemptPassRate != null ? `${r.firstAttemptPassRate}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function CourseCompletionReportPage() {
  const [params] = useSearchParams()
  const [report, setReport] = useState(null)
  const [courses, setCourses] = useState([])
  const [courseId, setCourseId] = useState(params.get('courseId') || '')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/courses').then(({ data }) => {
      setCourses(data)
      if (!courseId && data.length > 0) setCourseId(data[0].id)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!courseId) return
    setLoading(true)
    api.get(`/api/admin/dashboard/reports/course-completion?courseId=${courseId}`)
      .then(({ data }) => setReport(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [courseId])

  if (loading && !report) return <LoadingSpinner label="Loading report" />

  return (
    <div className="space-y-6">
      <div>
        <p className="ui-section-label">Reports</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Course Completion</h1>
      </div>
      <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="ui-input max-w-xs">
        {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
      {report && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total Enrolled', value: report.totalEnrolled },
            { label: 'Active', value: report.active },
            { label: 'Completed', value: report.completed, color: 'text-emerald-700' },
            { label: 'Completion Rate', value: `${report.completionRate}%`, color: 'text-deep' },
            { label: 'Avg Completion Days', value: report.averageCompletionDays || '—' },
            { label: 'Withdrawn', value: report.withdrawn },
            { label: 'Overdue', value: report.overdue, color: report.overdue > 0 ? 'text-red-700' : '' },
          ].map((item, i) => (
            <div key={i} className="ui-surface p-4 text-center">
              <p className="text-xs font-semibold uppercase text-stone-400">{item.label}</p>
              <p className={`mt-1 font-display text-2xl font-bold ${item.color || 'text-stone-900'}`}>{item.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
