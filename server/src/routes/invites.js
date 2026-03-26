import { Router } from 'express'
import admin from 'firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getEnv } from '../config/env.js'
import { getFirebaseAdmin } from '../config/firebase.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { sendInviteEmail } from '../services/inviteEmail.js'
import {
  DEFAULT_INVITE_EXPIRY_DAYS,
} from '../utils/constants.js'
import { getDb } from '../utils/firestoreDb.js'
import { validatePasswordAgainstPolicy } from '../utils/passwordPolicy.js'
import { getPublicConfig } from '../services/configService.js'
import { serializeDoc } from '../utils/serialize.js'
import { normalizeOptionalPhone, normalizePersonName } from '../utils/userFields.js'

export const invitesRouter = Router()

function inviteExpiryDate() {
  const { inviteExpiryDays } = getEnv()
  const days = inviteExpiryDays ?? DEFAULT_INVITE_EXPIRY_DAYS
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

invitesRouter.get('/validate/:token', async (req, res, next) => {
  try {
    const db = getDb()
    if (!db) {
      const err = new Error('Database not configured')
      err.status = 503
      throw err
    }
    const token = req.params.token
    const q = await db
      .collection('invites')
      .where('token', '==', token)
      .limit(1)
      .get()
    if (q.empty) {
      return res.json({ valid: false, email: null, expired: false })
    }
    const doc = q.docs[0]
    const data = doc.data()
    const now = new Date()
    const expiresAt = data.expiresAt?.toDate?.() ?? new Date(0)
    const expired = now > expiresAt
    const valid =
      data.status === 'pending' && !expired
    res.json({
      valid,
      email: data.email,
      expired: data.status === 'pending' && expired,
    })
  } catch (e) {
    next(e)
  }
})

invitesRouter.post('/accept', async (req, res, next) => {
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

    const {
      token,
      firstName,
      lastName,
      phone,
      password,
    } = req.body || {}

    if (!token || !password) {
      const err = new Error('Missing required fields')
      err.status = 400
      throw err
    }
    let fn
    let ln
    let phoneNorm = null
    try {
      fn = normalizePersonName(firstName, 'First name')
      ln = normalizePersonName(lastName, 'Last name')
      phoneNorm = normalizeOptionalPhone(phone)
    } catch (e) {
      return next(e)
    }

    const policy = getPublicConfig().passwordPolicy
    const pw = validatePasswordAgainstPolicy(password, policy)
    if (!pw.valid) {
      const err = new Error('Password does not meet policy')
      err.status = 400
      err.details = pw.failures
      throw err
    }

    const q = await db
      .collection('invites')
      .where('token', '==', token)
      .limit(1)
      .get()
    if (q.empty) {
      const err = new Error('Invalid invite')
      err.status = 400
      throw err
    }
    const inviteRef = q.docs[0].ref
    const invite = q.docs[0].data()
    const now = new Date()
    const expiresAt = invite.expiresAt?.toDate?.() ?? new Date(0)
    if (invite.status !== 'pending') {
      const err = new Error('Invite is no longer valid')
      err.status = 400
      throw err
    }
    if (now > expiresAt) {
      await inviteRef.update({
        status: 'expired',
        updatedAt: FieldValue.serverTimestamp(),
      })
      const err = new Error('Invite has expired')
      err.status = 400
      throw err
    }

    const email = String(invite.email).toLowerCase().trim()
    let userRecord
    try {
      userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: `${fn} ${ln}`.trim(),
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

    const batch = db.batch()
    const userRef = db.collection('users').doc(userRecord.uid)
    batch.set(userRef, {
      uid: userRecord.uid,
      email,
      firstName: fn,
      lastName: ln,
      phone: phoneNorm,
      role: 'trainee',
      status: 'active',
      inviteId: inviteRef.id,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    batch.update(inviteRef, {
      status: 'accepted',
      acceptedBy: userRecord.uid,
      updatedAt: FieldValue.serverTimestamp(),
    })
    await batch.commit()

    if (invite.courseId) {
      const courseSnap = await db.collection('courses').doc(invite.courseId).get()
      if (courseSnap.exists) {
        const course = courseSnap.data()
        const due =
          course.dueDate instanceof Timestamp
            ? course.dueDate
            : course.dueDate || null
        const enRef = db.collection('enrollments').doc()
        await enRef.set({
          courseId: invite.courseId,
          traineeId: userRecord.uid,
          status: 'active',
          dueDate: due,
          enrolledBy: invite.invitedBy || null,
          enrolledAt: FieldValue.serverTimestamp(),
          completedAt: null,
          updatedAt: FieldValue.serverTimestamp(),
        })
      }
    }

    res.json({
      uid: userRecord.uid,
      email: userRecord.email,
    })
  } catch (e) {
    if (e.details) {
      return res.status(e.status || 400).json({
        error: e.message,
        failures: e.details,
      })
    }
    next(e)
  }
})

invitesRouter.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const db = getDb()
    if (!db) {
      const err = new Error('Database not configured')
      err.status = 503
      throw err
    }
    const email = String(req.body?.email || '')
      .toLowerCase()
      .trim()
    const name = req.body?.name ? String(req.body.name).trim() : null
    const courseId = req.body?.courseId ? String(req.body.courseId).trim() : null
    if (!email) {
      const err = new Error('Email is required')
      err.status = 400
      throw err
    }

    if (courseId) {
      const c = await db.collection('courses').doc(courseId).get()
      if (!c.exists) {
        const err = new Error('Course not found')
        err.status = 400
        throw err
      }
    }

    const token = crypto.randomUUID()
    const ref = db.collection('invites').doc()
    await ref.set({
      email,
      name,
      token,
      status: 'pending',
      invitedBy: req.user.uid,
      courseId: courseId || null,
      acceptedBy: null,
      expiresAt: Timestamp.fromDate(inviteExpiryDate()),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    await sendInviteEmail({ to: email, token, name })

    const created = await ref.get()
    res.status(201).json(serializeDoc(created))
  } catch (e) {
    next(e)
  }
})

invitesRouter.get('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const db = getDb()
    if (!db) {
      const err = new Error('Database not configured')
      err.status = 503
      throw err
    }
    const status = req.query.status ? String(req.query.status) : null
    const snap = await db.collection('invites').limit(500).get()
    let rows = snap.docs.map((d) => serializeDoc(d))
    rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    if (status) rows = rows.filter((r) => r.status === status)
    res.json(rows.slice(0, 200))
  } catch (e) {
    next(e)
  }
})

