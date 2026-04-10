import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { getDb } from '../utils/firestoreDb.js'
import { serializeDoc, serializeValue } from '../utils/serialize.js'

export const adminDashboardRouter = Router()
adminDashboardRouter.use(requireAuth, requireRole('admin'))

function dbRequired() {
  const db = getDb()
  if (!db) { const err = new Error('Database not configured'); err.status = 503; throw err }
  return db
}

// ── Dashboard summary ───────────────────────────────────────────────

adminDashboardRouter.get('/summary', async (req, res, next) => {
  try {
    const db = dbRequired()
    const usersSnap = await db.collection('users').get()
    const trainees = usersSnap.docs.filter((d) => d.data().role === 'trainee' && !d.data().disabled)

    const enSnap = await db.collection('enrollments').get()
    const enrollments = enSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    const activeEnrollments = enrollments.filter((e) => e.status === 'active')
    const completedEnrollments = enrollments.filter((e) => e.status === 'completed')

    const now = new Date()
    const overdueEnrollments = activeEnrollments.filter((e) => {
      if (!e.dueDate) return false
      const due = e.dueDate.toDate ? e.dueDate.toDate() : new Date(e.dueDate)
      return due < now
    })

    const cpSnap = await db.collection('courseProgress').get()
    let progressSum = 0
    let progressCount = 0
    for (const d of cpSnap.docs) {
      const cp = d.data()
      if (cp.status !== 'completed') {
        progressSum += (cp.percentComplete || 0)
        progressCount++
      }
    }

    res.json({
      totalTrainees: trainees.length,
      enrolled: activeEnrollments.length,
      completed: completedEnrollments.length,
      overdue: overdueEnrollments.length,
      averageProgress: progressCount === 0 ? 0 : Math.round(progressSum / progressCount),
    })
  } catch (e) { next(e) }
})

adminDashboardRouter.get('/at-risk', async (req, res, next) => {
  try {
    const db = dbRequired()
    const enSnap = await db.collection('enrollments').get()
    const activeEnrollments = enSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((e) => e.status === 'active')

    const now = new Date()
    const atRisk = []

    for (const en of activeEnrollments) {
      const cpDoc = await db.collection('courseProgress').doc(`${en.traineeId}_${en.courseId}`).get()
      const cp = cpDoc.exists ? cpDoc.data() : null
      if (cp?.status === 'completed') continue

      const progress = cp?.percentComplete || 0
      const dueDate = en.dueDate ? (en.dueDate.toDate ? en.dueDate.toDate() : new Date(en.dueDate)) : null
      if (!dueDate) continue

      const isOverdue = dueDate < now
      const totalDays = (dueDate - new Date(en.enrolledAt?.toDate?.() || en.enrolledAt || now)) / (1000 * 60 * 60 * 24)
      const elapsed = (now - new Date(en.enrolledAt?.toDate?.() || en.enrolledAt || now)) / (1000 * 60 * 60 * 24)
      const timeElapsedPct = totalDays > 0 ? (elapsed / totalDays) * 100 : 0
      const isLowProgress = progress < 25 && timeElapsedPct > 50

      if (isOverdue || isLowProgress) {
        const uDoc = await db.collection('users').doc(en.traineeId).get()
        const user = uDoc.exists ? uDoc.data() : {}
        const daysOverdue = isOverdue ? Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24)) : 0

        atRisk.push({
          traineeId: en.traineeId,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || en.traineeId,
          email: user.email || '',
          progress,
          currentModuleId: cp?.currentModuleId || null,
          dueDate: serializeValue(en.dueDate),
          daysOverdue,
          isOverdue,
          enrollmentId: en.id,
        })
      }
    }

    atRisk.sort((a, b) => b.daysOverdue - a.daysOverdue)
    res.json(atRisk)
  } catch (e) { next(e) }
})

