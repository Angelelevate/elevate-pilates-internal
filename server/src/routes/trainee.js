import { Router } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { requireNoForcedPasswordChange } from '../middleware/mustChangePasswordMiddleware.js'
import { getVideoSignedUrl } from '../services/storage.js'
import { getDb } from '../utils/firestoreDb.js'
import { serializeDoc } from '../utils/serialize.js'

export const traineeRouter = Router()

traineeRouter.use(
  requireAuth,
  requireRole('trainee'),
  requireNoForcedPasswordChange,
)

function dbRequired() {
  const db = getDb()
  if (!db) {
    const err = new Error('Database not configured')
    err.status = 503
    throw err
  }
  return db
}

function progressDocId(traineeId, lessonId) {
  return `${traineeId}_${lessonId}`
}

async function loadPublishedLessonsForCourse(db, courseId) {
  const snap = await db.collection('lessons').where('courseId', '==', courseId).get()
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((l) => l.status === 'published')
}

async function loadPublishedModulesForCourse(db, courseId) {
  const snap = await db.collection('modules').where('courseId', '==', courseId).get()
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => m.status === 'published')
    .sort((a, b) => (a.order || 0) - (b.order || 0))
}

async function getLessonProgress(db, traineeId, lessonId) {
  const id = progressDocId(traineeId, lessonId)
  const doc = await db.collection('lessonProgress').doc(id).get()
  return doc.exists ? { id: doc.id, ...doc.data() } : null
}

function isLessonCompleted(progress) {
  return progress?.status === 'completed'
}

async function moduleCompletionState(db, traineeId, mod, lessons) {
  const criteria = mod.completionCriteria || {}
  const needExam = Boolean(criteria.examPassed)
  const publishedLessons = lessons.filter((l) => l.status === 'published')
  let allDone = true
  for (const l of publishedLessons) {
    const p = await getLessonProgress(db, traineeId, l.id)
    if (!isLessonCompleted(p)) {
      allDone = false
      break
    }
  }
  let examOk = true
  if (needExam) {
    const examLesson = publishedLessons.find((l) => l.type === 'exam')
    if (examLesson) {
      const p = await getLessonProgress(db, traineeId, examLesson.id)
      examOk = isLessonCompleted(p)
    } else {
      examOk = true
    }
  }
  const completed = allDone && examOk
  let status = 'in_progress'
  if (completed) status = 'completed'
  return { completed, status, allDone, examOk }
}

async function assertEnrollment(db, traineeId, courseId) {
  const snap = await db
    .collection('enrollments')
    .where('traineeId', '==', traineeId)
    .get()
  const active = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .find((e) => e.courseId === courseId && e.status === 'active')
  if (!active) {
    const err = new Error('Not enrolled in this course')
    err.status = 403
    throw err
  }
  const course = await db.collection('courses').doc(courseId).get()
  if (!course.exists || course.data().status !== 'published') {
    const err = new Error('Course is not available')
    err.status = 403
    throw err
  }
  return active
}

async function computeModuleUnlock(db, traineeId, courseId, modules, lessonsByModuleId) {
  const states = []
  for (let i = 0; i < modules.length; i += 1) {
    const mod = modules[i]
    const lessons = lessonsByModuleId.get(mod.id) || []
    const prev = i === 0 ? null : states[i - 1]
    const unlocked = i === 0 || (prev && prev.runtimeCompleted)
    const { completed, status, allDone, examOk } = await moduleCompletionState(
      db,
      traineeId,
      mod,
      lessons,
    )
    const runtimeCompleted = completed
    states.push({
      module: mod,
      lessons,
      unlocked,
      status: unlocked ? (completed ? 'completed' : status) : 'locked',
      completedLessonCount: await countCompletedLessons(db, traineeId, lessons),
      lessonCount: lessons.filter((l) => l.status === 'published').length,
      runtimeCompleted,
      prerequisiteTitle: i > 0 ? modules[i - 1].title : null,
      allDone,
      examOk,
    })
  }
  return states
}

async function countCompletedLessons(db, traineeId, lessons) {
  let n = 0
  for (const l of lessons.filter((x) => x.status === 'published')) {
    const p = await getLessonProgress(db, traineeId, l.id)
    if (isLessonCompleted(p)) n += 1
  }
  return n
}

