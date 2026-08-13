import { FieldValue } from 'firebase-admin/firestore'
import { getDocSnapshotsById } from '../utils/firestoreBatch.js'

function progressDocId(traineeId, id) {
  return `${traineeId}_${id}`
}

/**
 * Content that counts toward an enrolled trainee's progress. Unpublishing a course
 * cascades `draft` across its whole tree, so progress must be computed over all
 * non-archived content — otherwise recalculating an unpublished course would zero
 * out a trainee's completion counts. Only `archived` (soft-deleted) content is excluded.
 */
function isTraineeAccessible(status) {
  return status !== 'archived'
}

/**
 * Initialize courseProgress + moduleProgress when a trainee is enrolled.
 */
export async function initializeProgress(db, traineeId, courseId) {
  const modSnap = await db.collection('modules').where('courseId', '==', courseId).get()
  const modules = modSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => isTraineeAccessible(m.status))
    .sort((a, b) => (a.order || 0) - (b.order || 0))

  const lessonSnap = await db.collection('lessons').where('courseId', '==', courseId).get()
  const lessons = lessonSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((l) => isTraineeAccessible(l.status))

  const totalLessons = lessons.length
  const totalModules = modules.length

  const batch = db.batch()

  // Course progress
  const cpRef = db.collection('courseProgress').doc(progressDocId(traineeId, courseId))
  batch.set(cpRef, {
    courseId,
    traineeId,
    status: 'in_progress',
    percentComplete: 0,
    completedModules: 0,
    totalModules,
    completedLessons: 0,
    totalLessons,
    currentModuleId: modules[0]?.id || null,
    currentModuleOrder: modules[0]?.order || null,
    startedAt: null,
    completedAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })

  // Module progress for each module
  for (let i = 0; i < modules.length; i++) {
    const mod = modules[i]
    const modLessons = lessons.filter((l) => l.moduleId === mod.id)
    const mpRef = db.collection('moduleProgress').doc(progressDocId(traineeId, mod.id))
    batch.set(mpRef, {
      moduleId: mod.id,
      courseId,
      traineeId,
      status: i === 0 ? 'in_progress' : 'locked',
      percentComplete: 0,
      completedLessons: 0,
      totalLessons: modLessons.length,
      examPassed: false,
      allLessonsCompleted: false,
      unlockedAt: i === 0 ? FieldValue.serverTimestamp() : null,
      completedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
  }

  await batch.commit()
}

/**
 * Recalculate a single module's progress for a trainee.
 */
export async function recalculateModuleProgress(db, traineeId, moduleId) {
  const modDoc = await db.collection('modules').doc(moduleId).get()
  if (!modDoc.exists) return null
  const mod = { id: modDoc.id, ...modDoc.data() }
  const courseId = mod.courseId

  const lessonSnap = await db.collection('lessons').where('moduleId', '==', moduleId).get()
  const lessons = lessonSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((l) => isTraineeAccessible(l.status))

  // Backfill lessonProgress for assessment lessons that were passed/submitted but never
  // marked complete (e.g. attempt.lessonId was null, or exam passMark was missing so
  // passed stayed null, or the lesson was archived and recreated so the attempt points
  // at the old lesson id). Without this, modules sit at N-1 lessons forever.
  const backfilled = await backfillAssessmentLessonProgress(db, traineeId, lessons)

  // Load lesson progress (batched — one round trip for the whole module, not one per lesson)
  const lessonProgressById = await getDocSnapshotsById(
    db,
    'lessonProgress',
    lessons.map((l) => progressDocId(traineeId, l.id)),
  )
  let completedLessons = 0
  for (const l of lessons) {
    const pDoc = lessonProgressById.get(progressDocId(traineeId, l.id))
    if (pDoc?.exists && pDoc.data().status === 'completed') completedLessons++
  }

  const totalLessons = lessons.length
  const allLessonsCompleted = totalLessons > 0 && completedLessons === totalLessons
  const percentComplete = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100)

  // Check exam pass status. Only *real* exams (an exam-type lesson whose linked quiz
  // is itself type 'exam') gate module completion on a passing attempt — this is what
  // lets an admin attempt-reset correctly revert a completed module (Module 6 §6.7).
  //
  // An exam-type lesson linked to a knowledge-check quiz (quiz.type !== 'exam') has no
  // pass/fail concept: submitting it always completes the lesson and records an attempt
  // with passed=null. Requiring passed===true there would leave the module permanently
  // 'in_progress' even at 100% lessons complete, wrongly locking the next module. Such
  // lessons are already accounted for by allLessonsCompleted, so we don't re-gate them.
  const examLessons = lessons.filter((l) => l.type === 'exam' && l.content?.quizId)
  const examQuizById = await getDocSnapshotsById(db, 'quizzes', examLessons.map((el) => el.content.quizId))
  // Each exam lesson's pass check is independent — run them concurrently instead of
  // one at a time (a course with several graded modules used to pay for this serially).
  const examResults = await Promise.all(
    examLessons.map(async (el) => {
      const quizId = el.content.quizId
      const quizDoc = examQuizById.get(quizId)
      if (!quizDoc?.exists || quizDoc.data().type !== 'exam') return true // not a graded exam
      const quiz = quizDoc.data()
      const passMark = Number(quiz.passMark) || 70
      const attSnap = await db.collection('quizAttempts')
        .where('quizId', '==', quizId)
        .where('traineeId', '==', traineeId)
        .get()
      return attSnap.docs.some((d) => {
        const a = d.data()
        if (a.passed === true) return true
        // Legacy attempts: score met the bar but passed was left null (missing passMark).
        if (a.status === 'submitted' || a.status === 'timed_out') {
          const score = Number(a.score)
          return Number.isFinite(score) && score >= passMark
        }
        return false
      })
    }),
  )
  const examPassed = examResults.every(Boolean)

  const completed = allLessonsCompleted && examPassed

  const mpRef = db.collection('moduleProgress').doc(progressDocId(traineeId, moduleId))
  const mpDoc = await mpRef.get()
  const currentStatus = mpDoc.exists ? mpDoc.data().status : 'in_progress'

  // Don't update locked modules here (they get unlocked via cascading)
  if (currentStatus === 'locked') return { completed: false, moduleId, backfilled }

  const newStatus = completed ? 'completed' : 'in_progress'
  const update = {
    percentComplete,
    completedLessons,
    totalLessons,
    allLessonsCompleted,
    examPassed,
    status: newStatus,
    updatedAt: FieldValue.serverTimestamp(),
  }
  if (completed && currentStatus !== 'completed') {
    update.completedAt = FieldValue.serverTimestamp()
  }

  if (mpDoc.exists) {
    await mpRef.update(update)
  } else {
    await mpRef.set({
      moduleId,
      courseId,
      traineeId,
      unlockedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      ...update,
    })
  }

  // If just completed, trigger cascading unlock
  if (completed && currentStatus !== 'completed') {
    await evaluateCascadingUnlock(db, traineeId, courseId, mod.order)
  }

  return { completed, moduleId, backfilled }
}

