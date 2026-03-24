import { Router } from 'express'
import admin from 'firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getFirebaseAdmin } from '../config/firebase.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { getPublicConfig } from '../services/configService.js'
import { getDb } from '../utils/firestoreDb.js'
import {
  generateRandomPasswordAgainstPolicy,
  validatePasswordAgainstPolicy,
} from '../utils/passwordPolicy.js'
import { serializeDoc } from '../utils/serialize.js'

/**
 * @param {Record<string, unknown>} user serialized user row
 * @param {Map<string, ReturnType<typeof serializeDoc>>} invitesById
 */
function deriveTraineeOnboarding(user, invitesById) {
  const createdByAdmin = Boolean(user.createdBy) && !user.inviteId
  if (createdByAdmin) {
    return {
      source: 'admin',
      inviteStatus: null,
      label: 'Admin provisioned',
      accountReady: true,
    }
  }
  if (user.inviteId && invitesById.has(user.inviteId)) {
    const inv = invitesById.get(user.inviteId)
    const st = inv?.status
    return {
      source: 'invite',
      inviteStatus: st || null,
      label:
        st === 'accepted'
          ? 'Invite completed'
          : st === 'pending'
            ? 'Invite pending'
            : st === 'expired'
              ? 'Invite expired'
              : 'Invite',
      accountReady: true,
    }
  }
  const acceptedInvite = [...invitesById.values()].find((inv) => inv?.acceptedBy === user.uid)
  if (acceptedInvite) {
    return {
      source: 'invite',
      inviteStatus: 'accepted',
      label: 'Invite completed',
      accountReady: true,
    }
  }
  return {
    source: 'unknown',
    inviteStatus: null,
    label: 'Account active',
    accountReady: true,
  }
}

async function enrichUsersForAdminList(db, rows) {
  const [invitesSnap, enSnap, courseSnap] = await Promise.all([
    db.collection('invites').limit(500).get(),
    db.collection('enrollments').limit(2000).get(),
    db.collection('courses').limit(200).get(),
  ])
  const invitesById = new Map(invitesSnap.docs.map((d) => [d.id, serializeDoc(d)]))
  const courseTitleById = new Map(
    courseSnap.docs.map((d) => [d.id, String(d.data()?.title || 'Untitled')]),
  )
  /** @type {Map<string, Array<Record<string, unknown>>>} */
  const enrollmentsByTrainee = new Map()
  for (const d of enSnap.docs) {
    const en = serializeDoc(d)
    const tid = en?.traineeId
    if (!tid) continue
    const list = enrollmentsByTrainee.get(tid) || []
    list.push({
      ...en,
      courseTitle: courseTitleById.get(en.courseId) || 'Course',
    })
    enrollmentsByTrainee.set(tid, list)
  }

  return rows.map((u) => {
    if (u.role !== 'trainee') {
      return { ...u, onboarding: null, enrollments: [] }
    }
    const enrollments = enrollmentsByTrainee.get(u.uid) || []
    const onboarding = deriveTraineeOnboarding(u, invitesById)
    return { ...u, onboarding, enrollments }
  })
}

export const usersRouter = Router()

usersRouter.use(requireAuth, requireRole('admin'))