adminDashboardRouter.get('/recent-activity', async (req, res, next) => {
  try {
    const db = dbRequired()
    const limit = Math.min(Number(req.query.limit) || 10, 50)

    // Gather recent lesson completions and quiz attempts
    const events = []

    const lpSnap = await db.collection('lessonProgress').orderBy('updatedAt', 'desc').limit(limit * 2).get()
    for (const d of lpSnap.docs) {
      const lp = d.data()
      if (lp.status !== 'completed') continue
      events.push({
        type: 'lesson_completed',
        traineeId: lp.traineeId,
        lessonId: lp.lessonId,
        lessonType: lp.lessonType,
        timestamp: serializeValue(lp.completedAt || lp.updatedAt),
      })
    }

    const qaSnap = await db.collection('quizAttempts').orderBy('updatedAt', 'desc').limit(limit * 2).get()
    for (const d of qaSnap.docs) {
      const qa = d.data()
      if (qa.status !== 'submitted') continue
      events.push({
        type: qa.passed === true ? 'exam_passed' : qa.passed === false ? 'exam_failed' : 'quiz_submitted',
        traineeId: qa.traineeId,
        quizId: qa.quizId,
        score: qa.score,
        timestamp: serializeValue(qa.submittedAt || qa.updatedAt),
      })
    }

    // Enrich with user names
    const traineeIds = [...new Set(events.map((e) => e.traineeId))]
    const nameMap = new Map()
    for (const uid of traineeIds) {
      const uDoc = await db.collection('users').doc(uid).get()
      if (uDoc.exists) {
        const u = uDoc.data()
        nameMap.set(uid, `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || uid)
      } else {
        nameMap.set(uid, uid)
      }
    }

    const enriched = events.map((e) => ({ ...e, traineeName: nameMap.get(e.traineeId) || e.traineeId }))
    enriched.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')))

    res.json(enriched.slice(0, limit))
  } catch (e) { next(e) }
})

// ── Trainee performance table ───────────────────────────────────────

adminDashboardRouter.get('/trainees', async (req, res, next) => {
  try {
    const db = dbRequired()
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(Number(req.query.limit) || 25, 100)
    const search = (req.query.search || '').toLowerCase().trim()
    const statusFilter = req.query.status || ''
    const sort = req.query.sort || 'name'
    const order = req.query.order === 'desc' ? -1 : 1

    // Batch-load all enrollments, users, and courseProgress in parallel
    const [enSnap, cpSnap, usersSnap] = await Promise.all([
      db.collection('enrollments').get(),
      db.collection('courseProgress').get(),
      db.collection('users').get(),
    ])

    const enrollments = enSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

    const userMap = new Map()
    for (const d of usersSnap.docs) userMap.set(d.id, d.data())

    const cpMap = new Map()
    for (const d of cpSnap.docs) cpMap.set(d.id, d.data())

    const now = new Date()

    const traineeMap = new Map()
    for (const en of enrollments) {
      if (!traineeMap.has(en.traineeId)) {
        const user = userMap.get(en.traineeId) || {}
        if (user.status === 'disabled') continue
        traineeMap.set(en.traineeId, { enrollments: [], user })
      }
      const entry = traineeMap.get(en.traineeId)
      if (!entry) continue
      entry.enrollments.push(en)
    }

    const rows = []

    for (const [traineeId, { enrollments: traineeEnrollments, user }] of traineeMap) {
      const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || traineeId
      const email = user.email || ''

      if (search && !name.toLowerCase().includes(search) && !email.toLowerCase().includes(search)) continue

      let worstStatus = 'active'
      let bestProgress = 0
      let earliestDue = null
      let latestActive = null
      let courseCount = 0

      for (const en of traineeEnrollments) {
        if (en.status === 'withdrawn') continue
        courseCount++

        const cp = cpMap.get(`${traineeId}_${en.courseId}`) || null
        const progress = cp?.percentComplete || 0
        if (progress > bestProgress) bestProgress = progress

        const dueDate = en.dueDate ? (en.dueDate.toDate ? en.dueDate.toDate() : new Date(en.dueDate)) : null
        const isOverdue = dueDate && dueDate < now && en.status === 'active' && cp?.status !== 'completed'

        let effectiveStatus = en.status
        if (isOverdue) effectiveStatus = 'overdue'
        if (cp?.status === 'completed') effectiveStatus = 'completed'

        if (effectiveStatus === 'overdue') worstStatus = 'overdue'
        else if (effectiveStatus === 'completed' && worstStatus !== 'overdue') {
          if (worstStatus === 'active') worstStatus = 'completed'
        }

        if (dueDate && (!earliestDue || dueDate < earliestDue)) earliestDue = dueDate
        const activeTs = cp?.updatedAt ? (cp.updatedAt.toDate ? cp.updatedAt.toDate() : new Date(cp.updatedAt)) : null
        if (activeTs && (!latestActive || activeTs > latestActive)) latestActive = activeTs
      }

      if (courseCount === 0) {
        worstStatus = 'withdrawn'
        if (statusFilter && statusFilter !== 'all' && statusFilter !== 'withdrawn') continue
      }

      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'overdue' && worstStatus !== 'overdue') continue
        if (statusFilter === 'active' && worstStatus !== 'active') continue
        if (statusFilter === 'completed' && worstStatus !== 'completed') continue
        if (statusFilter === 'withdrawn' && worstStatus !== 'withdrawn') continue
      }

      const daysRemaining = earliestDue ? Math.ceil((earliestDue - now) / (1000 * 60 * 60 * 24)) : null

      rows.push({
        traineeId,
        name,
        email,
        status: worstStatus,
        progress: bestProgress,
        courseCount,
        dueDate: earliestDue ? serializeValue(earliestDue) : null,
        daysRemaining,
        lastActive: latestActive ? serializeValue(latestActive) : null,
      })
    }

    rows.sort((a, b) => {
      let cmp = 0
      if (sort === 'name') cmp = String(a.name).localeCompare(String(b.name))
      else if (sort === 'progress') cmp = (a.progress || 0) - (b.progress || 0)
      else if (sort === 'dueDate') cmp = String(a.dueDate || '').localeCompare(String(b.dueDate || ''))
      else if (sort === 'lastActive') cmp = String(a.lastActive || '').localeCompare(String(b.lastActive || ''))
      return cmp * order
    })

    const total = rows.length
    const start = (page - 1) * limit
    const paginated = rows.slice(start, start + limit)

    res.json({ data: paginated, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (e) { next(e) }
})

adminDashboardRouter.get('/trainees/:traineeId/progress', async (req, res, next) => {
  try {
    const db = dbRequired()
    const { traineeId } = req.params

    const uDoc = await db.collection('users').doc(traineeId).get()
    const user = uDoc.exists ? serializeDoc(uDoc) : null

    const enSnap = await db.collection('enrollments').where('traineeId', '==', traineeId).get()
    const allEnrollments = enSnap.docs.map((d) => serializeDoc(d))

    if (allEnrollments.length === 0) return res.json({ user, courses: [], attempts: [], activity: [], reminders: [] })

    // Build per-course details for all enrollments
    const courseSnap = await db.collection('courses').limit(500).get()
    const courseTitleMap = new Map(courseSnap.docs.map((d) => [d.id, d.data().title || 'Untitled']))

    const now = new Date()
    const courseDetails = []

    for (const enrollment of allEnrollments) {
      const courseId = enrollment.courseId
      const courseTitle = courseTitleMap.get(courseId) || 'Unknown Course'
      const cpDoc = await db.collection('courseProgress').doc(`${traineeId}_${courseId}`).get()
      const cp = cpDoc.exists ? cpDoc.data() : null

      const dueDate = enrollment.dueDate ? new Date(enrollment.dueDate) : null
      const isOverdue = dueDate && dueDate < now && enrollment.status === 'active' && cp?.status !== 'completed'
      let effectiveStatus = enrollment.status
      if (isOverdue) effectiveStatus = 'overdue'
      if (cp?.status === 'completed') effectiveStatus = 'completed'

      // Module breakdown for this course
      const modSnap = await db.collection('modules').where('courseId', '==', courseId).get()
      const modules = modSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((m) => m.status === 'published')
        .sort((a, b) => (a.order || 0) - (b.order || 0))

      const moduleDetails = []
      for (const mod of modules) {
        const mpDoc = await db.collection('moduleProgress').doc(`${traineeId}_${mod.id}`).get()
        const mp = mpDoc.exists ? mpDoc.data() : null

        const lessonSnap = await db.collection('lessons').where('moduleId', '==', mod.id).get()
        const examLessons = lessonSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((l) => l.type === 'exam' && l.status === 'published')

        let examScore = null
        let examAttempts = 0
        for (const el of examLessons) {
          if (el.content?.quizId) {
            const attSnap = await db.collection('quizAttempts')
              .where('quizId', '==', el.content.quizId)
              .where('traineeId', '==', traineeId)
              .get()
            examAttempts = attSnap.size
            const scores = attSnap.docs.map((d) => d.data().score).filter((s) => s != null)
            examScore = scores.length > 0 ? Math.max(...scores) : null
          }
        }

        moduleDetails.push({
          moduleId: mod.id,
          title: mod.title,
          order: mod.order,
          status: mp?.status || 'locked',
          percentComplete: mp?.percentComplete || 0,
          completedLessons: mp?.completedLessons || 0,
          totalLessons: mp?.totalLessons || 0,
          examScore,
          examAttempts,
        })
      }

      courseDetails.push({
        courseId,
        courseTitle,
        enrollment: serializeValue(enrollment),
        courseProgress: cpDoc.exists ? serializeDoc(cpDoc) : null,
        status: effectiveStatus,
        modules: moduleDetails,
      })
    }

    // Assessment history (across all courses)
    const attSnap = await db.collection('quizAttempts').where('traineeId', '==', traineeId).get()
    const attempts = attSnap.docs.map((d) => serializeDoc(d))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))

    const quizIds = [...new Set(attempts.map((a) => a.quizId))]
    const quizNameMap = new Map()
    for (const qid of quizIds) {
      const qDoc = await db.collection('quizzes').doc(qid).get()
      if (qDoc.exists) quizNameMap.set(qid, { title: qDoc.data().title, type: qDoc.data().type })
    }
    const enrichedAttempts = attempts.map((a) => ({
      ...a,
      quizTitle: quizNameMap.get(a.quizId)?.title || 'Unknown',
      quizType: quizNameMap.get(a.quizId)?.type || 'quiz',
    }))

    // Activity timeline
    const lpSnap = await db.collection('lessonProgress').where('traineeId', '==', traineeId).get()
    const activity = []
    for (const d of lpSnap.docs) {
      const lp = d.data()
      activity.push({
        type: 'lesson_progress',
        status: lp.status,
        lessonId: lp.lessonId,
        lessonType: lp.lessonType,
        timestamp: serializeValue(lp.updatedAt || lp.createdAt),
      })
    }
    for (const a of attempts) {
      activity.push({
        type: a.passed === true ? 'exam_passed' : a.passed === false ? 'exam_failed' : 'quiz_submitted',
        quizId: a.quizId,
        score: a.score,
        timestamp: a.submittedAt || a.createdAt,
      })
    }
    activity.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')))

    // Reminder history
    const rlSnap = await db.collection('reminderLog').where('traineeId', '==', traineeId).get()
    const reminders = rlSnap.docs.map((d) => serializeDoc(d))
      .sort((a, b) => String(b.sentAt || '').localeCompare(String(a.sentAt || '')))

    res.json({
      user,
      courses: courseDetails,
      attempts: enrichedAttempts,
      activity: activity.slice(0, 50),
      reminders,
    })
  } catch (e) { next(e) }
})

// ── Reports ─────────────────────────────────────────────────────────

adminDashboardRouter.get('/reports/module-funnel', async (req, res, next) => {
  try {
    const db = dbRequired()
    const courseId = req.query.courseId
    if (!courseId) { const err = new Error('courseId required'); err.status = 400; throw err }

    const modSnap = await db.collection('modules').where('courseId', '==', courseId).get()
    const modules = modSnap.docs
      .filter((d) => d.data().status === 'published')
      .sort((a, b) => (a.data().order || 0) - (b.data().order || 0))

    const mpSnap = await db.collection('moduleProgress').where('courseId', '==', courseId).get()
    const completedMap = {}
    for (const d of mpSnap.docs) {
      if (d.data().status === 'completed') {
        completedMap[d.data().moduleId] = (completedMap[d.data().moduleId] || 0) + 1
      }
    }

    const enSnap = await db.collection('enrollments').where('courseId', '==', courseId).get()
    const totalEnrolled = enSnap.docs.filter((d) => d.data().status !== 'withdrawn').length

    const funnel = modules.map((d) => ({
      moduleId: d.id,
      title: d.data().title,
      order: d.data().order,
      completedCount: completedMap[d.id] || 0,
      totalEnrolled,
    }))

    res.json(funnel)
  } catch (e) { next(e) }
})

adminDashboardRouter.get('/reports/overdue', async (req, res, next) => {
  try {
    const db = dbRequired()
    const enSnap = await db.collection('enrollments').get()
    const now = new Date()
    const rows = []

    for (const d of enSnap.docs) {
      const en = d.data()
      if (en.status !== 'active') continue
      const dueDate = en.dueDate ? (en.dueDate.toDate ? en.dueDate.toDate() : new Date(en.dueDate)) : null
      if (!dueDate || dueDate >= now) continue

      const cpDoc = await db.collection('courseProgress').doc(`${en.traineeId}_${en.courseId}`).get()
      if (cpDoc.exists && cpDoc.data().status === 'completed') continue

      const uDoc = await db.collection('users').doc(en.traineeId).get()
      const user = uDoc.exists ? uDoc.data() : {}

      rows.push({
        traineeId: en.traineeId,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || en.traineeId,
        email: user.email || '',
        progress: cpDoc.exists ? cpDoc.data().percentComplete || 0 : 0,
        currentModuleId: cpDoc.exists ? cpDoc.data().currentModuleId : null,
        dueDate: serializeValue(en.dueDate),
        daysOverdue: Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24)),
        lastActive: cpDoc.exists ? serializeValue(cpDoc.data().updatedAt) : null,
        enrollmentId: d.id,
      })
    }

    rows.sort((a, b) => b.daysOverdue - a.daysOverdue)
    res.json(rows)
  } catch (e) { next(e) }
})

adminDashboardRouter.get('/reports/assessments', async (req, res, next) => {
  try {
    const db = dbRequired()
    const quizSnap = await db.collection('quizzes').get()
    const quizzes = quizSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((q) => q.status !== 'archived')

    const attSnap = await db.collection('quizAttempts').get()
    const allAttempts = attSnap.docs.map((d) => d.data()).filter((a) => a.status === 'submitted')

    const report = quizzes.map((quiz) => {
      const attempts = allAttempts.filter((a) => a.quizId === quiz.id)
      const uniqueTrainees = new Set(attempts.map((a) => a.traineeId))
      const scores = attempts.map((a) => a.score).filter((s) => s != null)
      const avgScore = scores.length === 0 ? 0 : Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
      const passCount = attempts.filter((a) => a.passed === true).length
      const passRate = attempts.length === 0 ? 0 : Math.round((passCount / attempts.length) * 100)

      const firstAttempts = []
      const seen = new Set()
      for (const a of attempts.sort((x, y) => (x.attemptNumber || 1) - (y.attemptNumber || 1))) {
        if (!seen.has(a.traineeId)) {
          seen.add(a.traineeId)
          firstAttempts.push(a)
        }
      }
      const firstPassCount = firstAttempts.filter((a) => a.passed === true).length
      const firstPassRate = firstAttempts.length === 0 ? 0 : Math.round((firstPassCount / firstAttempts.length) * 100)

      return {
        quizId: quiz.id,
        title: quiz.title,
        type: quiz.type,
        totalAttempts: attempts.length,
        uniqueTrainees: uniqueTrainees.size,
        averageScore: avgScore,
        passRate: quiz.type === 'exam' ? passRate : null,
        firstAttemptPassRate: quiz.type === 'exam' ? firstPassRate : null,
      }
    })

    res.json(report)
  } catch (e) { next(e) }
})

adminDashboardRouter.get('/reports/course-completion', async (req, res, next) => {
  try {
    const db = dbRequired()
    const courseId = req.query.courseId
    if (!courseId) { const err = new Error('courseId required'); err.status = 400; throw err }

    const enSnap = await db.collection('enrollments').where('courseId', '==', courseId).get()
    const enrollments = enSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    const now = new Date()

    let totalEnrolled = enrollments.length
    let active = 0
    let completed = 0
    let withdrawn = 0
    let overdue = 0
    const completionTimes = []

    for (const en of enrollments) {
      if (en.status === 'withdrawn') { withdrawn++; continue }
      if (en.status === 'completed') {
        completed++
        if (en.enrolledAt && en.completedAt) {
          const start = en.enrolledAt.toDate ? en.enrolledAt.toDate() : new Date(en.enrolledAt)
          const end = en.completedAt.toDate ? en.completedAt.toDate() : new Date(en.completedAt)
          completionTimes.push(Math.ceil((end - start) / (1000 * 60 * 60 * 24)))
        }
        continue
      }
      active++
      const dueDate = en.dueDate ? (en.dueDate.toDate ? en.dueDate.toDate() : new Date(en.dueDate)) : null
      if (dueDate && dueDate < now) overdue++
    }

    const avgCompletionDays = completionTimes.length === 0 ? 0 : Math.round(completionTimes.reduce((s, v) => s + v, 0) / completionTimes.length)

    res.json({
      totalEnrolled,
      active,
      completed,
      completionRate: totalEnrolled === 0 ? 0 : Math.round((completed / totalEnrolled) * 100),
      averageCompletionDays: avgCompletionDays,
      withdrawn,
      overdue,
    })
  } catch (e) { next(e) }
})

// ── CSV Exports ─────────────────────────────────────────────────────

function toCsv(rows, columns) {
  const header = columns.map((c) => c.label).join(',')
  const body = rows.map((r) =>
    columns.map((c) => {
      let val = r[c.key]
      if (val == null) val = ''
      val = String(val).replace(/"/g, '""')
      return `"${val}"`
    }).join(','),
  ).join('\n')
  return `${header}\n${body}`
}

adminDashboardRouter.get('/export/trainees', async (req, res, next) => {
  try {
    const db = dbRequired()
    // Reuse the trainee list logic
    const enSnap = await db.collection('enrollments').get()
    const now = new Date()
    const rows = []

    for (const d of enSnap.docs) {
      const en = d.data()
      if (en.status === 'withdrawn') continue
      const uDoc = await db.collection('users').doc(en.traineeId).get()
      const user = uDoc.exists ? uDoc.data() : {}
      const cpDoc = await db.collection('courseProgress').doc(`${en.traineeId}_${en.courseId}`).get()
      const cp = cpDoc.exists ? cpDoc.data() : null
      const dueDate = en.dueDate ? (en.dueDate.toDate ? en.dueDate.toDate() : new Date(en.dueDate)) : null

      rows.push({
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: user.email || '',
        status: cp?.status === 'completed' ? 'completed' : (dueDate && dueDate < now ? 'overdue' : en.status),
        progress: cp?.percentComplete || 0,
        dueDate: dueDate ? dueDate.toISOString().split('T')[0] : '',
        enrolledAt: en.enrolledAt ? (en.enrolledAt.toDate ? en.enrolledAt.toDate() : new Date(en.enrolledAt)).toISOString().split('T')[0] : '',
      })
    }

    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'status', label: 'Status' },
      { key: 'progress', label: 'Progress (%)' },
      { key: 'dueDate', label: 'Due Date' },
      { key: 'enrolledAt', label: 'Enrolled Date' },
    ]

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="trainees.csv"')
    res.send(toCsv(rows, columns))
  } catch (e) { next(e) }
})

adminDashboardRouter.get('/export/overdue', async (req, res, next) => {
  try {
    const db = dbRequired()
    const enSnap = await db.collection('enrollments').get()
    const now = new Date()
    const rows = []

    for (const d of enSnap.docs) {
      const en = d.data()
      if (en.status !== 'active') continue
      const dueDate = en.dueDate ? (en.dueDate.toDate ? en.dueDate.toDate() : new Date(en.dueDate)) : null
      if (!dueDate || dueDate >= now) continue
      const cpDoc = await db.collection('courseProgress').doc(`${en.traineeId}_${en.courseId}`).get()
      if (cpDoc.exists && cpDoc.data().status === 'completed') continue
      const uDoc = await db.collection('users').doc(en.traineeId).get()
      const user = uDoc.exists ? uDoc.data() : {}

      rows.push({
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: user.email || '',
        progress: cpDoc.exists ? cpDoc.data().percentComplete || 0 : 0,
        dueDate: dueDate.toISOString().split('T')[0],
        daysOverdue: Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24)),
      })
    }

    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'progress', label: 'Progress (%)' },
      { key: 'dueDate', label: 'Due Date' },
      { key: 'daysOverdue', label: 'Days Overdue' },
    ]

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="overdue-trainees.csv"')
    res.send(toCsv(rows, columns))
  } catch (e) { next(e) }
})

adminDashboardRouter.get('/export/assessments', async (req, res, next) => {
  try {
    const db = dbRequired()
    const quizSnap = await db.collection('quizzes').get()
    const quizzes = quizSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((q) => q.status !== 'archived')
    const attSnap = await db.collection('quizAttempts').get()
    const allAttempts = attSnap.docs.map((d) => d.data()).filter((a) => a.status === 'submitted')

    const rows = quizzes.map((quiz) => {
      const attempts = allAttempts.filter((a) => a.quizId === quiz.id)
      const scores = attempts.map((a) => a.score).filter((s) => s != null)
      const avgScore = scores.length === 0 ? 0 : Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
      const passCount = attempts.filter((a) => a.passed === true).length
      return {
        title: quiz.title,
        type: quiz.type,
        totalAttempts: attempts.length,
        uniqueTrainees: new Set(attempts.map((a) => a.traineeId)).size,
        averageScore: avgScore,
        passRate: quiz.type === 'exam' ? (attempts.length === 0 ? 0 : Math.round((passCount / attempts.length) * 100)) : 'N/A',
      }
    })

    const columns = [
      { key: 'title', label: 'Assessment' },
      { key: 'type', label: 'Type' },
      { key: 'totalAttempts', label: 'Total Attempts' },
      { key: 'uniqueTrainees', label: 'Unique Trainees' },
      { key: 'averageScore', label: 'Average Score (%)' },
      { key: 'passRate', label: 'Pass Rate (%)' },
    ]

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="assessments.csv"')
    res.send(toCsv(rows, columns))
  } catch (e) { next(e) }
})

adminDashboardRouter.get('/export/trainees/:traineeId/attempts', async (req, res, next) => {
  try {
    const db = dbRequired()
    const attSnap = await db.collection('quizAttempts').where('traineeId', '==', req.params.traineeId).get()
    const quizIds = [...new Set(attSnap.docs.map((d) => d.data().quizId))]
    const quizMap = new Map()
    for (const qid of quizIds) {
      const qDoc = await db.collection('quizzes').doc(qid).get()
      if (qDoc.exists) quizMap.set(qid, qDoc.data())
    }

    const rows = attSnap.docs.map((d) => {
      const a = d.data()
      const quiz = quizMap.get(a.quizId) || {}
      return {
        assessment: quiz.title || a.quizId,
        type: quiz.type || '',
        attemptNumber: a.attemptNumber,
        score: a.score,
        passed: a.passed == null ? '' : a.passed ? 'Pass' : 'Fail',
        date: a.submittedAt ? (a.submittedAt.toDate ? a.submittedAt.toDate() : new Date(a.submittedAt)).toISOString().split('T')[0] : '',
      }
    })

    const columns = [
      { key: 'assessment', label: 'Assessment' },
      { key: 'type', label: 'Type' },
      { key: 'attemptNumber', label: 'Attempt #' },
      { key: 'score', label: 'Score (%)' },
      { key: 'passed', label: 'Result' },
      { key: 'date', label: 'Date' },
    ]

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="trainee-${req.params.traineeId}-attempts.csv"`)
    res.send(toCsv(rows, columns))
  } catch (e) { next(e) }
})
