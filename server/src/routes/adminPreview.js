import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { getDb } from '../utils/firestoreDb.js'
import { serializeDoc } from '../utils/serialize.js'

export const adminPreviewRouter = Router()

adminPreviewRouter.get(
  '/lessons/:lessonId/preview',
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
      const doc = await db.collection('lessons').doc(req.params.lessonId).get()
      if (!doc.exists) {
        const err = new Error('Lesson not found')
        err.status = 404
        throw err
      }
      res.json({ lesson: serializeDoc(doc) })
    } catch (e) {
      next(e)
    }
  },
)
