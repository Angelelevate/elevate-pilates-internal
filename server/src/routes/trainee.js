import { Router } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { requireNoForcedPasswordChange } from '../middleware/mustChangePasswordMiddleware.js'
import { getVideoSignedUrl } from '../services/storage.js'
import { getDb } from '../utils/firestoreDb.js'
import { getDocSnapshotsById } from '../utils/firestoreBatch.js'
import { serializeDoc, serializeValue } from '../utils/serialize.js'
import {
  recalculateModuleProgress,
  recalculateCourseProgress,
  healStuckModules,
} from '../services/progressEngine.js'

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

/**
 * Content reachable by an ALREADY-ENROLLED trainee. Unpublishing a course cascades
 * `draft` down the whole course/module/lesson tree (see setCourseTreeStatus), so if
 * we gated trainees on `status === 'published'` an admin unpublishing a course to edit
 * it would instantly 403 every enrolled trainee and appear to wipe their progress.
 * Only `archived` (soft-deleted) content is truly hidden from enrolled trainees.
 * New enrollments / the course catalog remain gated on `published` elsewhere.
 */
function isTraineeAccessible(status) {
  return status !== 'archived'
}

async function loadAccessibleLessonsForCourse(db, courseId) {
  const snap = await db.collection('lessons').where('courseId', '==', courseId).get()
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((l) => isTraineeAccessible(l.status))
}

async function loadAccessibleModulesForCourse(db, courseId) {
  const snap = await db.collection('modules').where('courseId', '==', courseId).get()
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => isTraineeAccessible(m.status))
    .sort((a, b) => (a.order || 0) - (b.order || 0))
}

/** Batched reads — avoids one round-trip per lesson (was the main dashboard slowdown). */
async function loadLessonProgressMap(db, traineeId, lessonIds) {
  const uniq = [...new Set(lessonIds.filter(Boolean))]
  const map = new Map()
  if (uniq.length === 0) return map
  const chunkSize = 10
  const chunks = []
  for (let i = 0; i < uniq.length; i += chunkSize) {
    chunks.push(uniq.slice(i, i + chunkSize))
  }
  const chunkSnapshots = await Promise.all(
    chunks.map((chunk) => {
      const refs = chunk.map((lid) =>
        db.collection('lessonProgress').doc(progressDocId(traineeId, lid)),
      )
      return db.getAll(...refs)
    }),
  )
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i]
    const snaps = chunkSnapshots[i]
    for (let j = 0; j < chunk.length; j += 1) {
      const doc = snaps[j]
      if (doc.exists) map.set(chunk[j], { id: doc.id, ...doc.data() })
    }
  }
  return map
}

function isLessonCompleted(progress) {
  return progress?.status === 'completed'
}

/** Partial credit for in-progress video lessons (dashboard / module bars). */
function videoLessonProgressWeight(lesson, prog) {
  if (lesson.type !== 'video') return null
  if (!prog) return 0
  if (prog.status === 'completed') return 1
  const vp = prog.videoProgress
  if (!vp) return 0
  const pct = Number(vp.percentWatched)
  if (Number.isFinite(pct) && pct > 0) return Math.min(1, pct / 100)
  const dur = Number(lesson.content?.durationSeconds)
  const mr = Number(vp.maxReached)
  if (Number.isFinite(dur) && dur > 0 && Number.isFinite(mr) && mr > 0) {
    return Math.min(1, mr / dur)
  }
  return 0
}

function lessonProgressWeight(lesson, prog) {
  if (!prog) return 0
  if (isLessonCompleted(prog)) return 1
  const vw = videoLessonProgressWeight(lesson, prog)
  if (vw !== null) return vw
  return 0
}

function sumLessonWeights(lessons, progressByLessonId) {
  let sum = 0
  for (const l of lessons) {
    sum += lessonProgressWeight(l, progressByLessonId.get(l.id) ?? null)
  }
  return sum
}