/**
 * Write missing lessonProgress for quiz/exam lessons when the trainee already has a
 * qualifying submitted attempt. Repairs stuck modules (e.g. 44/45 with a passed exam).
 */
async function backfillAssessmentLessonProgress(db, traineeId, lessons) {
  const candidates = lessons.filter(
    (l) => (l.type === 'quiz' || l.type === 'exam') && l.content?.quizId,
  )
  if (candidates.length === 0) return 0
  let written = 0

  // Batch the two doc-lookups (lessonProgress, quizzes) across all candidate lessons
  // instead of round-tripping them one lesson at a time.
  const [progressById, quizById] = await Promise.all([
    getDocSnapshotsById(db, 'lessonProgress', candidates.map((l) => progressDocId(traineeId, l.id))),
    getDocSnapshotsById(db, 'quizzes', candidates.map((l) => l.content.quizId)),
  ])

  await Promise.all(
    candidates.map(async (l) => {
      const quizId = l.content.quizId
      const progressDoc = progressById.get(progressDocId(traineeId, l.id))
      if (progressDoc?.exists && progressDoc.data().status === 'completed') return

      const quizDoc = quizById.get(quizId)
      if (!quizDoc?.exists) return
      const quiz = quizDoc.data()

      const attSnap = await db.collection('quizAttempts')
        .where('quizId', '==', quizId)
        .where('traineeId', '==', traineeId)
        .get()
      if (attSnap.empty) return

      const passMark = quiz.type === 'exam' ? (Number(quiz.passMark) || 70) : null
      const qualifying = attSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((a) => a.status === 'submitted' || a.status === 'timed_out')
        .filter((a) => {
          if (quiz.type === 'quiz') return true // any submitted knowledge-check completes the lesson
          if (a.passed === true) return true
          const score = Number(a.score)
          return Number.isFinite(score) && passMark != null && score >= passMark
        })
        .sort((a, b) => (b.attemptNumber || 0) - (a.attemptNumber || 0))

      const best = qualifying[0]
      if (!best) return

      const progressRef = db.collection('lessonProgress').doc(progressDocId(traineeId, l.id))
      await progressRef.set({
        lessonId: l.id,
        moduleId: l.moduleId,
        courseId: l.courseId,
        traineeId,
        status: 'completed',
        lessonType: quiz.type || l.type,
        score: best.score ?? null,
        attemptCount: best.attemptNumber || qualifying.length,
        completedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true })
      written += 1
    }),
  )
  return written
}