traineeRouter.get('/enrollments', async (req, res, next) => {
  try {
    const db = dbRequired()
    const snap = await db.collection('enrollments').where('traineeId', '==', req.user.uid).get()
    const rows = []
    for (const d of snap.docs) {
      const en = serializeDoc(d)
      const c = await db.collection('courses').doc(en.courseId).get()
      rows.push({
        ...en,
        course: c.exists ? serializeDoc(c) : null,
      })
    }
    res.json(rows)
  } catch (e) {
    next(e)
  }
})

traineeRouter.get('/courses', async (req, res, next) => {
  try {
    const db = dbRequired()
    const snap = await db.collection('enrollments').where('traineeId', '==', req.user.uid).get()
    const out = []
    for (const d of snap.docs) {
      const enData = d.data()
      if (enData.status !== 'active') continue
      const courseDoc = await db.collection('courses').doc(enData.courseId).get()
      if (!courseDoc.exists || courseDoc.data().status !== 'published') continue
      const courseId = enData.courseId
      const modules = await loadPublishedModulesForCourse(db, courseId)
      const allLessons = await loadPublishedLessonsForCourse(db, courseId)
      const lessonsByModule = new Map()
      for (const l of allLessons) {
        const arr = lessonsByModule.get(l.moduleId) || []
        arr.push(l)
        lessonsByModule.set(l.moduleId, arr)
      }
      const states = await computeModuleUnlock(
        db,
        req.user.uid,
        courseId,
        modules,
        lessonsByModule,
      )
      const totalLessons = allLessons.length
      let completedLessons = 0
      for (const l of allLessons) {
        const p = await getLessonProgress(db, req.user.uid, l.id)
        if (isLessonCompleted(p)) completedLessons += 1
      }
      const courseProgressPercent =
        totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100)
      out.push({
        enrollment: serializeDoc(d),
        course: serializeDoc(courseDoc),
        courseProgressPercent,
        completedLessons,
        totalLessons,
        modules: states.map((s) => ({
          id: s.module.id,
          title: s.module.title,
          description: s.module.description,
          order: s.module.order,
          status: s.status,
          unlocked: s.unlocked,
          prerequisiteTitle: s.prerequisiteTitle,
          lessonCount: s.lessonCount,
          completedLessonCount: s.completedLessonCount,
          progressPercent:
            s.lessonCount === 0
              ? 0
              : Math.round((s.completedLessonCount / s.lessonCount) * 100),
        })),
      })
    }
    res.json(out)
  } catch (e) {
    next(e)
  }
})

traineeRouter.get('/courses/:courseId', async (req, res, next) => {
  try {
    const db = dbRequired()
    const { courseId } = req.params
    await assertEnrollment(db, req.user.uid, courseId)
    const courseDoc = await db.collection('courses').doc(courseId).get()
    const modules = await loadPublishedModulesForCourse(db, courseId)
    const allLessons = await loadPublishedLessonsForCourse(db, courseId)
    const lessonsByModule = new Map()
    for (const l of allLessons) {
      const arr = lessonsByModule.get(l.moduleId) || []
      arr.push(l)
      lessonsByModule.set(l.moduleId, arr)
    }
    const states = await computeModuleUnlock(
      db,
      req.user.uid,
      courseId,
      modules,
      lessonsByModule,
    )
    const totalLessons = allLessons.length
    let completedLessons = 0
    for (const l of allLessons) {
      const p = await getLessonProgress(db, req.user.uid, l.id)
      if (isLessonCompleted(p)) completedLessons += 1
    }
    res.json({
      course: serializeDoc(courseDoc),
      courseProgressPercent:
        totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100),
      modules: states.map((s) => ({
        id: s.module.id,
        title: s.module.title,
        description: s.module.description,
        order: s.module.order,
        status: s.status,
        unlocked: s.unlocked,
        prerequisiteTitle: s.prerequisiteTitle,
        lessonCount: s.lessonCount,
        completedLessonCount: s.completedLessonCount,
        progressPercent:
          s.lessonCount === 0
            ? 0
            : Math.round((s.completedLessonCount / s.lessonCount) * 100),
      })),
    })
  } catch (e) {
    next(e)
  }
})

