import { Router } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { requireNoForcedPasswordChange } from '../middleware/mustChangePasswordMiddleware.js'
import { getDb } from '../utils/firestoreDb.js'
import { serializeDoc } from '../utils/serialize.js'
import {
  sanitizeQuestionsForClient,
  gradeAttempt,
} from '../services/quizGrading.js'

export const traineeQuizRouter = Router()
traineeQuizRouter.use(requireAuth, requireRole('trainee'), requireNoForcedPasswordChange)

function dbRequired() {
  const db = getDb()
  if (!db) { const err = new Error('Database not configured'); err.status = 503; throw err }
  return db
}

// Fallback expiry for in-progress attempts on quizzes that have no time limit,
// so an abandoned attempt can't lock a trainee out forever (default: 6 hours).
const UNTIMED_STALE_MS = 6 * 60 * 60 * 1000
// Grace beyond the timer to tolerate clock skew / slow submits before we expire.
const TIMED_GRACE_MS = 2 * 60 * 1000

function isAttemptStale(attempt, quiz) {
  const startedAt = attempt.startedAt?.toDate?.() || (attempt.startedAt ? new Date(attempt.startedAt) : null)
  if (!startedAt) return true // no start timestamp — treat as stale/orphaned
  const ageMs = Date.now() - startedAt.getTime()
  const limitMin = attempt.timeLimitMinutes || quiz.timeLimitMinutes || null
  if (limitMin) return ageMs > limitMin * 60000 + TIMED_GRACE_MS
  return ageMs > UNTIMED_STALE_MS
}

// Start a new attempt
traineeQuizRouter.post('/quizzes/:quizId/attempts', async (req, res, next) => {
  try {
    const db = dbRequired()
    const { quizId } = req.params
    const traineeId = req.user.uid

    const quizDoc = await db.collection('quizzes').doc(quizId).get()
    if (!quizDoc.exists || quizDoc.data().status !== 'published') {
      const err = new Error('Quiz not found or not published'); err.status = 404; throw err
    }
    const quiz = { id: quizDoc.id, ...quizDoc.data() }

    // For exams: check attempt limit (max 3)
    if (quiz.type === 'exam') {
      const existingSnap = await db.collection('quizAttempts')
        .where('quizId', '==', quizId)
        .where('traineeId', '==', traineeId)
        .get()
      const existing = existingSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }))

      // Expire any stale in-progress attempts before evaluating the lock. Without
      // this, an attempt abandoned mid-quiz (tab closed, device switched, connection
      // dropped) leaves the trainee permanently unable to start a new one, since
      // nothing else ever transitions it out of `in_progress`.
      for (const a of existing.filter((x) => x.status === 'in_progress')) {
        if (isAttemptStale(a, quiz)) {
          await a.ref.update({
            status: 'timed_out',
            score: 0,
            pointsEarned: 0,
            totalPoints: quiz.totalPoints || 0,
            passed: false,
            submittedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          })
          a.status = 'timed_out'
        }
      }

      const submitted = existing.filter((a) => a.status === 'submitted' || a.status === 'timed_out')
      if (submitted.length >= 3) {
        const err = new Error('Maximum attempts reached. Contact your admin.')
        err.status = 403; throw err
      }
      // Block only if a genuinely active (non-stale) attempt is still running
      const inProgress = existing.find((a) => a.status === 'in_progress')
      if (inProgress) {
        const err = new Error('You already have an attempt in progress')
        err.status = 400; throw err
      }
    }

    // Load questions
    const qSnap = await db.collection('questions').where('quizId', '==', quizId).get()
    const questions = qSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order || 0) - (b.order || 0))

    if (questions.length === 0) {
      const err = new Error('This assessment has no questions'); err.status = 400; throw err
    }

    // Find lesson context (if quiz is linked to a lesson)
    const { lessonId, moduleId, courseId } = req.body || {}

    // Count attempt number
    const prevSnap = await db.collection('quizAttempts')
      .where('quizId', '==', quizId)
      .where('traineeId', '==', traineeId)
      .get()
    const attemptNumber = prevSnap.size + 1

    const ref = db.collection('quizAttempts').doc()
    const sanitized = sanitizeQuestionsForClient(questions, quiz, ref.id)
    const questionOrder = sanitized.map((q) => q.id)

    await ref.set({
      quizId,
      lessonId: lessonId || null,
      moduleId: moduleId || null,
      courseId: courseId || quiz.courseId,
      traineeId,
      attemptNumber,
      status: 'in_progress',
      answers: [],
      questionOrder,
      score: null,
      pointsEarned: null,
      totalPoints: quiz.totalPoints || 0,
      passed: null,
      timeLimitMinutes: quiz.timeLimitMinutes || null,
      startedAt: FieldValue.serverTimestamp(),
      submittedAt: null,
      durationSeconds: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    res.status(201).json({
      attemptId: ref.id,
      quizType: quiz.type,
      quizTitle: quiz.title,
      description: quiz.description,
      displayMode: quiz.displayMode,
      timeLimitMinutes: quiz.timeLimitMinutes || null,
      passMark: quiz.passMark,
      attemptNumber,
      questions: sanitized,
    })
  } catch (e) { next(e) }
})

