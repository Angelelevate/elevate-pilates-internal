import admin from 'firebase-admin'
import { getFirebaseAdmin } from '../config/firebase.js'

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000

export async function uploadVideoBuffer({
  destPath,
  buffer,
  contentType,
}) {
  if (!getFirebaseAdmin()) throw new Error('Firebase Admin is not configured')
  const bucket = admin.storage().bucket()
  console.log('[storage] uploading to bucket:', bucket.name)
  console.log('[storage] destPath:', destPath)
  console.log('[storage] buffer size:', buffer.length, 'bytes')
  console.log('[storage] contentType:', contentType || 'video/mp4')
  const file = bucket.file(destPath)
  await file.save(buffer, {
    metadata: { contentType: contentType || 'video/mp4' },
  })
  console.log('[storage] upload complete:', destPath)
  return destPath
}

export async function deleteStorageFile(storagePath) {
  if (!getFirebaseAdmin() || !storagePath) return
  const bucket = admin.storage().bucket()
  try {
    await bucket.file(storagePath).delete({ ignoreNotFound: true })
  } catch {
    // ignore
  }
}

export async function getVideoSignedUrl(storagePath, expiresMs = DEFAULT_TTL_MS) {
  if (!getFirebaseAdmin()) throw new Error('Firebase Admin is not configured')
  const bucket = admin.storage().bucket()
  const [url] = await bucket.file(storagePath).getSignedUrl({
    action: 'read',
    expires: Date.now() + expiresMs,
  })
  return url
}