/**
 * Rebuild every enrolled trainee's cached progress for a course from ground truth.
 *
 * This is the authoritative repair for any *structural* change: adding or archiving a
 * module, reordering modules (which redefines the unlock chain), or editing a module's
 * completion criteria. Those all change what "finished" means for people already part
 * way through, and none of it is derivable from the existing cache.
 *
 * Course content is loaded once and reused across trainees, so the cost is roughly one
 * pass per enrollee rather than a full recalculation per module per trainee.
 *
 * Safety: a module is only ever written back as `locked` when the trainee has no
 * completed lesson in it. Someone already working inside a module is never locked out
 * by a structural edit — the worst case is that a module they had finished reverts to
 * in_progress because genuinely new content landed in it.
 */
export async function resyncCourseStructure(db, courseId, { traineeIds = null } = {}) {
  const [modSnap, lesSnap, enSnap] = await Promise.all([
    db.collection('modules').where('courseId', '==', courseId).get(),
    db.collection('lessons').where('courseId', '==', courseId).get(),
    db.collection('enrollments').where('courseId', '==', courseId).get(),
  ])

  const modules = modSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => isTraineeAccessible(m.status))
    .sort((a, b) => (a.order || 0) - (b.order || 0))

  const allLessons = lesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((l) => isTraineeAccessible(l.status))
  const lessonsByModule = new Map()
  for (const l of allLessons) {
    const arr = lessonsByModule.get(l.moduleId) || []
    arr.push(l)
    lessonsByModule.set(l.moduleId, arr)
  }

  const targets = traineeIds ?? [...new Set(
    enSnap.docs.map((d) => d.data()).filter((e) => e.status !== 'withdrawn').map((e) => e.traineeId),
  )].filter(Boolean)
  if (targets.length === 0 || modules.length === 0) return 0

  // Which exam lessons actually gate completion, and every attempt against them.
  // Loaded once for the whole course instead of per trainee per module.
  const examLessons = allLessons.filter((l) => l.type === 'exam' && l.content?.quizId)
  const quizById = await getDocSnapshotsById(db, 'quizzes', examLessons.map((l) => l.content.quizId))
  const gatingByModule = new Map()
  for (const l of examLessons) {
    const q = quizById.get(l.content.quizId)
    if (!q?.exists || q.data().type !== 'exam') continue // knowledge check: no pass gate
    const arr = gatingByModule.get(l.moduleId) || []
    arr.push({ quizId: l.content.quizId, passMark: Number(q.data().passMark) || 70 })
    gatingByModule.set(l.moduleId, arr)
  }
  const gatingQuizIds = [...new Set([...gatingByModule.values()].flat().map((g) => g.quizId))]
  const attemptsByTraineeQuiz = new Map()
  await Promise.all(gatingQuizIds.map(async (quizId) => {
    const snap = await db.collection('quizAttempts').where('quizId', '==', quizId).get()
    for (const d of snap.docs) {
      const a = d.data()
      const key = `${a.traineeId}|${quizId}`
      const arr = attemptsByTraineeQuiz.get(key) || []
      arr.push(a)
      attemptsByTraineeQuiz.set(key, arr)
    }
  }))

  let rebuilt = 0
  for (const traineeId of targets) {
    const lpById = await getDocSnapshotsById(
      db, 'lessonProgress', allLessons.map((l) => progressDocId(traineeId, l.id)),
    )
    const mpById = await getDocSnapshotsById(
      db, 'moduleProgress', modules.map((m) => progressDocId(traineeId, m.id)),
    )
    const isDone = (lessonId) => {
      const d = lpById.get(progressDocId(traineeId, lessonId))
      return Boolean(d?.exists && d.data().status === 'completed')
    }

    const writes = []
    let previousCompleted = true // first module is always reachable
    let completedModules = 0
    let totalCompletedLessons = 0
    let currentModuleId = null
    let currentModuleOrder = null

    for (const mod of modules) {
      const modLessons = lessonsByModule.get(mod.id) || []
      const done = modLessons.filter((l) => isDone(l.id)).length
      totalCompletedLessons += done
      const total = modLessons.length
      const allLessonsCompleted = total > 0 && done === total

      // Informational only — surfaced on the summary, but NOT what decides completion.
      const examPassed = (gatingByModule.get(mod.id) || []).every(({ quizId, passMark }) =>
        (attemptsByTraineeQuiz.get(`${traineeId}|${quizId}`) || []).some((a) => {
          if (a.passed === true) return true
          if (a.status !== 'submitted' && a.status !== 'timed_out') return false
          const s = Number(a.score)
          return Number.isFinite(s) && s >= passMark
        }))

      // Completion must be computed exactly as the live unlock engine computes it
      // (moduleCompletionState in routes/trainee.js), because that is what actually
      // grants or refuses access. It honours the module's own completionCriteria and
      // reads the exam *lesson's* progress rather than re-deriving a pass from
      // attempts. Gating this cache on attempts instead would recreate the very
      // cache-vs-live split this function exists to eliminate — a module whose
      // criteria set examPassed=false would sit at in_progress here while the
      // trainee is being let straight through it.
      const needExam = Boolean(mod.completionCriteria?.examPassed)
      let examOk = true
      if (needExam) {
        const examLesson = modLessons.find((l) => l.type === 'exam')
        if (examLesson) examOk = isDone(examLesson.id)
      }
      const completed = allLessonsCompleted && examOk
      const unlocked = previousCompleted
      // Mirror the live engine exactly, including when it locks a module the trainee
      // already has partial progress in. Softening this to keep such a module
      // 'in_progress' would only make the dashboard advertise a module that the module
      // route then refuses with 403 — the "it says available, then locks me out"
      // complaint. The cache's job is to report what access actually is, not to be
      // kinder than it.
      const status = completed ? 'completed' : unlocked ? 'in_progress' : 'locked'
      if (completed) completedModules += 1
      if (!completed && status !== 'locked' && !currentModuleId) {
        currentModuleId = mod.id
        currentModuleOrder = mod.order ?? null
      }

      const existing = mpById.get(progressDocId(traineeId, mod.id))
      const next = {
        percentComplete: total === 0 ? 0 : Math.round((done / total) * 100),
        completedLessons: done,
        totalLessons: total,
        allLessonsCompleted,
        examPassed,
        status,
        updatedAt: FieldValue.serverTimestamp(),
      }
      const prev = existing?.exists ? existing.data() : null
      const unchanged = prev
        && prev.status === next.status
        && Number(prev.completedLessons) === next.completedLessons
        && Number(prev.totalLessons) === next.totalLessons
        && Boolean(prev.examPassed) === next.examPassed
      if (!unchanged) {
        writes.push({
          ref: db.collection('moduleProgress').doc(progressDocId(traineeId, mod.id)),
          data: prev
            ? next
            : {
                moduleId: mod.id, courseId, traineeId,
                unlockedAt: status === 'locked' ? null : FieldValue.serverTimestamp(),
                completedAt: completed ? FieldValue.serverTimestamp() : null,
                createdAt: FieldValue.serverTimestamp(), ...next,
              },
          isNew: !prev,
        })
      }
      previousCompleted = completed
    }

    const cpRef = db.collection('courseProgress').doc(progressDocId(traineeId, courseId))
    const cpDoc = await cpRef.get()
    const courseCompleted = modules.length > 0 && completedModules === modules.length
    const cpNext = {
      status: courseCompleted ? 'completed' : 'in_progress',
      percentComplete: allLessons.length === 0
        ? 0 : Math.round((totalCompletedLessons / allLessons.length) * 100),
      completedModules,
      totalModules: modules.length,
      completedLessons: totalCompletedLessons,
      totalLessons: allLessons.length,
      currentModuleId,
      currentModuleOrder,
      updatedAt: FieldValue.serverTimestamp(),
    }
    if (courseCompleted && !(cpDoc.exists && cpDoc.data().status === 'completed')) {
      cpNext.completedAt = FieldValue.serverTimestamp()
    }

    if (writes.length === 0 && cpDoc.exists) {
      const c = cpDoc.data()
      if (c.status === cpNext.status && Number(c.completedModules) === completedModules
        && Number(c.totalModules) === modules.length
        && Number(c.completedLessons) === totalCompletedLessons) continue
    }

    const chunkSize = 400
    for (let i = 0; i < writes.length; i += chunkSize) {
      const batch = db.batch()
      for (const w of writes.slice(i, i + chunkSize)) {
        if (w.isNew) batch.set(w.ref, w.data)
        else batch.update(w.ref, w.data)
      }
      await batch.commit()
    }
    if (cpDoc.exists) await cpRef.update(cpNext)
    else await cpRef.set({ courseId, traineeId, startedAt: null, completedAt: null,
      createdAt: FieldValue.serverTimestamp(), ...cpNext })
    rebuilt += 1
  }
  return rebuilt
}