usersRouter.post('/trainees', async (req, res, next) => {
  try {
    if (!getFirebaseAdmin()) {
      const err = new Error('Firebase Admin is not configured')
      err.status = 503
      throw err
    }
    const db = getDb()
    if (!db) {
      const err = new Error('Database not configured')
      err.status = 503
      throw err
    }

    const email = String(req.body?.email || '')
      .toLowerCase()
      .trim()
    const firstName = String(req.body?.firstName || '').trim()
    const lastName = String(req.body?.lastName || '').trim()
    const phone = req.body?.phone ? String(req.body.phone).trim() : null
    const courseId = req.body?.courseId ? String(req.body.courseId).trim() : null
    let temporaryPassword = req.body?.temporaryPassword

    if (!email || !firstName || !lastName) {
      const err = new Error('Email, first name, and last name are required')
      err.status = 400
      throw err
    }

    const policy = getPublicConfig().passwordPolicy
    let passwordGenerated = false
    let password
    if (
      temporaryPassword === undefined ||
      temporaryPassword === null ||
      String(temporaryPassword).trim() === ''
    ) {
      password = generateRandomPasswordAgainstPolicy(policy)
      passwordGenerated = true
    } else {
      password = String(temporaryPassword)
      const pw = validatePasswordAgainstPolicy(password, policy)
      if (!pw.valid) {
        const err = new Error('Password does not meet policy')
        err.status = 400
        err.failures = pw.failures
        throw err
      }
    }

    if (courseId) {
      const c = await db.collection('courses').doc(courseId).get()
      if (!c.exists) {
        const err = new Error('Course not found')
        err.status = 400
        throw err
      }
    }

    let userRecord
    try {
      userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: `${firstName} ${lastName}`.trim(),
        disabled: false,
      })
    } catch (e) {
      if (e.code === 'auth/email-already-exists') {
        const err = new Error('An account already exists for this email')
        err.status = 409
        throw err
      }
      throw e
    }

    await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'trainee' })

    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      firstName,
      lastName,
      phone,
      role: 'trainee',
      status: 'active',
      mustChangePassword: true,
      createdBy: req.user.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    if (courseId) {
      const courseSnap = await db.collection('courses').doc(courseId).get()
      if (courseSnap.exists) {
        const course = courseSnap.data()
        const due =
          course.dueDate instanceof Timestamp
            ? course.dueDate
            : course.dueDate || null
        const enRef = db.collection('enrollments').doc()
        await enRef.set({
          courseId,
          traineeId: userRecord.uid,
          status: 'active',
          dueDate: due,
          enrolledBy: req.user.uid,
          enrolledAt: FieldValue.serverTimestamp(),
          completedAt: null,
          updatedAt: FieldValue.serverTimestamp(),
        })
      }
    }

    res.status(201).json({
      uid: userRecord.uid,
      email: userRecord.email,
      ...(passwordGenerated ? { temporaryPassword: password } : {}),
    })
  } catch (e) {
    if (e.failures) {
      return res.status(e.status || 400).json({
        error: e.message,
        failures: e.failures,
      })
    }
    next(e)
  }
})

usersRouter.get('/', async (req, res, next) => {
  try {
    const db = getDb()
    if (!db) {
      const err = new Error('Database not configured')
      err.status = 503
      throw err
    }
    const search = req.query.search
      ? String(req.query.search).toLowerCase().trim()
      : ''
    const snap = await db.collection('users').limit(500).get()
    let rows = snap.docs.map((d) => serializeDoc(d))
    if (search) {
      rows = rows.filter((u) => {
        const hay = `${u.email} ${u.firstName} ${u.lastName}`.toLowerCase()
        return hay.includes(search)
      })
    }
    const withAuth = await Promise.all(
      rows.map(async (u) => {
        try {
          const ar = await admin.auth().getUser(u.uid)
          return {
            ...u,
            authDisabled: ar.disabled,
          }
        } catch {
          return { ...u, authDisabled: false }
        }
      }),
    )
    const enriched = await enrichUsersForAdminList(db, withAuth)
    res.json(enriched)
  } catch (e) {
    next(e)
  }
})

usersRouter.get('/:uid', async (req, res, next) => {
  try {
    const db = getDb()
    if (!db) {
      const err = new Error('Database not configured')
      err.status = 503
      throw err
    }
    const doc = await db.collection('users').doc(req.params.uid).get()
    if (!doc.exists) {
      const err = new Error('User not found')
      err.status = 404
      throw err
    }
    let authDisabled = false
    try {
      const ar = await admin.auth().getUser(req.params.uid)
      authDisabled = ar.disabled
    } catch {
      authDisabled = false
    }
    res.json({ ...serializeDoc(doc), authDisabled })
  } catch (e) {
    next(e)
  }
})

usersRouter.patch('/:uid/status', async (req, res, next) => {
  try {
    const db = getDb()
    if (!db) {
      const err = new Error('Database not configured')
      err.status = 503
      throw err
    }
    const status = req.body?.status
    if (status !== 'active' && status !== 'disabled') {
      const err = new Error('Invalid status')
      err.status = 400
      throw err
    }
    const uid = req.params.uid
    const userDoc = await db.collection('users').doc(uid).get()
    if (!userDoc.exists) {
      const err = new Error('User not found')
      err.status = 404
      throw err
    }
    const data = userDoc.data()
    if (data.role === 'admin') {
      const err = new Error('Cannot change admin account status here')
      err.status = 400
      throw err
    }
    await admin.auth().updateUser(uid, { disabled: status === 'disabled' })
    await db.collection('users').doc(uid).update({
      status,
      updatedAt: FieldValue.serverTimestamp(),
    })
    res.json({ ok: true, status })
  } catch (e) {
    next(e)
  }
})
