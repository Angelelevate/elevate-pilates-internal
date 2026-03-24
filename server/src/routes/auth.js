import { Router } from 'express'
import { requireAuth } from '../middleware/authMiddleware.js'
import { getDb } from '../utils/firestoreDb.js'
import { validatePasswordAgainstPolicy } from '../utils/passwordPolicy.js'
import { getPublicConfig } from '../services/configService.js'
import { serializeDoc } from '../utils/serialize.js'

export const authRouter = Router()

authRouter.post('/verify-token', requireAuth, async (req, res, next) => {
  try {
    const db = getDb()
    if (!db) {
      const err = new Error('Database not configured')
      err.status = 503
      throw err
    }
    const snap = await db.collection('users').doc(req.user.uid).get()
    const profile = serializeDoc(snap)
    res.json({
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role,
      profile,
    })
  } catch (e) {
    next(e)
  }
})

authRouter.post('/validate-password', (req, res) => {
  const password = req.body?.password
  const policy = getPublicConfig().passwordPolicy
  const result = validatePasswordAgainstPolicy(password, policy)
  res.json(result)
})