function moduleCompletionState(mod, lessons, progressByLessonId) {
  const criteria = mod.completionCriteria || {}
  const needExam = Boolean(criteria.examPassed)
  const accessibleLessons = lessons.filter((l) => isTraineeAccessible(l.status))
  let allDone = true
  for (const l of accessibleLessons) {
    const p = progressByLessonId.get(l.id) ?? null
    if (!isLessonCompleted(p)) {
      allDone = false
      break
    }
  }
  let examOk = true
  if (needExam) {
    const examLesson = accessibleLessons.find((l) => l.type === 'exam')
    if (examLesson) {
      const p = progressByLessonId.get(examLesson.id) ?? null
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
  const enrollment = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .find((e) => e.courseId === courseId && e.status !== 'withdrawn')
  if (!enrollment) {
    const err = new Error('Not enrolled in this course')
    err.status = 403
    throw err
  }
  const course = await db.collection('courses').doc(courseId).get()
  if (!course.exists || !isTraineeAccessible(course.data().status)) {
    const err = new Error('Course is not available')
    err.status = 403
    throw err
  }
  return enrollment
}

function computeModuleUnlock(modules, lessonsByModuleId, progressByLessonId) {
  const states = []
  for (let i = 0; i < modules.length; i += 1) {
    const mod = modules[i]
    const lessons = lessonsByModuleId.get(mod.id) || []
    const prev = i === 0 ? null : states[i - 1]
    const unlocked = i === 0 || (prev && prev.runtimeCompleted)
    const { completed, status, allDone, examOk } = moduleCompletionState(
      mod,
      lessons,
      progressByLessonId,
    )
    const runtimeCompleted = completed
    states.push({
      module: mod,
      lessons,
      unlocked,
      status: unlocked ? (completed ? 'completed' : status) : 'locked',
      completedLessonCount: countCompletedLessons(lessons, progressByLessonId),
      lessonCount: lessons.filter((l) => isTraineeAccessible(l.status)).length,
      runtimeCompleted,
      prerequisiteTitle: i > 0 ? modules[i - 1].title : null,
      allDone,
      examOk,
    })
  }
  return states
}

function countCompletedLessons(lessons, progressByLessonId) {
  let n = 0
  for (const l of lessons.filter((x) => isTraineeAccessible(x.status))) {
    const p = progressByLessonId.get(l.id) ?? null
    if (isLessonCompleted(p)) n += 1
  }
  return n
}

async function buildLiveCourseDashboardRow(db, traineeId, enrollment, courseDoc) {
  const courseId = enrollment.courseId
  const [modules, allLessons] = await Promise.all([
    loadAccessibleModulesForCourse(db, courseId),
    loadAccessibleLessonsForCourse(db, courseId),
  ])

  const lessonsByModule = new Map()
  for (const l of allLessons) {
    const arr = lessonsByModule.get(l.moduleId) || []
    arr.push(l)
    lessonsByModule.set(l.moduleId, arr)
  }

  const progressByLessonId = await loadLessonProgressMap(
    db,
    traineeId,
    allLessons.map((l) => l.id),
  )
  const states = computeModuleUnlock(modules, lessonsByModule, progressByLessonId)
  const totalLessons = allLessons.length
  let completedLessons = 0
  for (const l of allLessons) {
    const p = progressByLessonId.get(l.id)
    if (isLessonCompleted(p)) completedLessons += 1
  }
  const weightedSum = sumLessonWeights(allLessons, progressByLessonId)
  const courseProgressPercent =
    totalLessons === 0 ? 0 : Math.round((weightedSum / totalLessons) * 100)

  return {
    enrollment,
    course: serializeDoc(courseDoc),
    courseProgressPercent,
    completedLessons,
    totalLessons,
    modules: states.map((s) => {
      const w = sumLessonWeights(
        s.lessons.filter((l) => isTraineeAccessible(l.status)),
        progressByLessonId,
      )
      return {
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
          s.lessonCount === 0 ? 0 : Math.round((w / s.lessonCount) * 100),
      }
    }),
  }
}

traineeRouter.get('/enrollments', async (req, res, next) => {
  try {
    const db = dbRequired()
    const snap = await db.collection('enrollments').where('traineeId', '==', req.user.uid).get()
    const enrollments = snap.docs.map((d) => serializeDoc(d))
    const courseById = await getDocSnapshotsById(
      db,
      'courses',
      enrollments.map((e) => e.courseId),
    )
    const rows = enrollments.map((en) => {
      const c = courseById.get(en.courseId)
      return {
        ...en,
        course: c?.exists ? serializeDoc(c) : null,
      }
    })
    res.json(rows)
  } catch (e) {
    next(e)
  }
})

traineeRouter.get('/courses', async (req, res, next) => {
  try {
    const db = dbRequired()
    const snap = await db.collection('enrollments').where('traineeId', '==', req.user.uid).get()
    const enrolled = snap.docs
      .map((d) => ({ enrollment: serializeDoc(d), data: d.data() }))
      .filter(({ data }) => data.status === 'active' || data.status === 'completed')

    const courseById = await getDocSnapshotsById(
      db,
      'courses',
      enrolled.map((x) => x.data.courseId),
    )

    const visible = enrolled.filter(({ data: enData }) => {
      const courseDoc = courseById.get(enData.courseId)
      return courseDoc?.exists && isTraineeAccessible(courseDoc.data().status)
    })
    const uniqueCourseIds = [...new Set(visible.map((x) => x.data.courseId))]

    const modulesByCourseId = new Map(
      await Promise.all(
        uniqueCourseIds.map(async (courseId) => [courseId, await loadAccessibleModulesForCourse(db, courseId)]),
      ),
    )
    const allModuleIds = []
    for (const courseId of uniqueCourseIds) {
      const modules = modulesByCourseId.get(courseId) || []
      for (const mod of modules) allModuleIds.push(mod.id)
    }

    // Heal modules stuck at 100% lessons / still in_progress (exam-gate bug) so the
    // dashboard unlock state matches reality before we read the cached summaries.
    await Promise.all(
      uniqueCourseIds.map(async (courseId) => {
        try {
          await healStuckModules(db, req.user.uid, courseId)
        } catch (healErr) {
          console.warn('[progress] Dashboard heal failed for', courseId, healErr?.message)
        }
      }),
    )

    const courseProgressById = await getDocSnapshotsById(
      db,
      'courseProgress',
      uniqueCourseIds.map((courseId) => `${req.user.uid}_${courseId}`),
    )
    const moduleProgressById = await getDocSnapshotsById(
      db,
      'moduleProgress',
      allModuleIds.map((moduleId) => `${req.user.uid}_${moduleId}`),
    )

    const rows = await Promise.all(
      visible.map(async ({ enrollment, data: enData }) => {
        const courseId = enData.courseId
        const courseDoc = courseById.get(courseId)
        if (!courseDoc?.exists) return null

        const modules = modulesByCourseId.get(courseId) || []
        const cpDoc = courseProgressById.get(`${req.user.uid}_${courseId}`)
        const cp = cpDoc?.exists ? cpDoc.data() : null

        const moduleRows = modules.map((mod, i) => {
          const mpDoc = moduleProgressById.get(`${req.user.uid}_${mod.id}`)
          const mp = mpDoc?.exists ? mpDoc.data() : null
          const status = mp?.status || (i === 0 ? 'in_progress' : 'locked')
          const lessonCount = Number.isFinite(Number(mp?.totalLessons))
            ? Number(mp.totalLessons)
            : 0
          const completedLessonCount = Number.isFinite(Number(mp?.completedLessons))
            ? Number(mp.completedLessons)
            : 0
          const progressPercent = Number.isFinite(Number(mp?.percentComplete))
            ? Math.max(0, Math.min(100, Math.round(Number(mp.percentComplete))))
            : lessonCount > 0
              ? Math.round((completedLessonCount / lessonCount) * 100)
              : 0

          return {
            id: mod.id,
            title: mod.title,
            description: mod.description,
            order: mod.order,
            status,
            unlocked: status !== 'locked',
            prerequisiteTitle: i > 0 ? modules[i - 1].title : null,
            lessonCount,
            completedLessonCount,
            progressPercent,
            hasSummary: Boolean(mp),
          }
        })

        const missingModuleSummaries = moduleRows.some((m) => !m.hasSummary)
        const shouldFallbackToLive = !cp || (modules.length > 0 && missingModuleSummaries)
        if (shouldFallbackToLive) {
          return buildLiveCourseDashboardRow(db, req.user.uid, enrollment, courseDoc)
        }

        const totalLessons = Number.isFinite(Number(cp.totalLessons))
          ? Number(cp.totalLessons)
          : moduleRows.reduce((sum, m) => sum + m.lessonCount, 0)
        const completedLessons = Number.isFinite(Number(cp.completedLessons))
          ? Number(cp.completedLessons)
          : moduleRows.reduce((sum, m) => sum + m.completedLessonCount, 0)
        const courseProgressPercent = Number.isFinite(Number(cp.percentComplete))
          ? Math.max(0, Math.min(100, Math.round(Number(cp.percentComplete))))
          : totalLessons > 0
            ? Math.round((completedLessons / totalLessons) * 100)
            : 0

        return {
          enrollment,
          course: serializeDoc(courseDoc),
          courseProgressPercent,
          completedLessons,
          totalLessons,
          modules: moduleRows.map(({ hasSummary, ...m }) => m),
        }
      }),
    )

    res.json(rows.filter(Boolean))
  } catch (e) {
    next(e)
  }
})

traineeRouter.get('/courses/:courseId', async (req, res, next) => {
  try {
    const db = dbRequired()
    const { courseId } = req.params
    await assertEnrollment(db, req.user.uid, courseId)
    const [courseDoc, modules, allLessons] = await Promise.all([
      db.collection('courses').doc(courseId).get(),
      loadAccessibleModulesForCourse(db, courseId),
      loadAccessibleLessonsForCourse(db, courseId),
    ])
    const lessonsByModule = new Map()
    for (const l of allLessons) {
      const arr = lessonsByModule.get(l.moduleId) || []
      arr.push(l)
      lessonsByModule.set(l.moduleId, arr)
    }
    let progressByLessonId = await loadLessonProgressMap(
      db,
      req.user.uid,
      allLessons.map((l) => l.id),
    )
    const states = computeModuleUnlock(modules, lessonsByModule, progressByLessonId)
    try {
      const forceIds = states.filter((s) => s.runtimeCompleted).map((s) => s.module.id)
      const healed = await healStuckModules(db, req.user.uid, courseId, forceIds)
      // healStuckModules writes lessonProgress/moduleProgress directly to Firestore —
      // the in-memory map above was loaded before those writes, so it must be re-read
      // for the recompute below to actually see them (same request, not just next load).
      if (healed) {
        progressByLessonId = await loadLessonProgressMap(
          db,
          req.user.uid,
          allLessons.map((l) => l.id),
        )
      }
    } catch (healErr) {
      console.warn('[progress] Course heal failed for', courseId, healErr?.message)
    }
    // Recompute after heal so unlock status reflects any cascading unlocks.
    const statesAfter = computeModuleUnlock(modules, lessonsByModule, progressByLessonId)
    const totalLessons = allLessons.length
    let completedLessons = 0
    for (const l of allLessons) {
      const p = progressByLessonId.get(l.id)
      if (isLessonCompleted(p)) completedLessons += 1
    }
    const weightedSum = sumLessonWeights(allLessons, progressByLessonId)
    res.json({
      course: serializeDoc(courseDoc),
      courseProgressPercent:
        totalLessons === 0 ? 0 : Math.round((weightedSum / totalLessons) * 100),
      modules: statesAfter.map((s) => {
        const w = sumLessonWeights(
          s.lessons.filter((l) => isTraineeAccessible(l.status)),
          progressByLessonId,
        )
        return {
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
            s.lessonCount === 0 ? 0 : Math.round((w / s.lessonCount) * 100),
        }
      }),
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
      const [modDoc, modules, allLessons] = await Promise.all([
        db.collection('modules').doc(moduleId).get(),
        loadAccessibleModulesForCourse(db, courseId),
        loadAccessibleLessonsForCourse(db, courseId),
      ])
      if (!modDoc.exists || modDoc.data().courseId !== courseId) {
        const err = new Error('Module not found')
        err.status = 404
        throw err
      }
      const mod = { id: modDoc.id, ...modDoc.data() }
      if (!isTraineeAccessible(mod.status)) {
        const err = new Error('Module is not available')
        err.status = 403
        throw err
      }
      const lessonsByModule = new Map()
      for (const l of allLessons) {
        const arr = lessonsByModule.get(l.moduleId) || []
        arr.push(l)
        lessonsByModule.set(l.moduleId, arr)
      }
      let progressByLessonId = await loadLessonProgressMap(
        db,
        req.user.uid,
        allLessons.map((l) => l.id),
      )
      let states = computeModuleUnlock(modules, lessonsByModule, progressByLessonId)

      // Self-heal stale progression caches (modules stuck at 100% / in_progress from the
      // historical exam-gate bug) BEFORE the unlock check below — a module that's actually
      // stuck locked must never 403 here without a chance to heal first, otherwise every
      // request into it throws before healStuckModules can ever run.
      try {
        const forceIds = states.filter((s) => s.runtimeCompleted).map((s) => s.module.id)
        const healed = await healStuckModules(db, req.user.uid, courseId, forceIds)
        if (healed) {
          progressByLessonId = await loadLessonProgressMap(
            db,
            req.user.uid,
            allLessons.map((l) => l.id),
          )
          states = computeModuleUnlock(modules, lessonsByModule, progressByLessonId)
        }
      } catch {
        // Non-fatal: healing is best-effort and must never block reading the module.
      }

      const state = states.find((s) => s.module.id === moduleId)
      if (!state || !state.unlocked) {
        const err = new Error('Module is locked')
        err.status = 403
        throw err
      }

      const lessons = (lessonsByModule.get(moduleId) || [])
        .filter((l) => isTraineeAccessible(l.status))
        .sort((a, b) => (a.order || 0) - (b.order || 0))
      const lessonRows = []
      for (const l of lessons) {
        const p = progressByLessonId.get(l.id) ?? null
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
      return
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
      const [modDoc, allLessons, modules, lessonDoc] = await Promise.all([
        db.collection('modules').doc(moduleId).get(),
        loadAccessibleLessonsForCourse(db, courseId),
        loadAccessibleModulesForCourse(db, courseId),
        db.collection('lessons').doc(lessonId).get(),
      ])
      if (!modDoc.exists || modDoc.data().courseId !== courseId) {
        const err = new Error('Module not found')
        err.status = 404
        throw err
      }
      if (!isTraineeAccessible(modDoc.data().status)) {
        const err = new Error('Module is not available')
        err.status = 403
        throw err
      }
      const lessonsByModule = new Map()
      for (const l of allLessons) {
        const arr = lessonsByModule.get(l.moduleId) || []
        arr.push(l)
        lessonsByModule.set(l.moduleId, arr)
      }
      const progressByLessonId = await loadLessonProgressMap(
        db,
        req.user.uid,
        allLessons.map((l) => l.id),
      )
      const states = computeModuleUnlock(modules, lessonsByModule, progressByLessonId)
      const state = states.find((s) => s.module.id === moduleId)
      if (!state || !state.unlocked) {
        const err = new Error('Module is locked')
        err.status = 403
        throw err
      }
      if (!lessonDoc.exists || lessonDoc.data().moduleId !== moduleId) {
        const err = new Error('Lesson not found')
        err.status = 404
        throw err
      }
      if (!isTraineeAccessible(lessonDoc.data().status)) {
        const err = new Error('Lesson is not available')
        err.status = 403
        throw err
      }
      const lesson = serializeDoc(lessonDoc)
      // Always mint a fresh signed URL for playback. Stored content.downloadUrl is a
      // time-limited GCS signature (max ~7 days) and must not be used as the durable source.
      if (lesson.type === 'video' && lesson.content?.storagePath) {
        try {
          const downloadUrl = await getVideoSignedUrl(lesson.content.storagePath)
          lesson.content = { ...lesson.content, downloadUrl }
        } catch (signErr) {
          console.warn('[video] Failed to sign playback URL for lesson', lessonId, signErr?.message)
          // Leave storagePath; client can still hit /video-url as a fallback.
          if (lesson.content) {
            lesson.content = { ...lesson.content, downloadUrl: null }
          }
        }
      }
      const progress = progressByLessonId.get(lessonId) ?? null
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
      if (!isTraineeAccessible(lesson.status)) {
        const err = new Error('Lesson is not available')
        err.status = 403
        throw err
      }
      if (lesson.type === 'reading' || lesson.type === 'quiz') {
        // ok
      } else if (lesson.type === 'exam') {
        const err = new Error('Complete the exam via the quiz engine')
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
      // Trigger progress recalculation
      try {
        await recalculateModuleProgress(db, req.user.uid, lesson.moduleId)
        await recalculateCourseProgress(db, req.user.uid, courseId)
      } catch (progressErr) {
        console.warn('[progress] Recalculation failed after lesson complete:', progressErr?.message)
      }
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
      if (!isTraineeAccessible(lesson.status)) {
        const err = new Error('Lesson is not available')
        err.status = 403
        throw err
      }
      const lastPosition = Number(req.body?.lastPosition) || 0
      const maxReached = Number(req.body?.maxReached) || 0
      const percentWatched = Number(req.body?.percentWatched) || 0
      const watchedToEnd = Boolean(req.body?.watchedToEnd)
      const id = progressDocId(req.user.uid, lessonId)
      const ref = db.collection('lessonProgress').doc(id)
      const existingSnap = await ref.get()
      const createdAt = existingSnap.exists
        ? existingSnap.data().createdAt
        : FieldValue.serverTimestamp()
      const completed = percentWatched >= 90 || watchedToEnd
      const storedPercent = completed ? Math.max(percentWatched, 100) : percentWatched
      const patch = {
        lessonId,
        moduleId: lesson.moduleId,
        courseId,
        traineeId: req.user.uid,
        status: completed ? 'completed' : 'in_progress',
        lessonType: 'video',
        videoProgress: {
          lastPosition,
          maxReached: watchedToEnd ? Math.max(maxReached, lastPosition) : maxReached,
          percentWatched: storedPercent,
        },
        updatedAt: FieldValue.serverTimestamp(),
        createdAt,
      }
      if (completed) {
        patch.completedAt = FieldValue.serverTimestamp()
      } else {
        patch.completedAt = FieldValue.delete()
      }
      await ref.set(patch, { merge: true })
      // Trigger progress recalculation on video completion
      if (completed) {
        try {
          await recalculateModuleProgress(db, req.user.uid, lesson.moduleId)
          await recalculateCourseProgress(db, req.user.uid, courseId)
        } catch (progressErr) {
          console.warn('[progress] Recalculation failed after video progress:', progressErr?.message)
        }
      }
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
    const lessons = await loadAccessibleLessonsForCourse(db, courseId)
    const progressByLessonId = await loadLessonProgressMap(
      db,
      req.user.uid,
      lessons.map((l) => l.id),
    )
    const rows = []
    for (const l of lessons) {
      const p = progressByLessonId.get(l.id)
      if (p) rows.push(serializeValue(p))
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
    if (!isTraineeAccessible(lesson.status)) {
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
