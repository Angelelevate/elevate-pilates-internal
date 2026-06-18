import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { getDb } from '../utils/firestoreDb.js'
import { getDocSnapshotsById } from '../utils/firestoreBatch.js'
import { serializeDoc, serializeValue } from '../utils/serialize.js'
import {
  getReminderSettings,
  updateReminderSettings,
  sendManualReminder,
  runReminderScan,
} from '../services/reminderService.js'

export const remindersRouter = Router()

function dbRequired() {
  const db = getDb()
  if (!db) { const err = new Error('Database not configured'); err.status = 503; throw err }
  return db
}

// Admin-only routes
const adminRoutes = Router()
adminRoutes.use(requireAuth, requireRole('admin'))

adminRoutes.get('/settings', async (req, res, next) => {
  try {
    const db = dbRequired()
    const settings = await getReminderSettings(db)
    res.json(settings)
  } catch (e) { next(e) }
})

adminRoutes.patch('/settings', async (req, res, next) => {
  try {
    const db = dbRequired()
    const patch = {}
    if (req.body?.enabled !== undefined) patch.enabled = Boolean(req.body.enabled)
    if (req.body?.cronSchedule) patch.cronSchedule = String(req.body.cronSchedule)
    if (req.body?.cooldownDays !== undefined) patch.cooldownDays = Number(req.body.cooldownDays)
    if (req.body?.maxReminders !== undefined) patch.maxReminders = Number(req.body.maxReminders)
    if (req.body?.warningDaysBefore !== undefined) patch.warningDaysBefore = Number(req.body.warningDaysBefore)
    const updated = await updateReminderSettings(db, patch)
    res.json(updated)
  } catch (e) { next(e) }
})

adminRoutes.get('/log', async (req, res, next) => {
  try {
    const db = dbRequired()
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(Number(req.query.limit) || 25, 100)

    const snap = await db.collection('reminderLog').orderBy('sentAt', 'desc').limit(500).get()
    let rows = snap.docs.map((d) => serializeDoc(d))

    if (req.query.traineeId) rows = rows.filter((r) => r.traineeId === req.query.traineeId)
    if (req.query.type) rows = rows.filter((r) => r.type === req.query.type)
    if (req.query.trigger) rows = rows.filter((r) => r.trigger === req.query.trigger)

    const total = rows.length
    const start = (page - 1) * limit
    const paginated = rows.slice(start, start + limit)

    res.json({ data: paginated, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (e) { next(e) }
})

adminRoutes.get('/pending', async (req, res, next) => {
  try {
    const db = dbRequired()
    const settings = await getReminderSettings(db)
    const now = new Date()
    const enSnap = await db.collection('enrollments').get()

    const activeEnrollments = enSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((en) => en.status === 'active')
      .filter((en) => {
        const dueDate = en.dueDate
          ? (en.dueDate.toDate ? en.dueDate.toDate() : new Date(en.dueDate))
          : null
        return Boolean(dueDate)
      })

    const usersById = await getDocSnapshotsById(
      db,
      'users',
      activeEnrollments.map((en) => en.traineeId),
    )
    const courseProgressById = await getDocSnapshotsById(
      db,
      'courseProgress',
      activeEnrollments.map((en) => `${en.traineeId}_${en.courseId}`),
    )

    const remindersByEnrollmentId = new Map()
    const enrollmentIds = activeEnrollments.map((en) => en.id)
    const chunkSize = 10
    for (let i = 0; i < enrollmentIds.length; i += chunkSize) {
      const chunk = enrollmentIds.slice(i, i + chunkSize)
      if (chunk.length === 0) continue
      const logSnap = await db.collection('reminderLog').where('enrollmentId', 'in', chunk).get()
      for (const doc of logSnap.docs) {
        const row = doc.data()
        const key = row.enrollmentId
        if (!key) continue
        const arr = remindersByEnrollmentId.get(key) || []
        arr.push(row)
        remindersByEnrollmentId.set(key, arr)
      }
    }

    const pending = []

    for (const en of activeEnrollments) {
      const dueDate = en.dueDate ? (en.dueDate.toDate ? en.dueDate.toDate() : new Date(en.dueDate)) : null
      if (!dueDate) continue

      const uDoc = usersById.get(en.traineeId)
      if (!uDoc?.exists) continue
      const user = uDoc.data()
      if (user.disabled) continue

      const cpDoc = courseProgressById.get(`${en.traineeId}_${en.courseId}`)
      const cp = cpDoc?.exists ? cpDoc.data() : {}
      if (cp.status === 'completed') continue

      const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24))
      const isOverdue = daysUntilDue < 0
      const isWarning = daysUntilDue > 0 && daysUntilDue <= settings.warningDaysBefore
      if (!isOverdue && !isWarning) continue

      // Check max reminders
      const reminders = remindersByEnrollmentId.get(en.id) || []
      if (reminders.length >= settings.maxReminders) continue

      // Check cooldown
      const mostRecent = reminders
        .map((r) => r.sentAt ? (r.sentAt.toDate ? r.sentAt.toDate() : new Date(r.sentAt)) : null)
        .filter(Boolean)
        .sort((a, b) => b - a)[0]
      if (mostRecent && (now - mostRecent) / (1000 * 60 * 60 * 24) < settings.cooldownDays) continue

      if (isWarning && reminders.some((r) => r.type === 'warning')) continue

      pending.push({
        traineeId: en.traineeId,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        email: user.email || '',
        progress: cp.percentComplete || 0,
        dueDate: serializeValue(en.dueDate),
        daysOverdue: isOverdue ? Math.abs(daysUntilDue) : 0,
        type: isWarning ? 'warning' : 'overdue',
        enrollmentId: en.id,
        remindersSent: reminders.length,
        maxReminders: settings.maxReminders,
      })
    }

    pending.sort((a, b) => b.daysOverdue - a.daysOverdue)
    res.json(pending)
  } catch (e) { next(e) }
})

adminRoutes.get('/trainees/:traineeId', async (req, res, next) => {
  try {
    const db = dbRequired()
    const snap = await db.collection('reminderLog')
      .where('traineeId', '==', req.params.traineeId)
      .get()
    const rows = snap.docs.map((d) => serializeDoc(d))
      .sort((a, b) => String(b.sentAt || '').localeCompare(String(a.sentAt || '')))
    res.json(rows)
  } catch (e) { next(e) }
})

adminRoutes.post('/send', async (req, res, next) => {
  try {
    const db = dbRequired()
    const { traineeId, enrollmentId } = req.body || {}
    if (!traineeId || !enrollmentId) {
      const err = new Error('traineeId and enrollmentId are required'); err.status = 400; throw err
    }
    const result = await sendManualReminder(db, traineeId, enrollmentId)
    res.json(result)
  } catch (e) { next(e) }
})

remindersRouter.use('/', adminRoutes)

// Internal endpoint for scheduled job
remindersRouter.post('/run', async (req, res, next) => {
  try {
    // Validate internal API key or admin auth
    const apiKey = req.headers['x-internal-key']
    const isInternal = apiKey && apiKey === process.env.INTERNAL_API_KEY
    if (!isInternal) {
      // Fall back to admin auth check
      const header = req.headers.authorization || ''
      if (!header.startsWith('Bearer ')) {
        const err = new Error('Unauthorized'); err.status = 401; throw err
      }
    }
    const result = await runReminderScan()
    res.json(result)
  } catch (e) { next(e) }
})
