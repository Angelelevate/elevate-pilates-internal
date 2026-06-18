import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { getEnv } from './config/env.js'
import { initFirebaseAdmin } from './config/firebase.js'
import { apiLimiter } from './middleware/rateLimiter.js'
import { apiRouter } from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'

export function createApp() {
  initFirebaseAdmin()

  const { clientOrigin, nodeEnv } = getEnv()
  const corsOrigins = [
    clientOrigin,
    'https://elevate-pilates-angel.vercel.app',
  ]
  const app = express()

  app.use(helmet())
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  )
  app.use(morgan(nodeEnv === 'development' ? 'dev' : 'combined'))
  app.use(express.json())

  app.use('/api', apiLimiter, apiRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