traineeRouter.get(
  '/courses/:courseId/modules/:moduleId',
  async (req, res, next) => {
    try {
      const db = dbRequired()
      const { courseId, moduleId } = req.params
      await assertEnrollment(db, req.user.uid, courseId)
      const modDoc = await db.collection('modules').doc(moduleId).get()
      if (!modDoc.exists || modDoc.data().courseId !== courseId) {
        const err = new Error('Module not found')
        err.status = 404
        throw err
      }
      const mod = { id: modDoc.id, ...modDoc.data() }
      if (mod.status !== 'published') {
        const err = new Error('Module is not available')
        err.status = 403
        throw err
      }
      const modules = await loadPublishedModulesForCourse(db, courseId)
      const allLessons = await loadPublishedLessonsForCourse(db, courseId)
      const lessonsByModule = new Map()
      for (const l of allLessons) {
        const arr = lessonsByModule.get(l.moduleId) || []
        arr.push(l)
        lessonsByModule.set(l.moduleId, arr)
      }
      const states = await computeModuleUnlock(
        db,
        req.user.uid,
        courseId,
        modules,
        lessonsByModule,
      )
      const state = states.find((s) => s.module.id === moduleId)
      if (!state || !state.unlocked) {
        const err = new Error('Module is locked')
        err.status = 403
        throw err
      }
      const lessons = (lessonsByModule.get(moduleId) || [])
        .filter((l) => l.status === 'published')
        .sort((a, b) => (a.order || 0) - (b.order || 0))
      const lessonRows = []
      for (const l of lessons) {
        const p = await getLessonProgress(db, req.user.uid, l.id)
        lessonRows.push({
          id: l.id,
          title: l.title,
          type: l.type,
          order: l.order,
          status: p?.status || 'not_started',
          score: p?.score ?? null,
          attemptCount: p?.attemptCount ?? 0,
        })
      }
      const firstIncomplete = lessonRows.find((r) => r.status !== 'completed')
      res.json({
        module: serializeDoc(modDoc),
        moduleStatus: state.status,
        lessons: lessonRows,
        continueLessonId: firstIncomplete?.id ?? lessonRows[0]?.id ?? null,
      })
    } catch (e) {
      next(e)
    }
  },
)

traineeRouter.get(
  '/courses/:courseId/modules/:moduleId/lessons/:lessonId',
  async (req, res, next) => {
    try {
      const db = dbRequired()
      const { courseId, moduleId, lessonId } = req.params
      await assertEnrollment(db, req.user.uid, courseId)
      const modDoc = await db.collection('modules').doc(moduleId).get()
      if (!modDoc.exists || modDoc.data().courseId !== courseId) {
        const err = new Error('Module not found')
        err.status = 404
        throw err
      }
      if (modDoc.data().status !== 'published') {
        const err = new Error('Module is not available')
        err.status = 403
        throw err
      }
      const modules = await loadPublishedModulesForCourse(db, courseId)
      const allLessons = await loadPublishedLessonsForCourse(db, courseId)
      const lessonsByModule = new Map()
      for (const l of allLessons) {
        const arr = lessonsByModule.get(l.moduleId) || []
        arr.push(l)
        lessonsByModule.set(l.moduleId, arr)
      }
      const states = await computeModuleUnlock(
        db,
        req.user.uid,
        courseId,
        modules,
        lessonsByModule,
      )
      const state = states.find((s) => s.module.id === moduleId)
      if (!state || !state.unlocked) {
        const err = new Error('Module is locked')
        err.status = 403
        throw err
      }
      const lessonDoc = await db.collection('lessons').doc(lessonId).get()
      if (!lessonDoc.exists || lessonDoc.data().moduleId !== moduleId) {
        const err = new Error('Lesson not found')
        err.status = 404
        throw err
      }
      if (lessonDoc.data().status !== 'published') {
        const err = new Error('Lesson is not available')
        err.status = 403
        throw err
      }
      const lesson = serializeDoc(lessonDoc)
      const progress = await getLessonProgress(db, req.user.uid, lessonId)
      res.json({ lesson, progress })
    } catch (e) {
      next(e)
    }
  },
)