/**
 * Resync cached moduleProgress after a module's lesson set changes.
 *
 * Trainee access is decided live from the real lesson list, but the dashboard reads
 * the cached moduleProgress summary. Adding or archiving a lesson changes the live
 * count immediately (drafts count too — only `archived` is excluded), so without this
 * the two disagree: the cache still says 34/34 complete while the live engine counts
 * 34/35 and refuses to advance. That mismatch is what left trainees seeing a finished
 * course on the dashboard and "Module is locked" when they clicked into it.
 *
 * Call this whenever a lesson is created, archived, or un-archived. Correcting
 * totalLessons is cheap and is what keeps the two views consistent; the completion and
 * unlock re-evaluation is best-effort, since the read-path heal is a backstop for it.
 *
 * @returns {Promise<string[]>} trainee ids whose cached total was corrected
 */
export async function resyncModuleProgressTotals(db, moduleId) {
  const modDoc = await db.collection('modules').doc(moduleId).get()
  if (!modDoc.exists) return []
  const { courseId } = modDoc.data()

  const [lessonSnap, enSnap] = await Promise.all([
    db.collection('lessons').where('moduleId', '==', moduleId).get(),
    db.collection('enrollments').where('courseId', '==', courseId).get(),
  ])
  const liveTotal = lessonSnap.docs.filter((d) => isTraineeAccessible(d.data().status)).length
  const traineeIds = [...new Set(
    enSnap.docs.map((d) => d.data()).filter((e) => e.status !== 'withdrawn').map((e) => e.traineeId),
  )].filter(Boolean)
  if (traineeIds.length === 0) return []

  const mpById = await getDocSnapshotsById(
    db, 'moduleProgress', traineeIds.map((t) => progressDocId(t, moduleId)),
  )
  const stale = traineeIds.filter((t) => {
    const d = mpById.get(progressDocId(t, moduleId))
    return d?.exists && (Number(d.data().totalLessons) || 0) !== liveTotal
  })
  if (stale.length === 0) return []

  const chunkSize = 400
  for (let i = 0; i < stale.length; i += chunkSize) {
    const batch = db.batch()
    for (const t of stale.slice(i, i + chunkSize)) {
      batch.update(db.collection('moduleProgress').doc(progressDocId(t, moduleId)), {
        totalLessons: liveTotal,
        updatedAt: FieldValue.serverTimestamp(),
      })
    }
    await batch.commit()
  }
  return stale
}

