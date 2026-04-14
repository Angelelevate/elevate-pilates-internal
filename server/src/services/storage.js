import admin from 'firebase-admin'
import { getFirebaseAdmin } from '../config/firebase.js'
import { ALLOWED_VIDEO_MIME_TYPES, ALLOWED_IMAGE_MIME_TYPES } from '../utils/constants.js'

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Signed PUT URLs for browser → GCS; allow long uploads without server RAM use. */
const VIDEO_WRITE_URL_TTL_MS = 45 * 60 * 1000

const IMAGE_WRITE_URL_TTL_MS = 10 * 60 * 1000
const IMAGE_READ_URL_TTL_MS = 365 * 24 * 60 * 60 * 1000

/**
 * v4 signed URL so the client can PUT the file body directly to the bucket (streaming).
 * Configure Storage CORS on the bucket for your web origin or PUTs from the browser will fail.
 */
export async function generateVideoWriteSignedUrl(destPath, contentType) {
  if (!getFirebaseAdmin()) throw new Error('Firebase Admin is not configured')
  const bucket = admin.storage().bucket()
  const file = bucket.file(destPath)
  const ct = contentType && String(contentType).trim() ? String(contentType).trim() : 'application/octet-stream'
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + VIDEO_WRITE_URL_TTL_MS,
    contentType: ct,
  })
  return { url, contentType: ct, expiresInSeconds: Math.floor(VIDEO_WRITE_URL_TTL_MS / 1000) }
}

/**
 * After the browser PUT completes, confirm the object exists and respects size/type limits.
 */
export async function verifyUploadedLessonVideo(storagePath, maxBytes) {
  if (!getFirebaseAdmin()) throw new Error('Firebase Admin is not configured')
  const bucket = admin.storage().bucket()
  const file = bucket.file(storagePath)
  const [exists] = await file.exists()
  if (!exists) {
    const err = new Error(
      'Upload not found. If the progress bar finished, wait a moment and use Complete upload again, or retry the upload.',
    )
    err.status = 400
    throw err
  }
  const [meta] = await file.getMetadata()
  const size = Number(meta.size)
  if (!Number.isFinite(size) || size < 1) {
    const err = new Error('Uploaded file is empty or invalid')
    err.status = 400
    throw err
  }
  if (size > maxBytes) {
    await deleteStorageFile(storagePath)
    const err = new Error(
      `Video is too large. Maximum size is ${Math.round(maxBytes / (1024 * 1024))} MB.`,
    )
    err.status = 400
    throw err
  }
  const rawMime = String(meta.contentType || '')
  const mime = rawMime.split(';')[0].trim().toLowerCase()
  if (!ALLOWED_VIDEO_MIME_TYPES.includes(mime)) {
    await deleteStorageFile(storagePath)
    const err = new Error('Unsupported video type')
    err.status = 400
    throw err
  }
  return { mime }
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

export async function deleteStoragePrefix(prefix) {
  if (!getFirebaseAdmin() || !prefix) return
  const bucket = admin.storage().bucket()
  try {
    await bucket.deleteFiles({ prefix, force: true })
  } catch {
    // best-effort cleanup
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

export async function generateImageWriteSignedUrl(destPath, contentType) {
  if (!getFirebaseAdmin()) throw new Error('Firebase Admin is not configured')
  const bucket = admin.storage().bucket()
  const file = bucket.file(destPath)
  const ct = contentType && String(contentType).trim() ? String(contentType).trim() : 'application/octet-stream'
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + IMAGE_WRITE_URL_TTL_MS,
    contentType: ct,
  })
  return { url, contentType: ct, expiresInSeconds: Math.floor(IMAGE_WRITE_URL_TTL_MS / 1000) }
}

export async function verifyUploadedImage(storagePath, maxBytes) {
  if (!getFirebaseAdmin()) throw new Error('Firebase Admin is not configured')
  const bucket = admin.storage().bucket()
  const file = bucket.file(storagePath)
  const [exists] = await file.exists()
  if (!exists) {
    const err = new Error('Upload not found. Please try again.')
    err.status = 400
    throw err
  }
  const [meta] = await file.getMetadata()
  const size = Number(meta.size)
  if (!Number.isFinite(size) || size < 1) {
    const err = new Error('Uploaded file is empty or invalid')
    err.status = 400
    throw err
  }
  if (size > maxBytes) {
    await deleteStorageFile(storagePath)
    const err = new Error(`Image is too large. Maximum size is ${Math.round(maxBytes / (1024 * 1024))} MB.`)
    err.status = 400
    throw err
  }
  const rawMime = String(meta.contentType || '')
  const mime = rawMime.split(';')[0].trim().toLowerCase()
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(mime)) {
    await deleteStorageFile(storagePath)
    const err = new Error('Unsupported image type')
    err.status = 400
    throw err
  }
  return { mime }
}

export async function getImageSignedUrl(storagePath) {
  if (!getFirebaseAdmin()) throw new Error('Firebase Admin is not configured')
  const bucket = admin.storage().bucket()
  const [url] = await bucket.file(storagePath).getSignedUrl({
    action: 'read',
    expires: Date.now() + IMAGE_READ_URL_TTL_MS,
  })
  return url
}