traineeRouter.post(
  '/progress/lessons/:lessonId/complete',
  async (req, res, next) => {
    try {
      const db = dbRequired()
      const { lessonId } = req.params
      const lessonDoc = await db.collection('lessons').doc(lessonId).get()
      if (!lessonDoc.exists) {
        const err = new Error('Lesson not found')
        err.status = 404
        throw err
      }
      const lesson = lessonDoc.data()
      const { courseId } = lesson
      await assertEnrollment(db, req.user.uid, courseId)
      if (lesson.status !== 'published') {
        const err = new Error('Lesson is not available')
        err.status = 403
        throw err
      }
      if (lesson.type === 'reading' || lesson.type === 'quiz') {
        // ok
      } else if (lesson.type === 'exam') {
        const err = new Error('Complete the exam via the quiz engine when available')
        err.status = 400
        throw err
      } else if (lesson.type === 'video') {
        const err = new Error('Use video-progress to complete video lessons')
        err.status = 400
        throw err
      }
      const id = progressDocId(req.user.uid, lessonId)
      const ref = db.collection('lessonProgress').doc(id)
      await ref.set(
        {
          lessonId,
          moduleId: lesson.moduleId,
          courseId,
          traineeId: req.user.uid,
          status: 'completed',
          lessonType: lesson.type,
          videoProgress: null,
          completedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      res.json(serializeDoc(await ref.get()))
    } catch (e) {
      next(e)
    }
  },
)

traineeRouter.post(
  '/progress/lessons/:lessonId/video-progress',
  async (req, res, next) => {
    try {
      const db = dbRequired()
      const { lessonId } = req.params
      const lessonDoc = await db.collection('lessons').doc(lessonId).get()
      if (!lessonDoc.exists) {
        const err = new Error('Lesson not found')
        err.status = 404
        throw err
      }
      const lesson = lessonDoc.data()
      if (lesson.type !== 'video') {
        const err = new Error('Not a video lesson')
        err.status = 400
        throw err
      }
      const { courseId } = lesson
      await assertEnrollment(db, req.user.uid, courseId)
      if (lesson.status !== 'published') {
        const err = new Error('Lesson is not available')
        err.status = 403
        throw err
      }
      const lastPosition = Number(req.body?.lastPosition) || 0
      const maxReached = Number(req.body?.maxReached) || 0
      const percentWatched = Number(req.body?.percentWatched) || 0
      const id = progressDocId(req.user.uid, lessonId)
      const ref = db.collection('lessonProgress').doc(id)
      const existingSnap = await ref.get()
      const createdAt = existingSnap.exists
        ? existingSnap.data().createdAt
        : FieldValue.serverTimestamp()
      const completed = percentWatched >= 90
      const patch = {
        lessonId,
        moduleId: lesson.moduleId,
        courseId,
        traineeId: req.user.uid,
        status: completed ? 'completed' : 'in_progress',
        lessonType: 'video',
        videoProgress: { lastPosition, maxReached, percentWatched },
        updatedAt: FieldValue.serverTimestamp(),
        createdAt,
      }
      if (completed) {
        patch.completedAt = FieldValue.serverTimestamp()
      } else {
        patch.completedAt = FieldValue.delete()
      }
      await ref.set(patch, { merge: true })
      const saved = await ref.get()
      res.json(serializeDoc(saved))
    } catch (e) {
      next(e)
    }
  },
)

traineeRouter.get('/progress/courses/:courseId', async (req, res, next) => {
  try {
    const db = dbRequired()
    const { courseId } = req.params
    await assertEnrollment(db, req.user.uid, courseId)
    const lessons = await loadPublishedLessonsForCourse(db, courseId)
    const rows = []
    for (const l of lessons) {
      const doc = await db
        .collection('lessonProgress')
        .doc(progressDocId(req.user.uid, l.id))
        .get()
      if (doc.exists) rows.push(serializeDoc(doc))
    }
    res.json(rows)
  } catch (e) {
    next(e)
  }
})

traineeRouter.get('/lessons/:lessonId/video-url', async (req, res, next) => {
  try {
    const db = dbRequired()
    const lessonDoc = await db.collection('lessons').doc(req.params.lessonId).get()
    if (!lessonDoc.exists) {
      const err = new Error('Lesson not found')
      err.status = 404
      throw err
    }
    const lesson = lessonDoc.data()
    if (lesson.type !== 'video') {
      const err = new Error('Not a video lesson')
      err.status = 400
      throw err
    }
    await assertEnrollment(db, req.user.uid, lesson.courseId)
    if (lesson.status !== 'published') {
      const err = new Error('Lesson is not available')
      err.status = 403
      throw err
    }
    const path = lesson.content?.storagePath
    if (!path) {
      const err = new Error('Video not uploaded')
      err.status = 404
      throw err
    }
    const url = await getVideoSignedUrl(path)
    res.json({ downloadUrl: url })
  } catch (e) {
    next(e)
  }
})
