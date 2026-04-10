import { FieldValue } from 'firebase-admin/firestore'
import { getDb } from '../utils/firestoreDb.js'

function lessonContentIssue(lesson) {
  const type = lesson.type
  const content = lesson.content || {}
  if (type === 'reading') {
    if (!content.body || !String(content.body).trim()) {
      return `Lesson "${lesson.title}" needs reading content`
    }
  }
  if (type === 'video') {
    if (!content.storagePath && !content.downloadUrl) {
      return `Lesson "${lesson.title}" needs a video`
    }
  }
  if (type === 'quiz' || type === 'exam') {
    if (!content.quizId || !String(content.quizId).trim()) {
      return `Lesson "${lesson.title}" needs a linked ${type} — open the lesson editor and select one from the dropdown`
    }
  }
  return null
}

function orderIssues(label, orders) {
  const sorted = [...orders].sort((a, b) => a - b)
  const issues = []
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i] !== i + 1) {
      issues.push(`${label} order must be consecutive starting at 1`)
      break
    }
  }
  const uniq = new Set(orders)
  if (uniq.size !== orders.length) {
    issues.push(`${label} order values must be unique`)
  }
  return issues
}

/**
 * @returns {Promise<{ valid: boolean; issues: string[] }>}
 */
export async function validateCourseForPublish(courseId) {
  const db = getDb()
  if (!db) return { valid: false, issues: ['Database not configured'] }

  const issues = []
  const courseRef = db.collection('courses').doc(courseId)
  const courseSnap = await courseRef.get()
  if (!courseSnap.exists) {
    return { valid: false, issues: ['Course not found'] }
  }

  const modulesSnap = await db
    .collection('modules')
    .where('courseId', '==', courseId)
    .get()

  const modules = modulesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => m.status !== 'archived')

  if (modules.length === 0) {
    issues.push('Course must have at least one non-archived module')
  }

  const moduleOrders = modules.map((m) => Number(m.order) || 0)
  if (modules.length) issues.push(...orderIssues('Module', moduleOrders))

  for (const mod of modules) {
    const lessonsSnap = await db
      .collection('lessons')
      .where('moduleId', '==', mod.id)
      .get()
    const lessons = lessonsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((l) => l.status !== 'archived')

    if (lessons.length === 0) {
      issues.push(`Module "${mod.title}" needs at least one lesson`)
    }

    const lessonOrders = lessons.map((l) => Number(l.order) || 0)
    if (lessons.length) {
      issues.push(...orderIssues(`Lessons in "${mod.title}"`, lessonOrders))
    }

    for (const lesson of lessons) {
      const msg = lessonContentIssue(lesson)
      if (msg) issues.push(msg)
    }
  }

  return { valid: issues.length === 0, issues }
}

/**
 * Cascade status for course, its modules, and lessons (same courseId).
 * @param {'published' | 'draft' | 'archived'} nextStatus
 */
export async function setCourseTreeStatus(courseId, nextStatus) {
  const db = getDb()
  const payload = {
    status: nextStatus,
    updatedAt: FieldValue.serverTimestamp(),
  }

  const updates = [{ ref: db.collection('courses').doc(courseId), data: payload }]

  const modulesSnap = await db
    .collection('modules')
    .where('courseId', '==', courseId)
    .get()
  modulesSnap.docs.forEach((m) => updates.push({ ref: m.ref, data: payload }))

  const lessonsSnap = await db
    .collection('lessons')
    .where('courseId', '==', courseId)
    .get()
  lessonsSnap.docs.forEach((l) => updates.push({ ref: l.ref, data: payload }))

  const chunkSize = 400
  for (let i = 0; i < updates.length; i += chunkSize) {
    const batch = db.batch()
    updates.slice(i, i + chunkSize).forEach(({ ref, data }) => batch.update(ref, data))
    await batch.commit()
  }
}
