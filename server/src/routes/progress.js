import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { requireNoForcedPasswordChange } from '../middleware/mustChangePasswordMiddleware.js'
import { getDb } from '../utils/firestoreDb.js'
import { getDocSnapshotsById } from '../utils/firestoreBatch.js'
import { serializeDoc } from '../utils/serialize.js'

export const traineeProgressRouter = Router()
traineeProgressRouter.use(requireAuth, requireRole('trainee'), requireNoForcedPasswordChange)

export const adminProgressRouter = Router()
adminProgressRouter.use(requireAuth, requireRole('admin'))

function dbRequired() {
  const db = getDb()
  if (!db) { const err = new Error('Database not configured'); err.status = 503; throw err }
  return db
}

function progressDocId(a, b) { return `${a}_${b}` }

// ── Trainee progress endpoints ──────────────────────────────────────

traineeProgressRouter.get('/courses/:courseId', async (req, res, next) => {
  try {
    const db = dbRequired()
    const { courseId } = req.params
    const cpDoc = await db.collection('courseProgress').doc(progressDocId(req.user.uid, courseId)).get()
    if (!cpDoc.exists) return res.json(null)
    res.json(serializeDoc(cpDoc))
  } catch (e) { next(e) }
})

traineeProgressRouter.get('/courses/:courseId/modules', async (req, res, next) => {
  try {
    const db = dbRequired()
    const snap = await db.collection('moduleProgress')
      .where('courseId', '==', req.params.courseId)
      .where('traineeId', '==', req.user.uid)
      .get()
    const rows = snap.docs.map((d) => serializeDoc(d))
    rows.sort((a, b) => (a.moduleId || '').localeCompare(b.moduleId || ''))
    res.json(rows)
  } catch (e) { next(e) }
})

traineeProgressRouter.get('/modules/:moduleId', async (req, res, next) => {
  try {
    const db = dbRequired()
    const mpDoc = await db.collection('moduleProgress').doc(progressDocId(req.user.uid, req.params.moduleId)).get()
    if (!mpDoc.exists) return res.json(null)

    // Include lesson-level detail
    const modDoc = await db.collection('modules').doc(req.params.moduleId).get()
    if (!modDoc.exists) return res.json(serializeDoc(mpDoc))

    const lessonSnap = await db.collection('lessons').where('moduleId', '==', req.params.moduleId).get()
    const lessons = lessonSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((l) => l.status === 'published')
      .sort((a, b) => (a.order || 0) - (b.order || 0))

    const progressById = await getDocSnapshotsById(
      db,
      'lessonProgress',
      lessons.map((l) => progressDocId(req.user.uid, l.id)),
    )

    const lessonDetails = lessons.map((l) => {
      const pDoc = progressById.get(progressDocId(req.user.uid, l.id))
      return {
        lessonId: l.id,
        title: l.title,
        type: l.type,
        status: pDoc?.exists ? pDoc.data().status : 'not_started',
      }
    })

    res.json({ ...serializeDoc(mpDoc), lessons: lessonDetails })
  } catch (e) { next(e) }
})

// ── Admin progress endpoints ────────────────────────────────────────

adminProgressRouter.get('/courses/:courseId', async (req, res, next) => {
  try {
    const db = dbRequired()
    const snap = await db.collection('courseProgress').where('courseId', '==', req.params.courseId).get()
    const courseProgressRows = snap.docs.map((d) => serializeDoc(d))
    const usersById = await getDocSnapshotsById(
      db,
      'users',
      courseProgressRows.map((cp) => cp.traineeId),
    )
    const rows = courseProgressRows.map((cp) => {
      const uDoc = usersById.get(cp.traineeId)
      return { ...cp, trainee: uDoc?.exists ? serializeDoc(uDoc) : null }
    })
    res.json(rows)
  } catch (e) { next(e) }
})

adminProgressRouter.get('/courses/:courseId/trainees/:traineeId', async (req, res, next) => {
  try {
    const db = dbRequired()
    const { courseId, traineeId } = req.params

    const cpDoc = await db.collection('courseProgress').doc(progressDocId(traineeId, courseId)).get()
    const mpSnap = await db.collection('moduleProgress')
      .where('courseId', '==', courseId)
      .where('traineeId', '==', traineeId)
      .get()

    const modSnap = await db.collection('modules').where('courseId', '==', courseId).get()
    const modules = modSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((m) => m.status === 'published')
      .sort((a, b) => (a.order || 0) - (b.order || 0))

    const mpMap = new Map(mpSnap.docs.map((d) => [d.data().moduleId, serializeDoc(d)]))

    const moduleBreakdown = modules.map((m) => ({
      moduleId: m.id,
      title: m.title,
      order: m.order,
      progress: mpMap.get(m.id) || null,
    }))

    res.json({
      courseProgress: cpDoc.exists ? serializeDoc(cpDoc) : null,
      modules: moduleBreakdown,
    })
  } catch (e) { next(e) }
})

adminProgressRouter.get('/courses/:courseId/summary', async (req, res, next) => {
  try {
    const db = dbRequired()
    const { courseId } = req.params

    const enSnap = await db.collection('enrollments').where('courseId', '==', courseId).get()
    const cpSnap = await db.collection('courseProgress').where('courseId', '==', courseId).get()
    const cpMap = new Map(cpSnap.docs.map((d) => [d.data().traineeId, d.data()]))

    let totalEnrolled = 0
    let completed = 0
    let progressSum = 0
    for (const d of enSnap.docs) {
      const en = d.data()
      if (en.status === 'withdrawn') continue
      totalEnrolled++
      const cp = cpMap.get(en.traineeId)
      if (cp?.status === 'completed' || en.status === 'completed') completed++
      progressSum += (cp?.percentComplete || 0)
    }

    const modSnap = await db.collection('modules').where('courseId', '==', courseId).get()
    const modules = modSnap.docs
      .filter((d) => d.data().status === 'published')
      .sort((a, b) => (a.data().order || 0) - (b.data().order || 0))

    const mpSnap = await db.collection('moduleProgress').where('courseId', '==', courseId).get()
    const moduleCounts = {}
    for (const d of mpSnap.docs) {
      const mp = d.data()
      if (mp.status === 'completed') {
        moduleCounts[mp.moduleId] = (moduleCounts[mp.moduleId] || 0) + 1
      }
    }

    const perModule = modules.map((d) => ({
      moduleId: d.id,
      title: d.data().title,
      order: d.data().order,
      completedCount: moduleCounts[d.id] || 0,
    }))

    res.json({
      totalEnrolled,
      completed,
      averageProgress: totalEnrolled === 0 ? 0 : Math.round(progressSum / totalEnrolled),
      perModule,
    })
  } catch (e) { next(e) }
})
