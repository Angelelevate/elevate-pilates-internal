import { getDb } from '../utils/firestoreDb.js'
import { resolveUserProfile } from '../utils/userProfileLookup.js'

/** Blocks trainee API use until `users/{uid}.mustChangePassword` is cleared. */
export async function requireNoForcedPasswordChange(req, res, next) {
  const db = getDb()
  if (!db) return next()
  try {
    const { data, via } = await resolveUserProfile(db, req.user.uid, req.user.email)
    if (data?.mustChangePassword === true) {
      console.info('[auth] blocked: mustChangePassword', {
        method: req.method,
        path: req.originalUrl || req.url,
        uid: req.user.uid,
        email: req.user.email,
        profileMatch: via,
      })
      const err = new Error('Password change required')
      err.status = 403
      err.code = 'MUST_CHANGE_PASSWORD'
      return next(err)
    }
    next()
  } catch (e) {
    next(e)
  }
}
