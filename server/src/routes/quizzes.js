import { Router } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { getDb } from '../utils/firestoreDb.js'
import { getDocSnapshotsById } from '../utils/firestoreBatch.js'
import { serializeDoc, serializeValue } from '../utils/serialize.js'
import { sanitizeQuestionsForClient } from '../services/quizGrading.js'

export const quizzesRouter = Router()
quizzesRouter.use(requireAuth, requireRole('admin'))

function dbRequired() {
  const db = getDb()
  if (!db) {
    const err = new Error('Database not configured')
    err.status = 503
    throw err
  }
  return db
}

// ── Quiz / Exam CRUD ────────────────────────────────────────────────

quizzesRouter.post('/', async (req, res, next) => {
  try {
    const db = dbRequired()
    const {
      title, description, type, courseId,
      passMark, timeLimitMinutes, questionOrder,
      optionOrder, displayMode,
    } = req.body || {}
    if (!title || !type || !courseId) {
      const err = new Error('title, type, and courseId are required')
      err.status = 400
      throw err
    }
    if (!['quiz', 'exam'].includes(type)) {
      const err = new Error('type must be quiz or exam')
      err.status = 400
      throw err
    }
    const ref = db.collection('quizzes').doc()
    await ref.set({
      title: String(title).trim(),
      description: description ? String(description).trim() : '',
      type,
      courseId,
      passMark: type === 'exam' ? (Number(passMark) || 70) : null,
      timeLimitMinutes: type === 'exam' && timeLimitMinutes ? Number(timeLimitMinutes) : null,
      questionOrder: questionOrder || 'fixed',
      optionOrder: optionOrder || 'fixed',
      displayMode: displayMode || 'single_page',
      totalPoints: 0,
      questionCount: 0,
      status: 'draft',
      createdBy: req.user.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    res.status(201).json(serializeDoc(await ref.get()))
  } catch (e) { next(e) }
})

quizzesRouter.get('/', async (req, res, next) => {
  try {
    const db = dbRequired()
    let query = db.collection('quizzes')
    const snap = await query.limit(500).get()
    let rows = snap.docs.map((d) => serializeDoc(d))
    if (req.query.courseId) rows = rows.filter((r) => r.courseId === req.query.courseId)
    if (req.query.type) rows = rows.filter((r) => r.type === req.query.type)
    if (req.query.status) rows = rows.filter((r) => r.status === req.query.status)
    rows.sort((a, b) => String(a.title).localeCompare(String(b.title)))
    res.json(rows)
  } catch (e) { next(e) }
})

quizzesRouter.get('/:quizId', async (req, res, next) => {
  try {
    const db = dbRequired()
    const doc = await db.collection('quizzes').doc(req.params.quizId).get()
    if (!doc.exists) { const err = new Error('Quiz not found'); err.status = 404; throw err }
    const qSnap = await db.collection('questions').where('quizId', '==', req.params.quizId).get()
    const questions = qSnap.docs.map((d) => serializeDoc(d)).sort((a, b) => (a.order || 0) - (b.order || 0))
    res.json({ ...serializeDoc(doc), questions })
  } catch (e) { next(e) }
})

quizzesRouter.patch('/:quizId', async (req, res, next) => {
  try {
    const db = dbRequired()
    const ref = db.collection('quizzes').doc(req.params.quizId)
    const doc = await ref.get()
    if (!doc.exists) { const err = new Error('Quiz not found'); err.status = 404; throw err }
    const patch = { updatedAt: FieldValue.serverTimestamp() }
    const fields = ['title', 'description', 'passMark', 'timeLimitMinutes', 'questionOrder', 'optionOrder', 'displayMode']
    for (const f of fields) {
      if (req.body?.[f] !== undefined) patch[f] = req.body[f]
    }
    if (patch.title) patch.title = String(patch.title).trim()
    await ref.update(patch)
    res.json(serializeDoc(await ref.get()))
  } catch (e) { next(e) }
})

quizzesRouter.patch('/:quizId/status', async (req, res, next) => {
  try {
    const db = dbRequired()
    const status = req.body?.status
    if (!['draft', 'published'].includes(status)) {
      const err = new Error('status must be draft or published'); err.status = 400; throw err
    }
    const ref = db.collection('quizzes').doc(req.params.quizId)
    const doc = await ref.get()
    if (!doc.exists) { const err = new Error('Quiz not found'); err.status = 404; throw err }
    if (status === 'published') {
      const qSnap = await db.collection('questions').where('quizId', '==', req.params.quizId).get()
      if (qSnap.empty) {
        const err = new Error('Cannot publish a quiz with no questions'); err.status = 400; throw err
      }
    }
    await ref.update({ status, updatedAt: FieldValue.serverTimestamp() })
    res.json(serializeDoc(await ref.get()))
  } catch (e) { next(e) }
})

quizzesRouter.delete('/:quizId', async (req, res, next) => {
  try {
    const db = dbRequired()
    const ref = db.collection('quizzes').doc(req.params.quizId)
    const doc = await ref.get()
    if (!doc.exists) { const err = new Error('Quiz not found'); err.status = 404; throw err }
    await ref.update({ status: 'archived', updatedAt: FieldValue.serverTimestamp() })
    res.status(204).send()
  } catch (e) { next(e) }
})

// ── Question management ─────────────────────────────────────────────

async function recalcQuizTotals(db, quizId) {
  const snap = await db.collection('questions').where('quizId', '==', quizId).get()
  let totalPoints = 0
  for (const d of snap.docs) totalPoints += (d.data().points || 1)
  const update = {
    totalPoints,
    questionCount: snap.size,
    updatedAt: FieldValue.serverTimestamp(),
  }
  let quizWentDraft = false
  if (snap.size === 0) {
    const quizDoc = await db.collection('quizzes').doc(quizId).get()
    if (quizDoc.exists && quizDoc.data().status === 'published') {
      update.status = 'draft'
      quizWentDraft = true
    }
  }
  await db.collection('quizzes').doc(quizId).update(update)

  if (quizWentDraft) {
    await cascadeDraftFromQuiz(db, quizId)
  }
}

async function cascadeDraftFromQuiz(db, quizId) {
  const lessonSnap = await db.collection('lessons').get()
  const affectedCourseIds = new Set()
  const lessonRefs = []

  for (const d of lessonSnap.docs) {
    const lesson = d.data()
    if ((lesson.type === 'quiz' || lesson.type === 'exam') &&
        lesson.content?.quizId === quizId &&
        lesson.status === 'published') {
      lessonRefs.push(d.ref)
      if (lesson.courseId) affectedCourseIds.add(lesson.courseId)
    }
  }
  if (lessonRefs.length === 0) return

  // Batch the lesson updates instead of committing one write per lesson.
  const chunkSize = 400
  for (let i = 0; i < lessonRefs.length; i += chunkSize) {
    const batch = db.batch()
    for (const ref of lessonRefs.slice(i, i + chunkSize)) {
      batch.update(ref, { status: 'draft', updatedAt: FieldValue.serverTimestamp() })
    }
    await batch.commit()
  }

  // Read the affected courses in one batched call, then commit their updates together.
  const courseIds = [...affectedCourseIds]
  const courseDocs = await getDocSnapshotsById(db, 'courses', courseIds)
  const courseBatch = db.batch()
  let pendingCourseUpdates = 0
  for (const courseId of courseIds) {
    const courseDoc = courseDocs.get(courseId)
    if (courseDoc?.exists && courseDoc.data().status === 'published') {
      courseBatch.update(courseDoc.ref, { status: 'draft', updatedAt: FieldValue.serverTimestamp() })
      pendingCourseUpdates += 1
    }
  }
  if (pendingCourseUpdates > 0) await courseBatch.commit()
}

quizzesRouter.post('/:quizId/questions', async (req, res, next) => {
  try {
    const db = dbRequired()
    const quizId = req.params.quizId
    const quizDoc = await db.collection('quizzes').doc(quizId).get()
    if (!quizDoc.exists) { const err = new Error('Quiz not found'); err.status = 404; throw err }
    const { type, text, options, explanation, points, order } = req.body || {}
    if (!type || !text || !Array.isArray(options) || options.length < 2) {
      const err = new Error('type, text, and at least 2 options are required'); err.status = 400; throw err
    }
    if (!['mcq', 'true_false', 'multi_select'].includes(type)) {
      const err = new Error('Invalid question type'); err.status = 400; throw err
    }
    const correctCount = options.filter((o) => o.isCorrect).length
    if (correctCount === 0) {
      const err = new Error('At least one option must be marked correct'); err.status = 400; throw err
    }
    if ((type === 'mcq' || type === 'true_false') && correctCount !== 1) {
      const err = new Error('MCQ and True/False must have exactly one correct answer'); err.status = 400; throw err
    }
    const ref = db.collection('questions').doc()
    const builtOptions = options.map((o, i) => ({
      id: o.id || `opt_${ref.id}_${i}`,
      text: String(o.text).trim(),
      isCorrect: Boolean(o.isCorrect),
    }))
    await ref.set({
      quizId,
      type,
      text: String(text).trim(),
      options: builtOptions,
      explanation: explanation ? String(explanation).trim() : null,
      points: Number(points) || 1,
      order: Number(order) || 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    await recalcQuizTotals(db, quizId)
    res.status(201).json(serializeDoc(await ref.get()))
  } catch (e) { next(e) }
})

quizzesRouter.get('/:quizId/questions', async (req, res, next) => {
  try {
    const db = dbRequired()
    const snap = await db.collection('questions').where('quizId', '==', req.params.quizId).get()
    const rows = snap.docs.map((d) => serializeDoc(d)).sort((a, b) => (a.order || 0) - (b.order || 0))
    res.json(rows)
  } catch (e) { next(e) }
})

quizzesRouter.patch('/:quizId/questions/reorder', async (req, res, next) => {
  try {
    const db = dbRequired()
    const ids = req.body?.orderedQuestionIds
    if (!Array.isArray(ids) || ids.length === 0) {
      const err = new Error('orderedQuestionIds required'); err.status = 400; throw err
    }
    const batch = db.batch()
    let i = 1
    for (const id of ids) {
      batch.update(db.collection('questions').doc(id), { order: i, updatedAt: FieldValue.serverTimestamp() })
      i++
    }
    await batch.commit()
    const snap = await db.collection('questions').where('quizId', '==', req.params.quizId).get()
    res.json(snap.docs.map((d) => serializeDoc(d)).sort((a, b) => (a.order || 0) - (b.order || 0)))
  } catch (e) { next(e) }
})

// Standalone question endpoints
quizzesRouter.patch('/questions/:questionId', async (req, res, next) => {
  try {
    const db = dbRequired()
    const ref = db.collection('questions').doc(req.params.questionId)
    const doc = await ref.get()
    if (!doc.exists) { const err = new Error('Question not found'); err.status = 404; throw err }
    const patch = { updatedAt: FieldValue.serverTimestamp() }
    if (req.body?.text !== undefined) patch.text = String(req.body.text).trim()
    if (req.body?.type !== undefined) patch.type = req.body.type
    if (req.body?.explanation !== undefined) patch.explanation = req.body.explanation ? String(req.body.explanation).trim() : null
    if (req.body?.points !== undefined) patch.points = Number(req.body.points) || 1
    if (req.body?.order !== undefined) patch.order = Number(req.body.order)
    if (Array.isArray(req.body?.options)) {
      patch.options = req.body.options.map((o, i) => ({
        id: o.id || `opt_${req.params.questionId}_${i}`,
        text: String(o.text).trim(),
        isCorrect: Boolean(o.isCorrect),
      }))
    }
    await ref.update(patch)
    if (patch.points !== undefined) await recalcQuizTotals(db, doc.data().quizId)
    res.json(serializeDoc(await ref.get()))
  } catch (e) { next(e) }
})

quizzesRouter.delete('/questions/:questionId', async (req, res, next) => {
  try {
    const db = dbRequired()
    const ref = db.collection('questions').doc(req.params.questionId)
    const doc = await ref.get()
    if (!doc.exists) { const err = new Error('Question not found'); err.status = 404; throw err }
    const quizId = doc.data().quizId
    await ref.delete()
    await recalcQuizTotals(db, quizId)
    res.status(204).send()
  } catch (e) { next(e) }
})

// ── Admin attempt management ────────────────────────────────────────

quizzesRouter.get('/:quizId/attempts', async (req, res, next) => {
  try {
    const db = dbRequired()
    let query = db.collection('quizAttempts').where('quizId', '==', req.params.quizId)
    const snap = await query.get()
    let rows = snap.docs.map((d) => serializeDoc(d))
    if (req.query.traineeId) rows = rows.filter((r) => r.traineeId === req.query.traineeId)
    rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    res.json(rows)
  } catch (e) { next(e) }
})

quizzesRouter.get('/attempts/:attemptId', async (req, res, next) => {
  try {
    const db = dbRequired()
    const doc = await db.collection('quizAttempts').doc(req.params.attemptId).get()
    if (!doc.exists) { const err = new Error('Attempt not found'); err.status = 404; throw err }
    res.json(serializeDoc(doc))
  } catch (e) { next(e) }
})

quizzesRouter.post('/:quizId/trainees/:traineeId/reset-attempts', async (req, res, next) => {
  try {
    const db = dbRequired()
    const { quizId, traineeId } = req.params
    const snap = await db.collection('quizAttempts')
      .where('quizId', '==', quizId)
      .where('traineeId', '==', traineeId)
      .get()
    const batch = db.batch()
    for (const d of snap.docs) batch.delete(d.ref)
    await batch.commit()
    res.json({ deleted: snap.size })
  } catch (e) { next(e) }
})

// ── Quiz preview ────────────────────────────────────────────────────

quizzesRouter.get('/:quizId/preview', async (req, res, next) => {
  try {
    const db = dbRequired()
    const quizDoc = await db.collection('quizzes').doc(req.params.quizId).get()
    if (!quizDoc.exists) { const err = new Error('Quiz not found'); err.status = 404; throw err }
    const quiz = { id: quizDoc.id, ...quizDoc.data() }
    const qSnap = await db.collection('questions').where('quizId', '==', req.params.quizId).get()
    const questions = qSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0))
    const previewId = `preview_${Date.now()}`
    const sanitized = sanitizeQuestionsForClient(questions, quiz, previewId)
    res.json({ quiz: serializeValue(quiz), questions: sanitized })
  } catch (e) { next(e) }
})
