import { Router } from 'express'
import admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { getEnv } from '../config/env.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { getDb } from '../utils/firestoreDb.js'
import { validatePasswordAgainstPolicy } from '../utils/passwordPolicy.js'
import { getPublicConfig } from '../services/configService.js'
import { serializeDoc } from '../utils/serialize.js'

export const profileRouter = Router()

profileRouter.use(requireAuth)

profileRouter.get('/', async (req, res, next) => {
  try {
    const db = getDb()
    if (!db) {
      const err = new Error('Database not configured')
      err.status = 503
      throw err
    }
    const doc = await db.collection('users').doc(req.user.uid).get()
    if (!doc.exists) {
      return res.json({
        uid: req.user.uid,
        email: req.user.email,
        role: req.user.role,
        profile: null,
      })
    }
    res.json({
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role,
      profile: serializeDoc(doc),
    })
  } catch (e) {
    next(e)
  }
})

profileRouter.patch('/', async (req, res, next) => {
  try {
    const db = getDb()
    if (!db) {
      const err = new Error('Database not configured')
      err.status = 503
      throw err
    }
    const ref = db.collection('users').doc(req.user.uid)
    const doc = await ref.get()
    if (!doc.exists) {
      const err = new Error('Profile not found')
      err.status = 404
      throw err
    }
    if (doc.data().mustChangePassword === true) {
      const err = new Error('Change your password before updating your profile')
      err.status = 403
      err.code = 'MUST_CHANGE_PASSWORD'
      throw err
    }
    const firstName =
      req.body?.firstName !== undefined
        ? String(req.body.firstName).trim()
        : undefined
    const lastName =
      req.body?.lastName !== undefined
        ? String(req.body.lastName).trim()
        : undefined
    const phone =
      req.body?.phone !== undefined
        ? req.body.phone
          ? String(req.body.phone).trim()
          : null
        : undefined
    const patch = { updatedAt: FieldValue.serverTimestamp() }
    if (firstName !== undefined) patch.firstName = firstName
    if (lastName !== undefined) patch.lastName = lastName
    if (phone !== undefined) patch.phone = phone
    await ref.update(patch)
    const nextDoc = await ref.get()
    res.json(serializeDoc(nextDoc))
  } catch (e) {
    next(e)
  }
})

profileRouter.post('/change-password', async (req, res, next) => {
  try {
    const db = getDb()
    if (!db) {
      const err = new Error('Database not configured')
      err.status = 503
      throw err
    }
    const { firebaseWebApiKey } = getEnv()
    if (!firebaseWebApiKey) {
      const err = new Error(
        'Password change is not configured (set FIREBASE_WEB_API_KEY on the server)',
      )
      err.status = 503
      throw err
    }
    const currentPassword = req.body?.currentPassword
    const newPassword = req.body?.newPassword
    if (!currentPassword || !newPassword) {
      const err = new Error('currentPassword and newPassword are required')
      err.status = 400
      throw err
    }
    const policy = getPublicConfig().passwordPolicy
    const pw = validatePasswordAgainstPolicy(newPassword, policy)
    if (!pw.valid) {
      const err = new Error('Password does not meet policy')
      err.status = 400
      err.failures = pw.failures
      throw err
    }
    const email = req.user.email
    if (!email) {
      const err = new Error('Email not available on token')
      err.status = 400
      throw err
    }
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseWebApiKey}`
    const signInRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: currentPassword,
        returnSecureToken: true,
      }),
    })
    const signInJson = await signInRes.json()
    if (!signInRes.ok) {
      const err = new Error(signInJson.error?.message || 'Current password is incorrect')
      err.status = 401
      throw err
    }
    await admin.auth().updateUser(req.user.uid, { password: newPassword })
    const ref = db.collection('users').doc(req.user.uid)
    const udoc = await ref.get()
    if (udoc.exists) {
      await ref.update({
        mustChangePassword: false,
        updatedAt: FieldValue.serverTimestamp(),
      })
    }
    res.json({ ok: true })
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
