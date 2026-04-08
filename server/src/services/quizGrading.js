import crypto from 'crypto'

/**
 * Deterministic shuffle using a seed (attemptId).
 * Fisher-Yates with seeded PRNG so the same attempt always sees the same order.
 */
function seededShuffle(arr, seed) {
  const out = [...arr]
  const hash = crypto.createHash('sha256').update(String(seed)).digest()
  let idx = 0
  function nextByte() {
    if (idx >= hash.length) idx = 0
    return hash[idx++]
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = nextByte() % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function buildQuestionOrder(questions, orderMode, attemptId) {
  const ids = questions.map((q) => q.id)
  if (orderMode === 'shuffled') return seededShuffle(ids, attemptId)
  return ids
}

export function shuffleOptions(options, attemptId, questionId) {
  const seed = `${attemptId}_${questionId}`
  return seededShuffle(options, seed)
}

/**
 * Strip correct-answer flags from questions for the client.
 */
export function sanitizeQuestionsForClient(questions, quiz, attemptId) {
  const ordered = buildQuestionOrder(questions, quiz.questionOrder, attemptId)
  return ordered.map((qId) => {
    const q = questions.find((x) => x.id === qId)
    if (!q) return null
    let opts = (q.options || []).map(({ id, text }) => ({ id, text }))
    if (quiz.optionOrder === 'shuffled') {
      opts = shuffleOptions(opts, attemptId, qId)
    }
    return {
      id: q.id,
      type: q.type,
      text: q.text,
      points: q.points || 1,
      options: opts,
    }
  }).filter(Boolean)
}

/**
 * Grade a set of answers against the question definitions.
 * Returns { answers, pointsEarned, totalPoints, score, passed }.
 */
export function gradeAttempt(questions, submittedAnswers, passMark) {
  let pointsEarned = 0
  let totalPoints = 0
  const gradedAnswers = []

  for (const q of questions) {
    const pts = q.points || 1
    totalPoints += pts
    const submitted = submittedAnswers.find((a) => a.questionId === q.id)
    const selectedIds = submitted?.selectedOptionIds || []
    const correctIds = (q.options || []).filter((o) => o.isCorrect).map((o) => o.id)

    let isCorrect = false
    if (q.type === 'mcq' || q.type === 'true_false') {
      isCorrect = selectedIds.length === 1 && correctIds.includes(selectedIds[0])
    } else if (q.type === 'multi_select') {
      const selectedSet = new Set(selectedIds)
      const correctSet = new Set(correctIds)
      isCorrect =
        selectedSet.size === correctSet.size &&
        [...correctSet].every((id) => selectedSet.has(id))
    }

    const earned = isCorrect ? pts : 0
    pointsEarned += earned
    gradedAnswers.push({
      questionId: q.id,
      selectedOptionIds: selectedIds,
      isCorrect,
      pointsEarned: earned,
    })
  }

  const score = totalPoints === 0 ? 0 : Math.round((pointsEarned / totalPoints) * 100)
  const passed = passMark != null ? score >= passMark : null

  return { answers: gradedAnswers, pointsEarned, totalPoints, score, passed }
}
