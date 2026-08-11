import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { getDb } from '../utils/firestoreDb.js'
import { getDocSnapshotsById } from '../utils/firestoreBatch.js'
import { serializeDoc, serializeValue } from '../utils/serialize.js'

export const adminDashboardRouter = Router()
adminDashboardRouter.use(requireAuth, requireRole('admin'))

function dbRequired() {
  const db = getDb()
  if (!db) { const err = new Error('Database not configured'); err.status = 503; throw err }
  return db
}

function asDate(value) {
  if (!value) return null
  if (value.toDate) return value.toDate()
  return new Date(value)
}

// ── Dashboard summary ───────────────────────────────────────────────

adminDashboardRouter.get('/summary', async (req, res, next) => {
  try {
    const db = dbRequired()
    // Three independent collection reads — run them concurrently rather than in series.
    const [usersSnap, enSnap, cpSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('enrollments').get(),
      db.collection('courseProgress').get(),
    ])
    const trainees = usersSnap.docs.filter((d) => d.data().role === 'trainee' && !d.data().disabled)

    const enrollments = enSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    const activeEnrollments = enrollments.filter((e) => e.status === 'active')
    const completedEnrollments = enrollments.filter((e) => e.status === 'completed')

    const now = new Date()
    const overdueEnrollments = activeEnrollments.filter((e) => {
      if (!e.dueDate) return false
      const due = e.dueDate.toDate ? e.dueDate.toDate() : new Date(e.dueDate)
      return due < now
    })

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

    const courseProgressById = await getDocSnapshotsById(
      db,
      'courseProgress',
      activeEnrollments.map((en) => `${en.traineeId}_${en.courseId}`),
    )

    const now = new Date()
    const riskCandidates = []
    for (const en of activeEnrollments) {
      const cpDoc = courseProgressById.get(`${en.traineeId}_${en.courseId}`)
      const cp = cpDoc?.exists ? cpDoc.data() : null
      if (cp?.status === 'completed') continue

      const progress = cp?.percentComplete || 0
      const dueDate = asDate(en.dueDate)
      if (!dueDate) continue

      const isOverdue = dueDate < now
      const enrolledAt = asDate(en.enrolledAt) || now
      const totalDays = (dueDate - enrolledAt) / (1000 * 60 * 60 * 24)
      const elapsed = (now - enrolledAt) / (1000 * 60 * 60 * 24)
      const timeElapsedPct = totalDays > 0 ? (elapsed / totalDays) * 100 : 0
      const isLowProgress = progress < 25 && timeElapsedPct > 50

      if (isOverdue || isLowProgress) {
        riskCandidates.push({ en, cp, progress, dueDate, isOverdue })
      }
    }

    const usersById = await getDocSnapshotsById(
      db,
      'users',
      riskCandidates.map((r) => r.en.traineeId),
    )
    const atRisk = riskCandidates.map(({ en, cp, progress, dueDate, isOverdue }) => {
      const uDoc = usersById.get(en.traineeId)
      const user = uDoc?.exists ? uDoc.data() : {}
      const daysOverdue = isOverdue ? Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24)) : 0
      return {
        traineeId: en.traineeId,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || en.traineeId,
        email: user.email || '',
        progress,
        currentModuleId: cp?.currentModuleId || null,
        dueDate: serializeValue(en.dueDate),
        daysOverdue,
        isOverdue,
        enrollmentId: en.id,
      }
    })

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
    const usersById = await getDocSnapshotsById(db, 'users', traineeIds)
    const nameMap = new Map(traineeIds.map((uid) => {
      const uDoc = usersById.get(uid)
      if (!uDoc?.exists) return [uid, uid]
      const u = uDoc.data()
      return [uid, `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || uid]
    }))

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
    const [courseSnap, attSnap] = await Promise.all([
      db.collection('courses').limit(500).get(),
      db.collection('quizAttempts').where('traineeId', '==', traineeId).get(),
    ])
    const courseTitleMap = new Map(courseSnap.docs.map((d) => [d.id, d.data().title || 'Untitled']))
    const attempts = attSnap.docs.map((d) => serializeDoc(d))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    const attemptsByQuizId = new Map()
    for (const a of attempts) {
      const arr = attemptsByQuizId.get(a.quizId) || []
      arr.push(a)
      attemptsByQuizId.set(a.quizId, arr)
    }
    const courseProgressById = await getDocSnapshotsById(
      db,
      'courseProgress',
      allEnrollments.map((en) => `${traineeId}_${en.courseId}`),
    )

    const now = new Date()
    const uniqueCourseIds = [...new Set(allEnrollments.map((en) => en.courseId).filter(Boolean))]

    // Fetch modules + lessons once per course, in parallel. Previously this ran one
    // modules query per enrollment and then, per module, a moduleProgress get and a
    // lessons query — all sequential (E + E*M*2 round trips for E courses, M modules).
    const [modulesByCourse, lessonsByCourse] = await Promise.all([
      Promise.all(
        uniqueCourseIds.map(async (courseId) => {
          const snap = await db.collection('modules').where('courseId', '==', courseId).get()
          return [courseId, snap.docs.map((d) => ({ id: d.id, ...d.data() }))]
        }),
      ).then((entries) => new Map(entries)),
      Promise.all(
        uniqueCourseIds.map(async (courseId) => {
          const snap = await db.collection('lessons').where('courseId', '==', courseId).get()
          return [courseId, snap.docs.map((d) => ({ id: d.id, ...d.data() }))]
        }),
      ).then((entries) => new Map(entries)),
    ])

    // One batched read for every module's progress doc across every enrolled course.
    const allModuleIds = uniqueCourseIds.flatMap((courseId) =>
      (modulesByCourse.get(courseId) || []).map((m) => m.id),
    )
    const moduleProgressById = await getDocSnapshotsById(
      db,
      'moduleProgress',
      allModuleIds.map((moduleId) => `${traineeId}_${moduleId}`),
    )

    // Group each course's exam lessons by module so the per-module loop stays in-memory.
    const examLessonsByModuleId = new Map()
    for (const courseId of uniqueCourseIds) {
      for (const l of lessonsByCourse.get(courseId) || []) {
        if (l.type !== 'exam' || l.status !== 'published') continue
        const arr = examLessonsByModuleId.get(l.moduleId) || []
        arr.push(l)
        examLessonsByModuleId.set(l.moduleId, arr)
      }
    }

    const courseDetails = allEnrollments.map((enrollment) => {
      const courseId = enrollment.courseId
      const courseTitle = courseTitleMap.get(courseId) || 'Unknown Course'
      const cpDoc = courseProgressById.get(`${traineeId}_${courseId}`)
      const cp = cpDoc?.exists ? cpDoc.data() : null

      const dueDate = enrollment.dueDate ? new Date(enrollment.dueDate) : null
      const isOverdue = dueDate && dueDate < now && enrollment.status === 'active' && cp?.status !== 'completed'
      let effectiveStatus = enrollment.status
      if (isOverdue) effectiveStatus = 'overdue'
      if (cp?.status === 'completed') effectiveStatus = 'completed'

      const modules = (modulesByCourse.get(courseId) || [])
        .filter((m) => m.status === 'published')
        .sort((a, b) => (a.order || 0) - (b.order || 0))

      const moduleDetails = modules.map((mod) => {
        const mpDoc = moduleProgressById.get(`${traineeId}_${mod.id}`)
        const mp = mpDoc?.exists ? mpDoc.data() : null

        let examScore = null
        let examAttempts = 0
        for (const el of examLessonsByModuleId.get(mod.id) || []) {
          if (el.content?.quizId) {
            const quizAttempts = attemptsByQuizId.get(el.content.quizId) || []
            examAttempts = quizAttempts.length
            const scores = quizAttempts.map((a) => a.score).filter((s) => s != null)
            examScore = scores.length > 0 ? Math.max(...scores) : null
          }
        }

        return {
          moduleId: mod.id,
          title: mod.title,
          order: mod.order,
          status: mp?.status || 'locked',
          percentComplete: mp?.percentComplete || 0,
          completedLessons: mp?.completedLessons || 0,
          totalLessons: mp?.totalLessons || 0,
          examScore,
          examAttempts,
        }
      })

      return {
        courseId,
        courseTitle,
        enrollment: serializeValue(enrollment),
        courseProgress: cpDoc?.exists ? serializeDoc(cpDoc) : null,
        status: effectiveStatus,
        modules: moduleDetails,
      }
    })

    const quizIds = [...new Set(attempts.map((a) => a.quizId))]
    // These three reads are independent of each other — issue them together rather
    // than paying three sequential round trips.
    const [quizDocsById, lpSnap, rlSnap] = await Promise.all([
      getDocSnapshotsById(db, 'quizzes', quizIds),
      db.collection('lessonProgress').where('traineeId', '==', traineeId).get(),
      db.collection('reminderLog').where('traineeId', '==', traineeId).get(),
    ])
    const quizNameMap = new Map(quizIds.map((qid) => {
      const qDoc = quizDocsById.get(qid)
      return [qid, qDoc?.exists ? { title: qDoc.data().title, type: qDoc.data().type } : null]
    }))
    const enrichedAttempts = attempts.map((a) => ({
      ...a,
      quizTitle: quizNameMap.get(a.quizId)?.title || 'Unknown',
      quizType: quizNameMap.get(a.quizId)?.type || 'quiz',
    }))

    // Activity timeline
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
    const overdueEnrollments = enSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((en) => en.status === 'active')
      .filter((en) => {
        const dueDate = asDate(en.dueDate)
        return Boolean(dueDate && dueDate < now)
      })
    const courseProgressById = await getDocSnapshotsById(
      db,
      'courseProgress',
      overdueEnrollments.map((en) => `${en.traineeId}_${en.courseId}`),
    )
    const usersById = await getDocSnapshotsById(
      db,
      'users',
      overdueEnrollments.map((en) => en.traineeId),
    )
    const rows = []

    for (const en of overdueEnrollments) {
      const dueDate = asDate(en.dueDate)
      if (!dueDate) continue

      const cpDoc = courseProgressById.get(`${en.traineeId}_${en.courseId}`)
      if (cpDoc?.exists && cpDoc.data().status === 'completed') continue

      const uDoc = usersById.get(en.traineeId)
      const user = uDoc?.exists ? uDoc.data() : {}

      rows.push({
        traineeId: en.traineeId,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || en.traineeId,
        email: user.email || '',
        progress: cpDoc?.exists ? cpDoc.data().percentComplete || 0 : 0,
        currentModuleId: cpDoc?.exists ? cpDoc.data().currentModuleId : null,
        dueDate: serializeValue(en.dueDate),
        daysOverdue: Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24)),
        lastActive: cpDoc?.exists ? serializeValue(cpDoc.data().updatedAt) : null,
        enrollmentId: en.id,
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
    const enrollments = enSnap.docs
      .map((d) => d.data())
      .filter((en) => en.status !== 'withdrawn')
    const usersById = await getDocSnapshotsById(
      db,
      'users',
      enrollments.map((en) => en.traineeId),
    )
    const courseProgressById = await getDocSnapshotsById(
      db,
      'courseProgress',
      enrollments.map((en) => `${en.traineeId}_${en.courseId}`),
    )
    const rows = []

    for (const en of enrollments) {
      const uDoc = usersById.get(en.traineeId)
      const user = uDoc?.exists ? uDoc.data() : {}
      const cpDoc = courseProgressById.get(`${en.traineeId}_${en.courseId}`)
      const cp = cpDoc?.exists ? cpDoc.data() : null
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
    const overdueEnrollments = enSnap.docs
      .map((d) => d.data())
      .filter((en) => en.status === 'active')
      .filter((en) => {
        const dueDate = asDate(en.dueDate)
        return Boolean(dueDate && dueDate < now)
      })
    const courseProgressById = await getDocSnapshotsById(
      db,
      'courseProgress',
      overdueEnrollments.map((en) => `${en.traineeId}_${en.courseId}`),
    )
    const usersById = await getDocSnapshotsById(
      db,
      'users',
      overdueEnrollments.map((en) => en.traineeId),
    )
    const rows = []

    for (const en of overdueEnrollments) {
      const dueDate = asDate(en.dueDate)
      if (!dueDate) continue
      const cpDoc = courseProgressById.get(`${en.traineeId}_${en.courseId}`)
      if (cpDoc?.exists && cpDoc.data().status === 'completed') continue
      const uDoc = usersById.get(en.traineeId)
      const user = uDoc?.exists ? uDoc.data() : {}

      rows.push({
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: user.email || '',
        progress: cpDoc?.exists ? cpDoc.data().percentComplete || 0 : 0,
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
    const attempts = attSnap.docs.map((d) => d.data())
    const quizIds = [...new Set(attempts.map((a) => a.quizId))]
    const quizzesById = await getDocSnapshotsById(db, 'quizzes', quizIds)

    const rows = attempts.map((a) => {
      const qDoc = quizzesById.get(a.quizId)
      const quiz = qDoc?.exists ? qDoc.data() : {}
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
