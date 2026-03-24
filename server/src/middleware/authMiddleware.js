import admin from 'firebase-admin'
import { getFirebaseAdmin } from '../config/firebase.js'
import { getDb } from '../utils/firestoreDb.js'
import { resolveUserProfile } from '../utils/userProfileLookup.js'

/** Lowercase trim for stable requireRole() checks. */
export function normalizeAppRole(value) {
  if (value == null || value === '') return null
  return String(value).trim().toLowerCase()
}

export async function requireAuth(req, res, next) {
  if (!getFirebaseAdmin()) {
    const err = new Error('Firebase Admin is not configured')
    err.status = 503
    return next(err)
  }

  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    const err = new Error('Unauthorized')
    err.status = 401
    return next(err)
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token)
    // Role from Firestore (users/{uid} or same email if doc id ever drifted from Auth uid).
    // JWT custom claims are only a fallback when there is no matching profile row.
    let role = null
    let roleSource = 'none'
    const db = getDb()
    if (db) {
      try {
        const { data: profile, via } = await resolveUserProfile(
          db,
          decoded.uid,
          decoded.email,
        )
        if (profile) {
          role = normalizeAppRole(profile.role)
          if (role) roleSource = via === 'email' ? 'firestore-email' : 'firestore-uid'
        }
      } catch (e) {
        console.warn(
          '[auth] Firestore role lookup failed',
          { uid: decoded.uid, email: decoded.email, err: e?.message || String(e) },
        )
      }
    } else {
      console.warn('[auth] getDb() unavailable; role will use JWT only if present', {
        uid: decoded.uid,
      })
    }
    if (!role) {
      role = normalizeAppRole(decoded.role)
      if (role) roleSource = 'jwt'
    }
    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      role,
    }
    req.decodedToken = decoded
    const authDebug =
      process.env.AUTH_DEBUG === '1' || process.env.AUTH_DEBUG === 'true'
    if (authDebug) {
      console.info('[auth] session', {
        method: req.method,
        path: req.originalUrl || req.url,
        uid: decoded.uid,
        email: decoded.email || null,
        role: role || null,
        roleSource,
      })
    } else if (!role) {
      console.warn('[auth] authenticated but no app role', {
        method: req.method,
        path: req.originalUrl || req.url,
        uid: decoded.uid,
        email: decoded.email || null,
        roleSource,
      })
    }
    next()
  } catch {
    const err = new Error('Unauthorized')
    err.status = 401
    next(err)
  }
}

export function requireRole(role) {
  const expected = normalizeAppRole(role)
  return (req, res, next) => {
    if (!req.user?.role || req.user.role !== expected) {
      console.warn('[auth] Forbidden role mismatch', {
        method: req.method,
        path: req.originalUrl || req.url,
        expected,
        actual: req.user?.role ?? null,
        uid: req.user?.uid ?? null,
        email: req.user?.email ?? null,
      })
      const err = new Error('Forbidden')
      err.status = 403
      return next(err)
    }
    next()
  }
}

/** @deprecated Use requireAuth + requireRole('admin') */
export async function requireAdmin(req, res, next) {
  await requireAuth(req, res, (err) => {
    if (err) return next(err)
    return requireRole('admin')(req, res, next)
  })
}
