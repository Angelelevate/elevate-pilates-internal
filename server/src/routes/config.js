import { Router } from 'express'
import { getPublic, getSystem } from '../controllers/configController.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'

export const configRouter = Router()

configRouter.get('/public', getPublic)
configRouter.get('/system', requireAuth, requireRole('admin'), getSystem)