invitesRouter.post(
  '/:inviteId/resend',
  requireAuth,
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const db = getDb()
      if (!db) {
        const err = new Error('Database not configured')
        err.status = 503
        throw err
      }
      const ref = db.collection('invites').doc(req.params.inviteId)
      const doc = await ref.get()
      if (!doc.exists) {
        const err = new Error('Invite not found')
        err.status = 404
        throw err
      }
      const data = doc.data()
      if (data.status === 'accepted') {
        const err = new Error('Cannot resend an accepted invite')
        err.status = 400
        throw err
      }
      const token = crypto.randomUUID()
      await ref.update({
        token,
        status: 'pending',
        expiresAt: Timestamp.fromDate(inviteExpiryDate()),
        updatedAt: FieldValue.serverTimestamp(),
      })
      await sendInviteEmail({ to: data.email, token, name: data.name })
      const nextDoc = await ref.get()
      res.json(serializeDoc(nextDoc))
    } catch (e) {
      next(e)
    }
  },
)

invitesRouter.delete(
  '/:inviteId',
  requireAuth,
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const db = getDb()
      if (!db) {
        const err = new Error('Database not configured')
        err.status = 503
        throw err
      }
      const ref = db.collection('invites').doc(req.params.inviteId)
      const doc = await ref.get()
      if (!doc.exists) {
        const err = new Error('Invite not found')
        err.status = 404
        throw err
      }
      if (doc.data().status !== 'pending') {
        const err = new Error('Only pending invites can be cancelled')
        err.status = 400
        throw err
      }
      await ref.delete()
      res.status(204).send()
    } catch (e) {
      next(e)
    }
  },
)
