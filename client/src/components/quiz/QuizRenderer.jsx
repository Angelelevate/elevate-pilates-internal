import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../services/api.js'
import { useToast } from '../../contexts/ToastContext.jsx'

/**
 * Unified quiz/exam renderer. Mounted inside TraineeLessonPage.
 * Handles both practice quizzes (instant grading, single page) and
 * formal exams (end-of-assessment, one-per-page, timer, retake limits).
 */
export function QuizRenderer({ quizId, lessonId, moduleId, courseId, quizType, onComplete }) {
  const { showToast } = useToast()
  const [phase, setPhase] = useState('loading') // loading | start | active | results | locked
  const [attempt, setAttempt] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [currentIdx, setCurrentIdx] = useState(0)
  const [results, setResults] = useState(null)
  const [history, setHistory] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [starting, setStarting] = useState(false)
  const [timeLeft, setTimeLeft] = useState(null)
  const timerRef = useRef(null)
  const autoSubmittedRef = useRef(false)
  const handleSubmitRef = useRef(null)

  const loadHistory = useCallback(async () => {
    if (!quizId) return
    try {
      setTimeLeft(null)
      clearInterval(timerRef.current)
      autoSubmittedRef.current = false
      const { data } = await api.get(`/api/my/quizzes/${quizId}/attempts`)
      setHistory(data)
      const submitted = data.filter((a) => a.status === 'submitted' || a.status === 'timed_out')
      const inProgress = data.find((a) => a.status === 'in_progress')

      if (inProgress) {
        const { data: det } = await api.get(`/api/my/attempts/${inProgress.id}`)
        setAttempt(det)
        setQuestions(det.questions || [])
        if (det.timeLimitMinutes) {
          const started = new Date(det.startedAt)
          const expires = new Date(started.getTime() + det.timeLimitMinutes * 60000)
          const remaining = Math.max(0, Math.floor((expires - Date.now()) / 1000))
          if (remaining <= 0) {
            await submitAttempt(inProgress.id, {})
            return
          }
          setTimeLeft(remaining)
        }
        setPhase('active')
        return
      }

      if (quizType === 'exam' && submitted.length >= 3) {
        const hasPassing = submitted.some((a) => a.passed)
        if (hasPassing) {
          const best = submitted.reduce((a, b) => (a.score || 0) > (b.score || 0) ? a : b)
          setResults(best)
          setPhase('results')
        } else {
          setPhase('locked')
        }
        return
      }

      if (submitted.length > 0) {
        const last = submitted[submitted.length - 1]
        if (last.passed || quizType === 'quiz') {
          const { data: det } = await api.get(`/api/my/attempts/${last.id}`)
          setResults(det)
          setQuestions(det.questions || [])
          setPhase('results')
          return
        }
      }

      setPhase('start')
    } catch {
      showToast({ variant: 'error', message: 'Could not load assessment data.' })
      setPhase('start')
    }
  }, [quizId, quizType])

  useEffect(() => { loadHistory() }, [loadHistory])

  // Timer — reset `timeLeft` to null between attempts so this effect re-fires
  const timerGeneration = useRef(0)
  useEffect(() => {
    if (timeLeft == null || timeLeft <= 0) return
    const gen = ++timerGeneration.current
    timerRef.current = setInterval(() => {
      if (gen !== timerGeneration.current) return
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          if (!autoSubmittedRef.current) {
            autoSubmittedRef.current = true
            handleSubmitRef.current?.(true)
          }
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [timeLeft])

  async function startAttempt() {
    setStarting(true)
    try {
      const { data } = await api.post(`/api/my/quizzes/${quizId}/attempts`, { lessonId, moduleId, courseId })
      setAttempt(data)
      setQuestions(data.questions || [])
      setAnswers({})
      setCurrentIdx(0)
      autoSubmittedRef.current = false
      if (data.timeLimitMinutes) {
        setTimeLeft(data.timeLimitMinutes * 60)
      }
      setPhase('active')
    } catch (err) {
      const msg = err.response?.data?.error || 'Could not start assessment.'
      if (msg.includes('Maximum attempts')) setPhase('locked')
      showToast({ variant: 'error', message: msg })
    } finally { setStarting(false) }
  }

  function selectAnswer(questionId, optionId, isMulti) {
    setAnswers((prev) => {
      const current = prev[questionId] || []
      if (isMulti) {
        const next = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId]
        return { ...prev, [questionId]: next }
      }
      return { ...prev, [questionId]: [optionId] }
    })
  }

  async function submitAttempt(attemptId, ans) {
    const id = attemptId || attempt?.attemptId || attempt?.id
    const formatted = Object.entries(ans || answers).map(([questionId, selectedOptionIds]) => ({ questionId, selectedOptionIds }))
    const { data } = await api.post(`/api/my/attempts/${id}/submit`, { answers: formatted })
    return data
  }

  async function handleSubmit(auto = false) {
    if (!auto) {
      const unanswered = questions.filter((q) => !answers[q.id] || answers[q.id].length === 0)
      if (unanswered.length > 0 && !confirm(`You have ${unanswered.length} unanswered question${unanswered.length > 1 ? 's' : ''}. Submit anyway?`)) return
    }
    setSubmitting(true)
    clearInterval(timerRef.current)
    setTimeLeft(null)
    try {
      const data = await submitAttempt(attempt?.attemptId, answers)
      setResults(data)
      setQuestions(data.questions || [])
      setPhase('results')
      onComplete?.()
      if (auto) showToast({ variant: 'info', message: 'Time expired. Your answers have been submitted.' })
    } catch (err) {
      showToast({ variant: 'error', message: err.response?.data?.error || 'Submission failed.' })
    } finally { setSubmitting(false) }
  }
  handleSubmitRef.current = handleSubmit

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const isExam = quizType === 'exam'
  const isOnePage = !isExam || attempt?.displayMode === 'single_page'

  // ── Phases ──

  if (phase === 'loading') return <div className="py-8 text-center"><span className="text-sm text-stone-500">Loading assessment…</span></div>

  if (phase === 'locked') {
    return (
      <div className="ui-surface space-y-3 p-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-2xl">🔒</div>
        <h3 className="font-display text-lg font-semibold text-stone-900">Maximum attempts reached</h3>
        <p className="text-sm text-stone-600">You have used all 3 attempts. Contact your admin to request a reset.</p>
        {history.length > 0 && <AttemptHistory history={history} />}
      </div>
    )
  }

  if (phase === 'start') {
    const attemptCount = history.filter((a) => a.status === 'submitted' || a.status === 'timed_out').length
    return (
      <div className="ui-surface space-y-5 p-6">
        <h3 className="font-display text-lg font-semibold text-stone-900">
          {isExam ? 'Formal Exam' : 'Practice Quiz'}
        </h3>
        {attempt?.description && <p className="text-sm text-stone-600">{attempt.description}</p>}
        {isExam && (
          <div className="space-y-1 rounded-xl bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
            <p>Pass mark: <strong>{attempt?.passMark || 70}%</strong></p>
            {attempt?.timeLimitMinutes && <p>Time limit: <strong>{attempt.timeLimitMinutes} minutes</strong></p>}
            <p>Attempts: <strong>{attemptCount}/3</strong> used</p>
          </div>
        )}
        {history.length > 0 && <AttemptHistory history={history} />}
        <button type="button" onClick={startAttempt} disabled={starting} className="ui-btn-primary min-h-[44px]">
          {starting ? 'Starting…' : attemptCount > 0 ? (isExam ? 'Retake Exam' : 'Retake Quiz') : (isExam ? 'Start Exam' : 'Start Quiz')}
        </button>
      </div>
    )
  }

  if (phase === 'results') {
    return (
      <div className="space-y-5">
        <div className="ui-surface p-6 text-center">
          <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full text-3xl ${results?.passed === false ? 'bg-red-100' : 'bg-emerald-100'}`}>
            {results?.passed === false ? '✗' : '✓'}
          </div>
          <h3 className="mt-3 font-display text-xl font-semibold text-stone-900">
            {isExam ? (results?.passed ? 'Exam Passed!' : 'Exam Not Passed') : 'Quiz Complete'}
          </h3>
          <p className="mt-1 text-3xl font-bold text-stone-900">{results?.score ?? 0}%</p>
          <p className="text-sm text-stone-500">
            {results?.pointsEarned ?? 0} / {results?.totalPoints ?? 0} points
          </p>
          {isExam && results?.passed === false && (
            <div className="mt-3 rounded-xl bg-amber-50/80 px-4 py-2 text-sm text-amber-900">
              {history.filter((a) => a.status === 'submitted').length < 3
                ? <button type="button" onClick={() => loadHistory()} className="font-semibold text-deep underline">Retake Exam</button>
                : <span>Maximum attempts reached. Contact your admin.</span>
              }
            </div>
          )}
          {quizType === 'quiz' && (
            <button type="button" onClick={() => loadHistory()} className="mt-3 text-sm font-semibold text-deep hover:underline">
              Retake Quiz
            </button>
          )}
        </div>

        {/* Per-question breakdown */}
        <div className="ui-surface divide-y divide-stone-100">
          {(results?.questions || questions).map((q, i) => {
            const answer = (results?.answers || []).find((a) => a.questionId === q.id)
            return (
              <div key={q.id} className="p-4">
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${answer?.isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {answer?.isCorrect ? '✓' : '✗'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-stone-800">Q{i + 1}. {q.text}</p>
                    <div className="mt-2 space-y-1">
                      {(q.options || []).map((opt) => {
                        const selected = (answer?.selectedOptionIds || []).includes(opt.id)
                        const correct = opt.isCorrect
                        let bg = 'bg-stone-50 text-stone-600'
                        if (selected && correct) bg = 'bg-emerald-50 text-emerald-800 font-semibold'
                        else if (selected && !correct) bg = 'bg-red-50 text-red-800'
                        else if (correct) bg = 'bg-emerald-50/50 text-emerald-700'
                        return (
                          <div key={opt.id} className={`rounded-lg px-3 py-1.5 text-sm ${bg}`}>
                            {selected ? '● ' : '○ '}{opt.text}
                            {correct ? ' ✓' : ''}
                          </div>
                        )
                      })}
                    </div>
                    {q.explanation && <p className="mt-2 rounded-lg bg-blue-50/50 px-3 py-2 text-xs text-blue-800">{q.explanation}</p>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Active phase ──
  const currentQ = isOnePage ? null : questions[currentIdx]
  const displayQuestions = isOnePage ? questions : currentQ ? [currentQ] : []
  const answeredCount = questions.filter((q) => answers[q.id]?.length > 0).length

  return (
    <div className="space-y-4">
      {/* Header with timer and progress */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-stone-600">
          {isOnePage ? `${answeredCount}/${questions.length} answered` : `Question ${currentIdx + 1} of ${questions.length}`}
        </p>
        {timeLeft != null && (
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${timeLeft < 300 ? 'bg-red-100 text-red-800 animate-pulse' : 'bg-stone-100 text-stone-700'}`}>
            ⏱ {formatTime(timeLeft)}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-2 overflow-hidden rounded-full bg-stone-100">
        <div className="h-full rounded-full bg-deep transition-[width] duration-300" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
      </div>

      {/* Question navigator (exam one-per-page) */}
      {!isOnePage && (
        <div className="flex flex-wrap gap-1.5">
          {questions.map((q, i) => (
            <button key={q.id} type="button" onClick={() => setCurrentIdx(i)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                i === currentIdx ? 'bg-deep text-white' : answers[q.id]?.length ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
              }`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Questions */}
      <div className="space-y-6">
        {displayQuestions.map((q, i) => {
          const qIdx = isOnePage ? i : currentIdx
          const isMulti = q.type === 'multi_select'
          const selected = answers[q.id] || []
          return (
            <div key={q.id} className="ui-surface p-5">
              <p className="text-sm font-semibold text-stone-800">
                <span className="text-stone-400">Q{qIdx + 1}.</span> {q.text}
              </p>
              <p className="mt-0.5 text-xs text-stone-400">{q.points} point{q.points !== 1 ? 's' : ''} — {isMulti ? 'Select all that apply' : 'Select one'}</p>
              <div className="mt-3 space-y-2">
                {(q.options || []).map((opt) => {
                  const isSelected = selected.includes(opt.id)
                  return (
                    <button key={opt.id} type="button" onClick={() => selectAnswer(q.id, opt.id, isMulti)}
                      className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-sm transition-all ${
                        isSelected ? 'border-deep bg-deep/5 font-medium text-stone-900' : 'border-stone-200 text-stone-700 hover:border-stone-300'
                      }`}>
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-${isMulti ? 'md' : 'full'} border-2 text-xs ${
                        isSelected ? 'border-deep bg-deep text-white' : 'border-stone-300'
                      }`}>
                        {isSelected ? '✓' : ''}
                      </span>
                      {opt.text}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200/60 pt-4">
        {!isOnePage && (
          <div className="flex gap-2">
            <button type="button" disabled={currentIdx === 0} onClick={() => setCurrentIdx((i) => i - 1)}
              className="ui-btn-secondary min-h-[44px] disabled:opacity-40">Previous</button>
            <button type="button" disabled={currentIdx === questions.length - 1} onClick={() => setCurrentIdx((i) => i + 1)}
              className="ui-btn-secondary min-h-[44px] disabled:opacity-40">Next</button>
          </div>
        )}
        <button type="button" onClick={() => handleSubmit(false)} disabled={submitting}
          className="ui-btn-primary min-h-[44px] ml-auto">
          {submitting ? 'Submitting…' : isExam ? 'Submit Exam' : 'Submit Quiz'}
        </button>
      </div>
    </div>
  )
}

function AttemptHistory({ history }) {
  const submitted = history.filter((a) => a.status === 'submitted' || a.status === 'timed_out')
  if (submitted.length === 0) return null
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Previous Attempts</p>
      <div className="mt-2 space-y-1.5">
        {submitted.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2 text-sm">
            <span className="text-stone-600">Attempt {a.attemptNumber}</span>
            <span className="font-semibold text-stone-800">{a.score ?? 0}%</span>
            {a.passed === true && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Pass</span>}
            {a.passed === false && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Fail</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
