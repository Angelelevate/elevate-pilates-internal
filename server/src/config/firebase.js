import fs from 'fs'
import path from 'path'
import admin from 'firebase-admin'
import { getEnv } from './env.js'

let initialized = false

export function initFirebaseAdmin() {
  if (initialized) return admin.app()

  const { firebaseServiceAccountPath, firebaseStorageBucket } = getEnv()
  if (!firebaseServiceAccountPath) {
    return null
  }

  const resolved = path.isAbsolute(firebaseServiceAccountPath)
    ? firebaseServiceAccountPath
    : path.resolve(process.cwd(), firebaseServiceAccountPath)

  if (!fs.existsSync(resolved)) {
    console.warn(
      `[firebase] FIREBASE_SERVICE_ACCOUNT_PATH not found: ${resolved}`,
    )
    return null
  }

  const serviceAccount = JSON.parse(fs.readFileSync(resolved, 'utf8'))
  const storageBucket =
    firebaseStorageBucket.trim() ||
    (serviceAccount.project_id
      ? `${serviceAccount.project_id}.appspot.com`
      : '')
  if (!storageBucket) {
    console.warn(
      '[firebase] No storage bucket: set FIREBASE_STORAGE_BUCKET or ensure service account has project_id',
    )
  }
  console.log('[firebase] project_id:', serviceAccount.project_id)
  console.log('[firebase] storageBucket:', storageBucket || '(none)')
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    ...(storageBucket ? { storageBucket } : {}),
  })
  initialized = true
  console.log('[firebase] Admin SDK initialized')
  return admin.app()
}

export function getFirebaseAdmin() {
  if (!initialized) return null
  try {
    return admin.app()
  } catch {
    return null
  }
}