/**
 * Re-evaluate completion + unlock for the trainees whose totals just moved. Kept
 * separate from the write above so callers can correct the counts inline (fast) and
 * run this without blocking the admin's request.
 */
export async function reevaluateTraineesForModule(db, moduleId, traineeIds) {
  const modDoc = await db.collection('modules').doc(moduleId).get()
  if (!modDoc.exists) return
  const { courseId } = modDoc.data()
  for (const traineeId of traineeIds) {
    try {
      await recalculateModuleProgress(db, traineeId, moduleId)
      await recalculateCourseProgress(db, traineeId, courseId)
    } catch (err) {
      console.warn('[progress] Re-evaluation failed for', traineeId, moduleId, err?.message)
    }
  }
}

/**
 * When a module completes, unlock the next sequential module.
 */
export async function evaluateCascadingUnlock(db, traineeId, courseId, completedModuleOrder) {
  const modSnap = await db.collection('modules').where('courseId', '==', courseId).get()
  const modules = modSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => isTraineeAccessible(m.status))
    .sort((a, b) => (a.order || 0) - (b.order || 0))

  const nextMod = modules.find((m) => (m.order || 0) > completedModuleOrder)
  if (!nextMod) return // No next module — possibly course complete

  const mpRef = db.collection('moduleProgress').doc(progressDocId(traineeId, nextMod.id))
  const mpDoc = await mpRef.get()
  if (mpDoc.exists && mpDoc.data().status === 'locked') {
    await mpRef.update({
      status: 'in_progress',
      unlockedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  } else if (!mpDoc.exists) {
    const lessonSnap = await db.collection('lessons').where('moduleId', '==', nextMod.id).get()
    const lCount = lessonSnap.docs.filter((d) => isTraineeAccessible(d.data().status)).length
    await mpRef.set({
      moduleId: nextMod.id,
      courseId,
      traineeId,
      status: 'in_progress',
      percentComplete: 0,
      completedLessons: 0,
      totalLessons: lCount,
      examPassed: false,
      allLessonsCompleted: false,
      unlockedAt: FieldValue.serverTimestamp(),
      completedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  }
}

/**
 * Recalculate course-level progress from all module progress records.
 */
export async function recalculateCourseProgress(db, traineeId, courseId) {
  const modSnap = await db.collection('modules').where('courseId', '==', courseId).get()
  const modules = modSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => isTraineeAccessible(m.status))
    .sort((a, b) => (a.order || 0) - (b.order || 0))

  const lessonSnap = await db.collection('lessons').where('courseId', '==', courseId).get()
  const allLessons = lessonSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((l) => isTraineeAccessible(l.status))

  const [lessonProgressById, moduleProgressById] = await Promise.all([
    getDocSnapshotsById(db, 'lessonProgress', allLessons.map((l) => progressDocId(traineeId, l.id))),
    getDocSnapshotsById(db, 'moduleProgress', modules.map((m) => progressDocId(traineeId, m.id))),
  ])

  let completedLessons = 0
  for (const l of allLessons) {
    const pDoc = lessonProgressById.get(progressDocId(traineeId, l.id))
    if (pDoc?.exists && pDoc.data().status === 'completed') completedLessons++
  }

  let completedModules = 0
  let currentModuleId = null
  let currentModuleOrder = null
  // `modules` is already sorted by order, so this stays a plain in-memory loop
  // (no I/O here) to preserve "first in-progress module wins" semantics.
  for (const mod of modules) {
    const mpDoc = moduleProgressById.get(progressDocId(traineeId, mod.id))
    if (mpDoc?.exists && mpDoc.data().status === 'completed') {
      completedModules++
    } else if (mpDoc?.exists && mpDoc.data().status === 'in_progress') {
      if (!currentModuleId) {
        currentModuleId = mod.id
        currentModuleOrder = mod.order
      }
    }
  }

  const totalLessons = allLessons.length
  const totalModules = modules.length
  const percentComplete = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100)
  const courseCompleted = totalModules > 0 && completedModules === totalModules

  const cpRef = db.collection('courseProgress').doc(progressDocId(traineeId, courseId))
  const cpDoc = await cpRef.get()
  const wasCompleted = cpDoc.exists && cpDoc.data().status === 'completed'

  const update = {
    status: courseCompleted ? 'completed' : 'in_progress',
    percentComplete,
    completedModules,
    totalModules,
    completedLessons,
    totalLessons,
    currentModuleId,
    currentModuleOrder,
    updatedAt: FieldValue.serverTimestamp(),
  }

  if (courseCompleted && !wasCompleted) {
    update.completedAt = FieldValue.serverTimestamp()

    // Also update enrollment status
    const enSnap = await db.collection('enrollments')
      .where('courseId', '==', courseId)
      .where('traineeId', '==', traineeId)
      .get()
    for (const d of enSnap.docs) {
      if (d.data().status === 'active') {
        await d.ref.update({
          status: 'completed',
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        })
      }
    }
  }

  if (cpDoc.exists) {
    await cpRef.update(update)
  } else {
    await cpRef.set({
      courseId,
      traineeId,
      startedAt: null,
      completedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      ...update,
    })
  }

  return { courseCompleted, percentComplete }
}

/**
 * Repair modules stuck at 100% lessons but still `in_progress` (and unlock the next
 * module). This recovers trainees hit by the historical exam-gate bug: knowledge-check
 * quizzes store `passed: null`, so requiring `passed === true` for every exam-typed
 * lesson left modules permanently incomplete even when every lesson was done.
 *
 * Safe to call on dashboard / course / module reads — only recalculates candidates.
 * Pass `forceModuleIds` when the live unlock engine already knows a module is complete
 * but the cache may disagree (e.g. completedLessons count is stale).
 */
export async function healStuckModules(db, traineeId, courseId, forceModuleIds = []) {
  const force = new Set(forceModuleIds.filter(Boolean))
  const [modSnap, lessonSnap] = await Promise.all([
    db.collection('modules').where('courseId', '==', courseId).get(),
    db.collection('lessons').where('courseId', '==', courseId).get(),
  ])
  const modules = modSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => isTraineeAccessible(m.status))
    .sort((a, b) => (a.order || 0) - (b.order || 0))

  // Live lesson count per module, used to detect a moduleProgress summary that was
  // written against a different lesson set than the course currently has.
  const liveLessonCount = new Map()
  for (const d of lessonSnap.docs) {
    const l = d.data()
    if (!isTraineeAccessible(l.status)) continue
    liveLessonCount.set(l.moduleId, (liveLessonCount.get(l.moduleId) || 0) + 1)
  }

  // Batch the "does this module need healing" read across all modules up front —
  // the actual recalculation (writes + possible cascading unlock) stays sequential
  // below since it can touch a neighboring module's doc.
  const moduleProgressById = await getDocSnapshotsById(
    db,
    'moduleProgress',
    modules.map((m) => progressDocId(traineeId, m.id)),
  )

  let healed = false
  // Set when the module processed immediately before this one completed during THIS pass.
  // Its cascading unlock will have flipped this module out of 'locked', so the batched
  // snapshot above is already out of date and this module must be re-read and
  // re-evaluated. Without this the heal advances only one module per request, which is
  // why a trainee who finished several modules had to leave and re-enter repeatedly to
  // claw back one module at a time.
  let previousCompleted = false
  for (const mod of modules) {
    let mpDoc = moduleProgressById.get(progressDocId(traineeId, mod.id))
    if (previousCompleted) {
      mpDoc = await db.collection('moduleProgress').doc(progressDocId(traineeId, mod.id)).get()
    }
    if (!mpDoc?.exists) {
      // No cache yet — if live says this module is done, create/update via recalculate.
      if (force.has(mod.id) || previousCompleted) {
        const result = await recalculateModuleProgress(db, traineeId, mod.id)
        previousCompleted = Boolean(result?.completed)
        if (result?.completed || result?.backfilled) healed = true
      } else {
        previousCompleted = false
      }
      continue
    }
    const mp = mpDoc.data()

    const total = Number(mp.totalLessons) || 0
    const done = Number(mp.completedLessons) || 0
    const liveTotal = liveLessonCount.get(mod.id) || 0

    // The cached summary was built from a different lesson set than the module has
    // now — a lesson was added, archived, or moved between modules after this summary
    // was written. The cached *status* is therefore untrustworthy: a module cached
    // 'completed' at the old total still reads as incomplete to the live unlock engine
    // (which counts real lessons), so the next module stays locked while the dashboard
    // insists everything is done. Re-evaluate these regardless of cached status.
    //
    // This also covers a lesson being archived and recreated pointing at the same quiz:
    // the trainee's attempt is bound to the old lesson id, so the new lesson has no
    // lessonProgress until the backfill inside recalculate rebuilds it from the attempt.
    const staleAgainstLiveContent = total !== liveTotal

    if (
      !staleAgainstLiveContent &&
      !previousCompleted &&
      (mp.status === 'locked' || mp.status === 'completed')
    ) {
      if (mp.status === 'completed') {
        // Already-complete modules fire no state transition, so their cascading unlock
        // never re-runs. If the successor was left locked (an unlock lost to an earlier
        // failed recalc), nothing else would ever free it — re-assert it here.
        await evaluateCascadingUnlock(db, traineeId, courseId, mod.order)
      }
      previousCompleted = mp.status === 'completed'
      continue
    }

    // Also re-evaluate "one short" modules — typical stuck exam-lesson case (e.g. 44/45)
    // where a passing attempt exists but lessonProgress was never written.
    const looksComplete =
      force.has(mod.id) ||
      staleAgainstLiveContent ||
      previousCompleted ||
      Boolean(mp.allLessonsCompleted) ||
      (total > 0 && done >= total) ||
      (total > 0 && done >= total - 1)

    // Only re-evaluate modules that look finished or nearly finished. Don't touch
    // modules still mid-work (examPassed defaults to false at enrollment).
    if (!looksComplete) {
      previousCompleted = false
      continue
    }

    const result = await recalculateModuleProgress(db, traineeId, mod.id)
    previousCompleted = Boolean(result?.completed)
    // `backfilled` counts lessonProgress docs rebuilt from existing attempts. Those
    // writes change what the live unlock engine sees, so the caller must re-read even
    // when the module itself didn't flip to completed.
    if (result?.completed || result?.backfilled) healed = true
  }

  if (healed) await recalculateCourseProgress(db, traineeId, courseId)
  return healed
}
