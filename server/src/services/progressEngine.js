import { FieldValue } from 'firebase-admin/firestore'

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

  // Load lesson progress
  let completedLessons = 0
  for (const l of lessons) {
    const pDoc = await db.collection('lessonProgress').doc(progressDocId(traineeId, l.id)).get()
    if (pDoc.exists && pDoc.data().status === 'completed') completedLessons++
  }

  const totalLessons = lessons.length
  const allLessonsCompleted = totalLessons > 0 && completedLessons === totalLessons
  const percentComplete = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100)

  // Check exam pass status
  let examPassed = true
  const examLessons = lessons.filter((l) => l.type === 'exam')
  for (const el of examLessons) {
    const quizId = el.content?.quizId
    if (!quizId) { examPassed = false; continue }
    const attSnap = await db.collection('quizAttempts')
      .where('quizId', '==', quizId)
      .where('traineeId', '==', traineeId)
      .get()
    const hasPassing = attSnap.docs.some((d) => d.data().passed === true)
    if (!hasPassing) examPassed = false
  }
  if (examLessons.length === 0) examPassed = true

  const completed = allLessonsCompleted && examPassed

  const mpRef = db.collection('moduleProgress').doc(progressDocId(traineeId, moduleId))
  const mpDoc = await mpRef.get()
  const currentStatus = mpDoc.exists ? mpDoc.data().status : 'in_progress'

  // Don't update locked modules here (they get unlocked via cascading)
  if (currentStatus === 'locked') return { completed: false, moduleId }

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

  return { completed, moduleId }
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

  let completedLessons = 0
  for (const l of allLessons) {
    const pDoc = await db.collection('lessonProgress').doc(progressDocId(traineeId, l.id)).get()
    if (pDoc.exists && pDoc.data().status === 'completed') completedLessons++
  }

  let completedModules = 0
  let currentModuleId = null
  let currentModuleOrder = null
  for (const mod of modules) {
    const mpDoc = await db.collection('moduleProgress').doc(progressDocId(traineeId, mod.id)).get()
    if (mpDoc.exists && mpDoc.data().status === 'completed') {
      completedModules++
    } else if (mpDoc.exists && mpDoc.data().status === 'in_progress') {
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