// Get attempt details
traineeQuizRouter.get('/attempts/:attemptId', async (req, res, next) => {
  try {
    const db = dbRequired()
    const doc = await db.collection('quizAttempts').doc(req.params.attemptId).get()
    if (!doc.exists) { const err = new Error('Attempt not found'); err.status = 404; throw err }
    const attempt = { id: doc.id, ...doc.data() }
    if (attempt.traineeId !== req.user.uid) {
      const err = new Error('Forbidden'); err.status = 403; throw err
    }

    if (attempt.status === 'in_progress') {
      // Return questions without correct answers
      const quizDoc = await db.collection('quizzes').doc(attempt.quizId).get()
      const quiz = { id: quizDoc.id, ...quizDoc.data() }
      const qSnap = await db.collection('questions').where('quizId', '==', attempt.quizId).get()
      const questions = qSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const sanitized = sanitizeQuestionsForClient(questions, quiz, doc.id)
      return res.json({
        ...serializeDoc(doc),
        questions: sanitized,
      })
    }

    // Submitted — return full results with correct answers and explanations
    const qSnap = await db.collection('questions').where('quizId', '==', attempt.quizId).get()
    const questions = qSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    const questionDetails = questions.map((q) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      points: q.points || 1,
      explanation: q.explanation || null,
      options: (q.options || []).map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
    }))

    res.json({
      ...serializeDoc(doc),
      questions: questionDetails,
    })
  } catch (e) { next(e) }
})

// Submit attempt
traineeQuizRouter.post('/attempts/:attemptId/submit', async (req, res, next) => {
  try {
    const db = dbRequired()
    const ref = db.collection('quizAttempts').doc(req.params.attemptId)
    const doc = await ref.get()
    if (!doc.exists) { const err = new Error('Attempt not found'); err.status = 404; throw err }
    const attempt = doc.data()
    if (attempt.traineeId !== req.user.uid) {
      const err = new Error('Forbidden'); err.status = 403; throw err
    }
    if (attempt.status !== 'in_progress') {
      const err = new Error('Attempt already submitted'); err.status = 400; throw err
    }

    const submittedAnswers = req.body?.answers || []
    const quizDoc = await db.collection('quizzes').doc(attempt.quizId).get()
    const quiz = quizDoc.data()
    const qSnap = await db.collection('questions').where('quizId', '==', attempt.quizId).get()
    const questions = qSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

    const { answers, pointsEarned, totalPoints, score, passed } = gradeAttempt(
      questions,
      submittedAnswers,
      quiz.type === 'exam' ? quiz.passMark : null,
    )

    const startedAt = attempt.startedAt?.toDate?.() || attempt.startedAt
    const now = new Date()
    const durationSeconds = startedAt ? Math.round((now - new Date(startedAt)) / 1000) : null

    await ref.update({
      status: 'submitted',
      answers,
      score,
      pointsEarned,
      totalPoints,
      passed,
      submittedAt: FieldValue.serverTimestamp(),
      durationSeconds,
      updatedAt: FieldValue.serverTimestamp(),
    })

    // Mark lesson as completed for quizzes (always) or exams (only on pass)
    const lessonId = attempt.lessonId
    if (lessonId) {
      const shouldComplete = quiz.type === 'quiz' || (quiz.type === 'exam' && passed)
      if (shouldComplete) {
        const progressId = `${req.user.uid}_${lessonId}`
        await db.collection('lessonProgress').doc(progressId).set({
          lessonId,
          moduleId: attempt.moduleId,
          courseId: attempt.courseId,
          traineeId: req.user.uid,
          status: 'completed',
          lessonType: quiz.type,
          score,
          attemptCount: attempt.attemptNumber,
          completedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true })
      }

      // Trigger progress recalculation (Module 6)
      try {
        const { recalculateModuleProgress, recalculateCourseProgress } = await import('../services/progressEngine.js')
        if (attempt.moduleId) {
          await recalculateModuleProgress(db, req.user.uid, attempt.moduleId)
        }
        if (attempt.courseId) {
          await recalculateCourseProgress(db, req.user.uid, attempt.courseId)
        }
      } catch {
        // Progress engine may not be ready yet; non-fatal
      }
    }

    // Return results with question details
    const questionDetails = questions.map((q) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      points: q.points || 1,
      explanation: q.explanation || null,
      options: (q.options || []).map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
    }))

    const updated = await ref.get()
    res.json({
      ...serializeDoc(updated),
      questions: questionDetails,
    })
  } catch (e) { next(e) }
})

// List own attempts for a quiz
traineeQuizRouter.get('/quizzes/:quizId/attempts', async (req, res, next) => {
  try {
    const db = dbRequired()
    const snap = await db.collection('quizAttempts')
      .where('quizId', '==', req.params.quizId)
      .where('traineeId', '==', req.user.uid)
      .get()
    const rows = snap.docs.map((d) => serializeDoc(d))
      .sort((a, b) => (a.attemptNumber || 0) - (b.attemptNumber || 0))
    res.json(rows)
  } catch (e) { next(e) }
})
