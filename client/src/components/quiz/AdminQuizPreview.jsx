import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api.js'

/**
 * Admin lesson preview: loads trainee-facing quiz shape (no correct answers)
 * from GET /api/quizzes/:quizId/preview. Interactive locally; nothing is submitted.
 */
export function AdminQuizPreview({ quizId }) {
  const [phase, setPhase] = useState('loading') // loading | ready | error
  const [error, setError] = useState('')
  const [quiz, setQuiz] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [currentIdx, setCurrentIdx] = useState(0)

  const load = useCallback(async () => {
    if (!quizId) return
    setPhase('loading')
    setError('')
    try {
      const { data } = await api.get(`/api/quizzes/${quizId}/preview`)
      setQuiz(data.quiz || null)
      setQuestions(Array.isArray(data.questions) ? data.questions : [])
      setAnswers({})
      setCurrentIdx(0)
      setPhase('ready')
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load quiz preview.')
      setPhase('error')
    }
  }, [quizId])

  useEffect(() => {
    load()
  }, [load])

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

  if (!quizId) {
    return (
      <div className="ui-surface p-5">
        <p className="text-sm text-stone-600">This lesson has no quiz linked. Choose a quiz in the lesson editor.</p>
      </div>
    )
  }

  if (phase === 'loading') {
    return (
      <div className="ui-surface py-10 text-center">
        <span className="text-sm text-stone-500">Loading quiz preview…</span>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="ui-surface p-5">
        <p className="text-sm text-red-800" role="alert">{error}</p>
        <button type="button" onClick={() => load()} className="mt-3 text-sm font-semibold text-deep underline">
          Retry
        </button>
      </div>
    )
  }

  const isExam = quiz?.type === 'exam'
  const isOnePage = !isExam || quiz?.displayMode === 'single_page'
  const currentQ = isOnePage ? null : questions[currentIdx]
  const displayQuestions = isOnePage ? questions : currentQ ? [currentQ] : []
  const answeredCount = questions.filter((q) => answers[q.id]?.length > 0).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
        <p>
          <span className="font-semibold">Preview only.</span>{' '}
          Trainees do not see correct answers until after submission. Your selections here are not saved or scored.
        </p>
        <Link
          to={`/admin/quizzes/${quizId}`}
          className="shrink-0 font-semibold text-deep underline underline-offset-2 hover:no-underline"
        >
          Edit quiz →
        </Link>
      </div>

      {quiz?.description ? (
        <p className="max-w-3xl text-sm text-stone-600">{quiz.description}</p>
      ) : null}

      {isExam && (
        <div className="space-y-1 rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-800">
          <p>
            Pass mark: <strong>{quiz?.passMark ?? 70}%</strong>
            {quiz?.timeLimitMinutes ? (
              <> · Time limit: <strong>{quiz.timeLimitMinutes} min</strong></>
            ) : null}
          </p>
          <p className="text-xs text-stone-500">Formal exam · preview shows layout only (no timer in preview).</p>
        </div>
      )}

      {questions.length === 0 ? (
        <div className="ui-surface p-6 text-center text-sm text-stone-600">
          No questions yet. Add questions on the quiz editor page.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-stone-600">
              {isOnePage ? `${answeredCount}/${questions.length} answered (optional)` : `Question ${currentIdx + 1} of ${questions.length}`}
            </p>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-deep transition-[width] duration-300"
              style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }}
            />
          </div>

          {!isOnePage && (
            <div className="flex flex-wrap gap-1.5">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIdx(i)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                    i === currentIdx ? 'bg-deep text-white' : answers[q.id]?.length ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}

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
                  <p className="mt-0.5 text-xs text-stone-400">
                    {q.points} point{q.points !== 1 ? 's' : ''} — {isMulti ? 'Select all that apply' : 'Select one'}
                  </p>
                  <div className="mt-3 space-y-2">
                    {(q.options || []).map((opt) => {
                      const isSelected = selected.includes(opt.id)
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => selectAnswer(q.id, opt.id, isMulti)}
                          className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-sm transition-all ${
                            isSelected ? 'border-deep bg-deep/5 font-medium text-stone-900' : 'border-stone-200 text-stone-700 hover:border-stone-300'
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center border-2 text-xs ${isMulti ? 'rounded-md' : 'rounded-full'} ${
                              isSelected ? 'border-deep bg-deep text-white' : 'border-stone-300'
                            }`}
                          >
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

          {!isOnePage && (
            <div className="flex flex-wrap gap-2 border-t border-stone-200/60 pt-4">
              <button
                type="button"
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx((idx) => idx - 1)}
                className="ui-btn-secondary min-h-[44px] disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentIdx === questions.length - 1}
                onClick={() => setCurrentIdx((idx) => idx + 1)}
                className="ui-btn-secondary min-h-[44px] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
