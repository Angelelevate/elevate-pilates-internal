import dotenv from 'dotenv'
import path from 'path'

const nodeEnv = process.env.NODE_ENV || 'development'

const envFile =
  nodeEnv === 'production'
    ? '.env.production'
    : nodeEnv === 'staging'
      ? '.env.staging'
      : '.env'

dotenv.config({ path: path.resolve(process.cwd(), envFile) })
dotenv.config()

export function getEnv() {
  const port = Number(process.env.PORT) || 3001
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
  const frontendUrl =
    process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173'

  return {
    nodeEnv,
    port,
    clientOrigin,
    frontendUrl,
    firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
    firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    firebaseWebApiKey: process.env.FIREBASE_WEB_API_KEY || '',
    maintenanceMode: process.env.MAINTENANCE_MODE === 'true',
    inviteExpiryDays: Number(process.env.INVITE_EXPIRY_DAYS) || undefined,
    maxVideoUploadBytes:
      Number(process.env.MAX_VIDEO_UPLOAD_BYTES) || undefined,
  }
}
