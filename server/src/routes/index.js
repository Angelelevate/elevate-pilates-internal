import { Router } from 'express'
import { healthRouter } from './health.js'
import { configRouter } from './config.js'
import { authRouter } from './auth.js'
import { invitesRouter } from './invites.js'
import { usersRouter } from './users.js'
import { profileRouter } from './profile.js'
import { cmsRouter } from './cms.js'
import { traineeRouter } from './trainee.js'
import { adminPreviewRouter } from './adminPreview.js'

export const apiRouter = Router()

apiRouter.use(healthRouter)
apiRouter.use('/config', configRouter)
apiRouter.use('/auth', authRouter)
apiRouter.use('/invites', invitesRouter)
apiRouter.use('/users', usersRouter)
apiRouter.use('/profile', profileRouter)
// Trainee routes must be registered before cmsRouter: cms is mounted at '/' and applies
// requireRole('admin') to all paths that hit it first, which would block /my/* otherwise.
apiRouter.use('/my', traineeRouter)
apiRouter.use('/', cmsRouter)
apiRouter.use('/admin', adminPreviewRouter)
