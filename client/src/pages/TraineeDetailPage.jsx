import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../services/api.js'
import { useToast } from '../contexts/ToastContext.jsx'
import { LoadingSpinner } from '../components/LoadingSpinner.jsx'

export function TraineeDetailPage() {
  const { traineeId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const { data: d } = await api.get(`/api/admin/dashboard/trainees/${traineeId}/progress`)
      setData(d)
    } catch {
      showToast({ variant: 'error', message: 'Failed to load trainee.' })
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [traineeId])

  async function sendReminder() {
    const activeEnrollment = data?.courses?.find((c) => c.status === 'active' || c.status === 'overdue')?.enrollment
    if (!activeEnrollment?.id) return
    if (!confirm('Send a reminder email to this trainee?')) return
    try {
      await api.post('/api/admin/reminders/send', {
        traineeId,
        enrollmentId: activeEnrollment.id,
      })
      showToast({ variant: 'success', message: 'Reminder sent.' })
      load()
    } catch (err) {
      showToast({ variant: 'error', message: err.response?.data?.error || 'Send failed.' })
    }
  }

  async function exportAttempts() {
    try {
      const { data: blob } = await api.get(`/api/admin/dashboard/export/trainees/${traineeId}/attempts`, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `trainee-${traineeId}-attempts.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      showToast({ variant: 'error', message: 'Export failed.' })
    }
  }

  if (loading) return <LoadingSpinner label="Loading trainee" />
  if (!data) return <p className="text-sm text-stone-500">Trainee not found.</p>

  const { user, courses = [], attempts, activity, reminders } = data
  const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : traineeId

  // Find the first active enrollment for reminder sending
  const activeEnrollment = courses.find((c) => c.status === 'active' || c.status === 'overdue')?.enrollment

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" onClick={() => navigate(-1)} className="ui-link text-sm text-stone-500 hover:underline">← Trainees</button>
          <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">{name}</h1>
          {user?.email && <p className="text-sm text-stone-500">{user.email}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={sendReminder} disabled={!activeEnrollment} className="ui-btn-secondary min-h-[44px] disabled:opacity-40">Send Reminder</button>
          <button type="button" onClick={exportAttempts} className="ui-btn-secondary min-h-[44px]">Export Attempts</button>
        </div>
      </div>

      {/* Per-course sections */}
      {courses.map((course) => (
        <div key={course.courseId} className="space-y-4">
          <div className="ui-surface p-5">
            <h2 className="font-display text-lg font-semibold text-stone-900">{course.courseTitle}</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs font-semibold uppercase text-stone-400">Status</p>
                <p className="mt-1 text-lg font-semibold text-stone-900 capitalize">{course.status || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-stone-400">Progress</p>
                <p className="mt-1 text-lg font-semibold text-deep">{course.courseProgress?.percentComplete || 0}%</p>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-deep" style={{ width: `${course.courseProgress?.percentComplete || 0}%` }} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-stone-400">Enrolled</p>
                <p className="mt-1 text-sm text-stone-700">{course.enrollment?.enrolledAt ? new Date(course.enrollment.enrolledAt).toLocaleDateString() : '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-stone-400">Due Date</p>
                <p className="mt-1 text-sm text-stone-700">{course.enrollment?.dueDate ? new Date(course.enrollment.dueDate).toLocaleDateString() : '—'}</p>
              </div>
            </div>
          </div>

          {/* Module breakdown for this course */}
          {course.modules?.length > 0 && (
            <div className="ui-surface overflow-hidden">
              <h3 className="border-b border-stone-200/60 px-5 py-3 font-display text-base font-semibold text-stone-900">Module Progress</h3>
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50/50">
                  <tr>
                    <th className="px-4 py-2.5 font-medium text-stone-600">Module</th>
                    <th className="px-4 py-2.5 font-medium text-stone-600">Status</th>
                    <th className="px-4 py-2.5 font-medium text-stone-600">Progress</th>
                    <th className="px-4 py-2.5 font-medium text-stone-600">Lessons</th>
                    <th className="px-4 py-2.5 font-medium text-stone-600">Exam Score</th>
                    <th className="px-4 py-2.5 font-medium text-stone-600">Attempts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {course.modules.map((m) => (
                    <tr key={m.moduleId}>
                      <td className="px-4 py-2.5 font-medium text-stone-800">{m.title}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          m.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                          m.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-stone-100 text-stone-500'
                        }`}>{m.status.replace('_', ' ')}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-stone-100">
                            <div className="h-full rounded-full bg-deep" style={{ width: `${m.percentComplete}%` }} />
                          </div>
                          <span className="text-xs text-stone-600">{m.percentComplete}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-stone-600">{m.completedLessons}/{m.totalLessons}</td>
                      <td className="px-4 py-2.5 text-stone-600">{m.examScore != null ? `${m.examScore}%` : 'N/A'}</td>
                      <td className="px-4 py-2.5 text-stone-600">{m.examAttempts || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {courses.length === 0 && (
        <div className="ui-surface p-8 text-center text-sm text-stone-500">No course enrollments found.</div>
      )}

      {/* Assessment history */}
      <div className="ui-surface overflow-hidden">
        <h2 className="border-b border-stone-200/60 px-5 py-3 font-display text-lg font-semibold text-stone-900">Assessment History</h2>
        {attempts?.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50/50">
              <tr>
                <th className="px-4 py-2.5 font-medium text-stone-600">Assessment</th>
                <th className="px-4 py-2.5 font-medium text-stone-600">Type</th>
                <th className="px-4 py-2.5 font-medium text-stone-600">Attempt</th>
                <th className="px-4 py-2.5 font-medium text-stone-600">Score</th>
                <th className="px-4 py-2.5 font-medium text-stone-600">Result</th>
                <th className="px-4 py-2.5 font-medium text-stone-600">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {attempts.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2.5 font-medium text-stone-800">{a.quizTitle}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${a.quizType === 'exam' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                      {a.quizType}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-stone-600">#{a.attemptNumber}</td>
                  <td className="px-4 py-2.5 font-semibold text-stone-800">{a.score ?? '—'}%</td>
                  <td className="px-4 py-2.5">
                    {a.passed === true && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Pass</span>}
                    {a.passed === false && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Fail</span>}
                    {a.passed == null && <span className="text-xs text-stone-400">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-stone-500">
                    {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-5 py-4 text-sm text-stone-500">No assessment attempts yet.</p>
        )}
      </div>

      {/* Reminder history */}
      {reminders?.length > 0 && (
        <div className="ui-surface overflow-hidden">
          <h2 className="border-b border-stone-200/60 px-5 py-3 font-display text-lg font-semibold text-stone-900">Reminders Sent</h2>
          <div className="divide-y divide-stone-100">
            {reminders.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.type === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {r.type}
                  </span>
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${r.trigger === 'manual' ? 'bg-purple-100 text-purple-700' : 'bg-stone-100 text-stone-600'}`}>
                    {r.trigger}
                  </span>
                  <span className="ml-2 text-stone-600">#{r.reminderNumber} — {r.progressAtSend}% at send</span>
                </div>
                <span className="text-xs text-stone-400">{r.sentAt ? new Date(r.sentAt).toLocaleDateString() : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity timeline */}
      {activity?.length > 0 && (
        <div className="ui-surface p-5">
          <h2 className="font-display text-lg font-semibold text-stone-900">Activity Timeline</h2>
          <div className="mt-3 space-y-2">
            {activity.slice(0, 20).map((ev, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className={`h-2 w-2 shrink-0 rounded-full ${
                  ev.type === 'exam_passed' ? 'bg-emerald-500' :
                  ev.type === 'exam_failed' ? 'bg-red-500' :
                  'bg-blue-400'
                }`} />
                <span className="text-stone-700">
                  {ev.type === 'lesson_progress' ? `${ev.status === 'completed' ? 'Completed' : 'Started'} ${ev.lessonType} lesson` :
                   ev.type === 'exam_passed' ? `Passed exam (${ev.score}%)` :
                   ev.type === 'exam_failed' ? `Failed exam (${ev.score}%)` :
                   `Submitted quiz (${ev.score}%)`}
                </span>
                {ev.timestamp && <span className="ml-auto text-xs text-stone-400">{new Date(ev.timestamp).toLocaleDateString()}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
