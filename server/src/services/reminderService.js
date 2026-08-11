import { FieldValue } from 'firebase-admin/firestore'
import { getDb } from '../utils/firestoreDb.js'
import { getDocSnapshotsById } from '../utils/firestoreBatch.js'
import { getEnv } from '../config/env.js'
import { serializeValue } from '../utils/serialize.js'

const DEFAULT_SETTINGS = {
  enabled: true,
  cronSchedule: '0 9 * * *',
  cooldownDays: 3,
  maxReminders: 5,
  warningDaysBefore: 3,
}

export async function getReminderSettings(db) {
  const doc = await db.collection('systemConfig').doc('appSettings').get()
  if (doc.exists && doc.data().reminderSettings) {
    return { ...DEFAULT_SETTINGS, ...doc.data().reminderSettings }
  }
  return { ...DEFAULT_SETTINGS }
}

export async function updateReminderSettings(db, patch) {
  const ref = db.collection('systemConfig').doc('appSettings')
  const doc = await ref.get()
  const current = doc.exists && doc.data().reminderSettings ? doc.data().reminderSettings : { ...DEFAULT_SETTINGS }
  const updated = { ...current, ...patch }
  await ref.set({ reminderSettings: updated, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  return updated
}

function buildReminderEmail(trainee, course, progress, currentModule, dueDate, daysOverdue, type) {
  const { frontendUrl } = getEnv()
  const base = String(frontendUrl || '').replace(/\/$/, '')
  const dashboardLink = `${base}/dashboard`
  const firstName = trainee.firstName || trainee.email || 'Trainee'

  if (type === 'warning') {
    return {
      subject: `Your Elevate Pilates training is due in ${Math.abs(daysOverdue)} days`,
      html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#1a1a1a">Hi ${firstName},</h2>
  <p>This is a friendly reminder that your <strong>${course.title || 'Elevate Pilates'}</strong> training is due in <strong>${Math.abs(daysOverdue)} days</strong> (${new Date(dueDate).toLocaleDateString()}).</p>
  <p>Your current progress: <strong>${progress}%</strong>${currentModule ? ` — currently on ${currentModule}` : ''}.</p>
  <p><a href="${dashboardLink}" style="display:inline-block;padding:12px 24px;background:#2d5a27;color:#fff;text-decoration:none;border-radius:8px">Continue Training</a></p>
  <p style="color:#666;font-size:14px">If you need assistance, please contact your program administrator.</p>
</div>`,
    }
  }

  return {
    subject: 'Reminder: Complete your Elevate Pilates training',
    html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#1a1a1a">Hi ${firstName},</h2>
  <p>Your <strong>${course.title || 'Elevate Pilates'}</strong> training was due on <strong>${new Date(dueDate).toLocaleDateString()}</strong> and is now <strong>${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue</strong>.</p>
  <p>Your current progress: <strong>${progress}%</strong>${currentModule ? ` — currently on ${currentModule}` : ''}.</p>
  <p><a href="${dashboardLink}" style="display:inline-block;padding:12px 24px;background:#2d5a27;color:#fff;text-decoration:none;border-radius:8px">Continue Training</a></p>
  <p style="color:#666;font-size:14px">If you need assistance, please contact your program administrator.</p>
</div>`,
  }
}

async function sendEmail(to, subject, html) {
  //TODO: Integrate transactional email (Resend, SendGrid, etc.)
  console.info(`[reminder-email] to=${to} subject="${subject}"`)
  return true
}

async function logReminder(db, data) {
  const ref = db.collection('reminderLog').doc()
  await ref.set({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
  })
  return ref.id
}

/**
 * Send a manual reminder to a specific trainee.
 */
export async function sendManualReminder(db, traineeId, enrollmentId) {
  const enDoc = await db.collection('enrollments').doc(enrollmentId).get()
  if (!enDoc.exists) throw Object.assign(new Error('Enrollment not found'), { status: 404 })
  const en = enDoc.data()

  const uDoc = await db.collection('users').doc(traineeId).get()
  if (!uDoc.exists) throw Object.assign(new Error('User not found'), { status: 404 })
  const user = uDoc.data()

  const courseDoc = await db.collection('courses').doc(en.courseId).get()
  const course = courseDoc.exists ? courseDoc.data() : { title: 'Course' }

  const cpDoc = await db.collection('courseProgress').doc(`${traineeId}_${en.courseId}`).get()
  const cp = cpDoc.exists ? cpDoc.data() : {}
  const progress = cp.percentComplete || 0

  let currentModule = null
  if (cp.currentModuleId) {
    const mDoc = await db.collection('modules').doc(cp.currentModuleId).get()
    if (mDoc.exists) currentModule = mDoc.data().title
  }

  const dueDate = en.dueDate ? (en.dueDate.toDate ? en.dueDate.toDate() : new Date(en.dueDate)) : new Date()
  const now = new Date()
  const daysOverdue = Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24))

  // Count existing reminders for this enrollment
  const existingSnap = await db.collection('reminderLog')
    .where('traineeId', '==', traineeId)
    .where('enrollmentId', '==', enrollmentId)
    .get()
  const reminderNumber = existingSnap.size + 1

  const settings = await getReminderSettings(db)
  if (reminderNumber > settings.maxReminders) {
    throw Object.assign(new Error('Maximum reminders already sent for this trainee'), { status: 400 })
  }

  const { subject, html } = buildReminderEmail(user, course, progress, currentModule, dueDate, daysOverdue, 'overdue')
  const sent = await sendEmail(user.email, subject, html)

  if (sent) {
    await logReminder(db, {
      traineeId,
      traineeEmail: user.email,
      traineeName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      enrollmentId,
      courseId: en.courseId,
      type: 'overdue',
      trigger: 'manual',
      reminderNumber,
      progressAtSend: progress,
      currentModuleAtSend: currentModule,
      dueDateAtSend: en.dueDate,
      daysOverdue: Math.max(0, daysOverdue),
      emailStatus: 'sent',
      sentAt: FieldValue.serverTimestamp(),
    })
  }

  return { sent, reminderNumber }
}

/**
 * Run the automated reminder scan. Called by cron or internal endpoint.
 */
export async function runReminderScan() {
  const db = getDb()
  if (!db) return { sent: 0, skipped: 0, error: 'Database not configured' }

  const settings = await getReminderSettings(db)
  if (!settings.enabled) return { sent: 0, skipped: 0, disabled: true }

  const now = new Date()
  const enSnap = await db.collection('enrollments').get()
  let sent = 0
  let skipped = 0

  // Narrow to enrollments actually inside the reminder window before doing any I/O.
  // These are pure predicates, so applying them first doesn't change which enrollments
  // ultimately qualify — it just avoids loading a user + progress doc for every
  // enrollment on the platform on each nightly run.
  const candidates = []
  for (const d of enSnap.docs) {
    const en = d.data()
    if (en.status !== 'active') continue

    const dueDate = en.dueDate ? (en.dueDate.toDate ? en.dueDate.toDate() : new Date(en.dueDate)) : null
    if (!dueDate) continue

    const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24))
    const isOverdue = daysUntilDue < 0
    const isWarning = daysUntilDue > 0 && daysUntilDue <= settings.warningDaysBefore
    if (!isOverdue && !isWarning) continue

    candidates.push({ d, en, dueDate, daysUntilDue, isOverdue, isWarning })
  }

  if (candidates.length === 0) return { sent: 0, skipped: 0 }

  // Batch-load the docs every surviving candidate needs.
  const [usersById, courseProgressById, coursesById] = await Promise.all([
    getDocSnapshotsById(db, 'users', candidates.map((c) => c.en.traineeId)),
    getDocSnapshotsById(db, 'courseProgress', candidates.map((c) => `${c.en.traineeId}_${c.en.courseId}`)),
    getDocSnapshotsById(db, 'courses', candidates.map((c) => c.en.courseId)),
  ])

  for (const { d, en, dueDate, daysUntilDue, isOverdue, isWarning } of candidates) {
    // Check if trainee account is disabled
    const uDoc = usersById.get(en.traineeId)
    if (!uDoc?.exists) continue
    const user = uDoc.data()
    if (user.disabled) continue

    const cpDoc = courseProgressById.get(`${en.traineeId}_${en.courseId}`)
    const cp = cpDoc?.exists ? cpDoc.data() : {}
    if (cp.status === 'completed') continue

    // Check cooldown and max reminders
    const existingSnap = await db.collection('reminderLog')
      .where('traineeId', '==', en.traineeId)
      .where('enrollmentId', '==', d.id)
      .get()

    const existingReminders = existingSnap.docs.map((rd) => rd.data())
    const reminderCount = existingReminders.length

    if (reminderCount >= settings.maxReminders) { skipped++; continue }

    // Cooldown check
    const mostRecent = existingReminders
      .map((r) => r.sentAt ? (r.sentAt.toDate ? r.sentAt.toDate() : new Date(r.sentAt)) : null)
      .filter(Boolean)
      .sort((a, b) => b - a)[0]

    if (mostRecent) {
      const daysSince = (now - mostRecent) / (1000 * 60 * 60 * 24)
      if (daysSince < settings.cooldownDays) { skipped++; continue }
    }

    // For warnings, only send one
    if (isWarning) {
      const hasWarning = existingReminders.some((r) => r.type === 'warning')
      if (hasWarning) { skipped++; continue }
    }

    const courseDoc = coursesById.get(en.courseId)
    const course = courseDoc?.exists ? courseDoc.data() : { title: 'Course' }
    const progress = cp.percentComplete || 0

    let currentModule = null
    if (cp.currentModuleId) {
      const mDoc = await db.collection('modules').doc(cp.currentModuleId).get()
      if (mDoc.exists) currentModule = mDoc.data().title
    }

    const type = isWarning ? 'warning' : 'overdue'
    const daysOverdue = isOverdue ? Math.abs(daysUntilDue) : daysUntilDue

    const { subject, html } = buildReminderEmail(user, course, progress, currentModule, dueDate, daysOverdue, type)

    try {
      const emailSent = await sendEmail(user.email, subject, html)
      if (emailSent) {
        await logReminder(db, {
          traineeId: en.traineeId,
          traineeEmail: user.email,
          traineeName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          enrollmentId: d.id,
          courseId: en.courseId,
          type,
          trigger: 'automated',
          reminderNumber: reminderCount + 1,
          progressAtSend: progress,
          currentModuleAtSend: currentModule,
          dueDateAtSend: en.dueDate,
          daysOverdue: Math.max(0, Math.abs(daysUntilDue)),
          emailStatus: 'sent',
          sentAt: FieldValue.serverTimestamp(),
        })
        sent++
      }
    } catch (emailErr) {
      console.error(`[reminder] Failed to send to ${user.email}:`, emailErr?.message)
      skipped++
    }
  }

  return { sent, skipped }
}
