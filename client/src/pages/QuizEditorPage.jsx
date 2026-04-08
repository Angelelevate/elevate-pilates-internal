import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd'
import { api } from '../services/api.js'
import { useToast } from '../contexts/ToastContext.jsx'
import { LoadingSpinner } from '../components/LoadingSpinner.jsx'

const QUESTION_TYPES = [
  { value: 'mcq', label: 'Multiple Choice' },
  { value: 'true_false', label: 'True / False' },
  { value: 'multi_select', label: 'Multi-Select' },
]

export function QuizEditorPage() {
  const { quizId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [quiz, setQuiz] = useState(null)
  const [questions, setQuestions] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showQuestionForm, setShowQuestionForm] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState(null)

  // Quiz settings form
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [passMark, setPassMark] = useState(70)
  const [timeLimit, setTimeLimit] = useState('')
  const [questionOrder, setQuestionOrder] = useState('fixed')
  const [optionOrder, setOptionOrder] = useState('fixed')
  const [displayMode, setDisplayMode] = useState('single_page')

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/quizzes/${quizId}`)
      setQuiz(data)
      setQuestions(data.questions || [])
      setTitle(data.title || '')
      setDescription(data.description || '')
      setPassMark(data.passMark || 70)
      setTimeLimit(data.timeLimitMinutes || '')
      setQuestionOrder(data.questionOrder || 'fixed')
      setOptionOrder(data.optionOrder || 'fixed')
      setDisplayMode(data.displayMode || 'single_page')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load.')
    }
  }, [quizId])

  useEffect(() => { load() }, [load])

  async function saveSettings(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.patch(`/api/quizzes/${quizId}`, {
        title, description, passMark: Number(passMark),
        timeLimitMinutes: timeLimit ? Number(timeLimit) : null,
        questionOrder, optionOrder, displayMode,
      })
      await load()
      showToast({ variant: 'success', message: 'Settings saved.' })
    } catch (err) {
      showToast({ variant: 'error', message: err.response?.data?.error || 'Save failed.' })
    } finally { setSaving(false) }
  }

  async function togglePublish() {
    setSaving(true)
    try {
      const newStatus = quiz.status === 'published' ? 'draft' : 'published'
      await api.patch(`/api/quizzes/${quizId}/status`, { status: newStatus })
      await load()
      showToast({ variant: 'success', message: newStatus === 'published' ? 'Published!' : 'Unpublished.' })
    } catch (err) {
      showToast({ variant: 'error', message: err.response?.data?.error || 'Status change failed.' })
    } finally { setSaving(false) }
  }

  async function archiveQuiz() {
    if (!confirm('Archive this assessment? It will be hidden from lists.')) return
    try {
      await api.delete(`/api/quizzes/${quizId}`)
      navigate('/admin/quizzes')
      showToast({ variant: 'success', message: 'Archived.' })
    } catch (err) {
      showToast({ variant: 'error', message: err.response?.data?.error || 'Archive failed.' })
    }
  }

  async function handleDragEnd(result) {
    if (!result.destination) return
    const reordered = Array.from(questions)
    const [moved] = reordered.splice(result.source.index, 1)
    reordered.splice(result.destination.index, 0, moved)
    setQuestions(reordered)
    try {
      await api.patch(`/api/quizzes/${quizId}/questions/reorder`, {
        orderedQuestionIds: reordered.map((q) => q.id),
      })
    } catch {
      showToast({ variant: 'error', message: 'Reorder failed.' })
      await load()
    }
  }

  async function deleteQuestion(qId) {
    if (!confirm('Delete this question?')) return
    try {
      await api.delete(`/api/quizzes/questions/${qId}`)
      await load()
      showToast({ variant: 'success', message: 'Question deleted.' })
    } catch (err) {
      showToast({ variant: 'error', message: err.response?.data?.error || 'Delete failed.' })
    }
  }

  if (error && !quiz) return <p className="rounded-xl bg-red-50/90 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>
  if (!quiz) return <LoadingSpinner label="Loading assessment" />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button type="button" onClick={() => navigate('/admin/quizzes')} className="ui-link text-sm text-stone-500 hover:underline">← Assessments</button>
          <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">{quiz.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${quiz.type === 'exam' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
              {quiz.type === 'exam' ? 'Exam' : 'Quiz'}
            </span>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${quiz.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'}`}>
              {quiz.status}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={togglePublish} disabled={saving} className="ui-btn-primary min-h-[44px]">
            {quiz.status === 'published' ? 'Unpublish' : 'Publish'}
          </button>
          <button type="button" onClick={archiveQuiz} className="ui-btn-secondary min-h-[44px] !border-red-200 !text-red-700 hover:!bg-red-50">
            Archive
          </button>
        </div>
      </div>

      {/* Settings */}
      <form onSubmit={saveSettings} className="ui-surface space-y-4 p-5">
        <h2 className="font-display text-lg font-semibold text-stone-900">Settings</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="ui-input w-full" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Description / Instructions</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="ui-input w-full" />
          </div>
          {quiz.type === 'exam' && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">Pass mark (%)</label>
                <input type="number" min="1" max="100" value={passMark} onChange={(e) => setPassMark(e.target.value)} className="ui-input w-full" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">Time limit (minutes, blank = none)</label>
                <input type="number" min="1" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} className="ui-input w-full" placeholder="No limit" />
              </div>
            </>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Question order</label>
            <select value={questionOrder} onChange={(e) => setQuestionOrder(e.target.value)} className="ui-input w-full">
              <option value="fixed">Fixed</option>
              <option value="shuffled">Shuffled</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Option order</label>
            <select value={optionOrder} onChange={(e) => setOptionOrder(e.target.value)} className="ui-input w-full">
              <option value="fixed">Fixed</option>
              <option value="shuffled">Shuffled</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Display mode</label>
            <select value={displayMode} onChange={(e) => setDisplayMode(e.target.value)} className="ui-input w-full">
              <option value="single_page">All questions on one page</option>
              <option value="one_per_page">One question per page</option>
            </select>
          </div>
        </div>
        <button type="submit" disabled={saving} className="ui-btn-primary min-h-[44px]">
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </form>

      {/* Questions */}
      <div className="ui-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-stone-900">
            Questions ({questions.length}) — {quiz.totalPoints || 0} points
          </h2>
          <button type="button" className="ui-btn-primary min-h-[44px]" onClick={() => { setEditingQuestion(null); setShowQuestionForm(true) }}>
            + Add question
          </button>
        </div>

        {showQuestionForm && (
          <QuestionForm
            quizId={quizId}
            existing={editingQuestion}
            order={questions.length + 1}
            onDone={() => { setShowQuestionForm(false); setEditingQuestion(null); load() }}
            onCancel={() => { setShowQuestionForm(false); setEditingQuestion(null) }}
          />
        )}

        {questions.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">No questions yet. Add your first question above.</p>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="questions">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="mt-4 space-y-2">
                  {questions.map((q, i) => (
                    <Draggable key={q.id} draggableId={q.id} index={i}>
                      {(prov) => (
                        <div ref={prov.innerRef} {...prov.draggableProps} className="flex items-start gap-3 rounded-xl border border-stone-200/60 bg-white p-4 shadow-warm-sm">
                          <span {...prov.dragHandleProps} className="mt-1 cursor-grab text-stone-400 select-none" title="Drag to reorder">⣿</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-stone-400">Q{i + 1}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${q.type === 'mcq' ? 'bg-blue-100 text-blue-700' : q.type === 'true_false' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'}`}>
                                {q.type === 'mcq' ? 'MCQ' : q.type === 'true_false' ? 'T/F' : 'Multi'}
                              </span>
                              <span className="text-xs text-stone-400">{q.points || 1} pt{(q.points || 1) !== 1 ? 's' : ''}</span>
                            </div>
                            <p className="mt-1 text-sm text-stone-800">{q.text}</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {(q.options || []).map((o) => (
                                <span key={o.id} className={`rounded-md px-2 py-0.5 text-xs ${o.isCorrect ? 'bg-emerald-100 text-emerald-800 font-semibold' : 'bg-stone-100 text-stone-600'}`}>
                                  {o.isCorrect ? '✓ ' : ''}{o.text}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <button type="button" onClick={() => { setEditingQuestion(q); setShowQuestionForm(true) }}
                              className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600" title="Edit">
                              ✎
                            </button>
                            <button type="button" onClick={() => deleteQuestion(q.id)}
                              className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600" title="Delete">
                              ✕
                            </button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>
    </div>
  )
}

function QuestionForm({ quizId, existing, order, onDone, onCancel }) {
  const { showToast } = useToast()
  const [type, setType] = useState(existing?.type || 'mcq')
  const [text, setText] = useState(existing?.text || '')
  const [explanation, setExplanation] = useState(existing?.explanation || '')
  const [points, setPoints] = useState(existing?.points || 1)
  const [options, setOptions] = useState(
    existing?.options || [
      { id: 'a', text: '', isCorrect: true },
      { id: 'b', text: '', isCorrect: false },
    ],
  )
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (type === 'true_false') {
      setOptions([
        { id: 'true', text: 'True', isCorrect: true },
        { id: 'false', text: 'False', isCorrect: false },
      ])
    }
  }, [type])

  function addOption() {
    const id = `opt_${Date.now()}_${options.length}`
    setOptions([...options, { id, text: '', isCorrect: false }])
  }

  function removeOption(idx) {
    if (options.length <= 2) return
    setOptions(options.filter((_, i) => i !== idx))
  }

  function toggleCorrect(idx) {
    setOptions(options.map((o, i) => {
      if (type === 'mcq' || type === 'true_false') {
        return { ...o, isCorrect: i === idx }
      }
      return i === idx ? { ...o, isCorrect: !o.isCorrect } : o
    }))
  }

  async function save(e) {
    e.preventDefault()
    if (!text.trim()) return
    const hasCorrect = options.some((o) => o.isCorrect)
    if (!hasCorrect) { showToast({ variant: 'error', message: 'Mark at least one correct answer.' }); return }
    setBusy(true)
    try {
      if (existing) {
        await api.patch(`/api/quizzes/questions/${existing.id}`, { type, text, options, explanation, points: Number(points) })
      } else {
        await api.post(`/api/quizzes/${quizId}/questions`, { type, text, options, explanation, points: Number(points), order })
      }
      onDone()
      showToast({ variant: 'success', message: existing ? 'Question updated.' : 'Question added.' })
    } catch (err) {
      showToast({ variant: 'error', message: err.response?.data?.error || 'Save failed.' })
    } finally { setBusy(false) }
  }

  return (
    <form onSubmit={save} className="mt-4 space-y-4 rounded-xl border border-deep/20 bg-white p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Question type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="ui-input w-full" disabled={!!existing}>
            {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Points</label>
          <input type="number" min="1" value={points} onChange={(e) => setPoints(e.target.value)} className="ui-input w-full" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">Question text</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className="ui-input w-full" required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">
          Options {type === 'multi_select' ? '(click multiple to mark correct)' : '(click to mark correct)'}
        </label>
        <div className="space-y-2">
          {options.map((o, i) => (
            <div key={o.id || i} className="flex items-center gap-2">
              <button type="button" onClick={() => toggleCorrect(i)}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${o.isCorrect ? 'border-emerald-500 bg-emerald-100 text-emerald-700' : 'border-stone-300 text-stone-400 hover:border-stone-400'}`}>
                {o.isCorrect ? '✓' : String.fromCharCode(65 + i)}
              </button>
              <input value={o.text} disabled={type === 'true_false'}
                onChange={(e) => setOptions(options.map((opt, j) => j === i ? { ...opt, text: e.target.value } : opt))}
                className="ui-input flex-1" placeholder={`Option ${String.fromCharCode(65 + i)}`} required />
              {type !== 'true_false' && options.length > 2 && (
                <button type="button" onClick={() => removeOption(i)} className="text-stone-400 hover:text-red-500">✕</button>
              )}
            </div>
          ))}
        </div>
        {type !== 'true_false' && options.length < 6 && (
          <button type="button" onClick={addOption} className="mt-2 text-sm font-medium text-deep hover:underline">+ Add option</button>
        )}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">Explanation (shown after grading)</label>
        <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} className="ui-input w-full" />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="ui-btn-primary min-h-[44px]">
          {busy ? 'Saving…' : existing ? 'Update question' : 'Add question'}
        </button>
        <button type="button" onClick={onCancel} className="ui-btn-secondary min-h-[44px]">Cancel</button>
      </div>
    </form>
  )
}
