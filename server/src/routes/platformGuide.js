import path from 'path'
import { Router } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { getDb } from '../utils/firestoreDb.js'
import { serializeDoc } from '../utils/serialize.js'
import { sanitizeReadingHtml } from '../utils/sanitizeReadingHtml.js'
import {
  generateImageWriteSignedUrl,
  getImageSignedUrl,
  verifyUploadedImage,
} from '../services/storage.js'
import { ALLOWED_IMAGE_MIME_TYPES, DEFAULT_MAX_IMAGE_BYTES } from '../utils/constants.js'

const FAQ_COL = 'platformGuideFaq'
const SECTIONS_COL = 'platformGuideSections'

const MAX_Q = 500
const MAX_A = 10000
const MAX_TITLE = 200
const MAX_HTML = 500_000

export const platformGuideRouter = Router()

platformGuideRouter.use(requireAuth, requireRole('admin'))

function dbRequired() {
  const db = getDb()
  if (!db) {
    const err = new Error('Database not configured')
    err.status = 503
    throw err
  }
  return db
}

function safeBasename(fileName, fallback = 'file') {
  return path.basename(String(fileName || fallback)).replace(/[^a-zA-Z0-9._-]/g, '_') || fallback
}

async function nextSortOrder(db, col) {
  const snap = await db.collection(col).orderBy('sortOrder', 'desc').limit(1).get()
  if (snap.empty) return 0
  const v = snap.docs[0].data().sortOrder
  return typeof v === 'number' && !Number.isNaN(v) ? v + 1 : 0
}

function assertFaqQuestion(q) {
  const s = q != null ? String(q).trim() : ''
  if (!s) {
    const err = new Error('Question is required')
    err.status = 400
    throw err
  }
  if (s.length > MAX_Q) {
    const err = new Error(`Question must be at most ${MAX_Q} characters`)
    err.status = 400
    throw err
  }
  return s
}

function assertFaqAnswer(a) {
  const s = a != null ? String(a).trim() : ''
  if (!s) {
    const err = new Error('Answer is required')
    err.status = 400
    throw err
  }
  if (s.length > MAX_A) {
    const err = new Error(`Answer must be at most ${MAX_A} characters`)
    err.status = 400
    throw err
  }
  return s
}

function assertSectionTitle(t) {
  const s = t != null ? String(t).trim() : ''
  if (!s) {
    const err = new Error('Title is required')
    err.status = 400
    throw err
  }
  if (s.length > MAX_TITLE) {
    const err = new Error(`Title must be at most ${MAX_TITLE} characters`)
    err.status = 400
    throw err
  }
  return s
}

function assertSectionHtml(html) {
  const raw = html != null ? String(html) : ''
  if (!raw.trim()) {
    const err = new Error('Content is required')
    err.status = 400
    throw err
  }
  const cleaned = sanitizeReadingHtml(raw)
  if (cleaned.length > MAX_HTML) {
    const err = new Error(`Content is too large (max ${MAX_HTML} characters after sanitizing)`)
    err.status = 400
    throw err
  }
  return cleaned
}

platformGuideRouter.get('/', async (req, res, next) => {
  try {
    const db = dbRequired()
    const [faqSnap, secSnap] = await Promise.all([
      db.collection(FAQ_COL).orderBy('sortOrder', 'asc').get(),
      db.collection(SECTIONS_COL).orderBy('sortOrder', 'asc').get(),
    ])
    res.json({
      faq: faqSnap.docs.map((d) => serializeDoc(d)),
      customSections: secSnap.docs.map((d) => serializeDoc(d)),
    })
  } catch (e) {
    next(e)
  }
})

platformGuideRouter.post('/faq', async (req, res, next) => {
  try {
    const db = dbRequired()
    const question = assertFaqQuestion(req.body?.question)
    const answer = assertFaqAnswer(req.body?.answer)
    let sortOrder = req.body?.sortOrder
    if (sortOrder !== undefined && sortOrder !== null) {
      sortOrder = Number(sortOrder)
      if (!Number.isFinite(sortOrder)) {
        const err = new Error('sortOrder must be a number')
        err.status = 400
        throw err
      }
    } else {
      sortOrder = await nextSortOrder(db, FAQ_COL)
    }
    const ref = await db.collection(FAQ_COL).add({
      question,
      answer,
      sortOrder,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    const doc = await ref.get()
    res.status(201).json(serializeDoc(doc))
  } catch (e) {
    next(e)
  }
})

platformGuideRouter.patch('/faq/:id', async (req, res, next) => {
  try {
    const db = dbRequired()
    const id = String(req.params.id || '').trim()
    if (!id) {
      const err = new Error('Invalid id')
      err.status = 400
      throw err
    }
    const ref = db.collection(FAQ_COL).doc(id)
    const existing = await ref.get()
    if (!existing.exists) {
      const err = new Error('FAQ entry not found')
      err.status = 404
      throw err
    }
    const patch = { updatedAt: FieldValue.serverTimestamp() }
    if (req.body?.question !== undefined) patch.question = assertFaqQuestion(req.body.question)
    if (req.body?.answer !== undefined) patch.answer = assertFaqAnswer(req.body.answer)
    if (req.body?.sortOrder !== undefined) {
      const n = Number(req.body.sortOrder)
      if (!Number.isFinite(n)) {
        const err = new Error('sortOrder must be a number')
        err.status = 400
        throw err
      }
      patch.sortOrder = n
    }
    await ref.update(patch)
    const doc = await ref.get()
    res.json(serializeDoc(doc))
  } catch (e) {
    next(e)
  }
})

platformGuideRouter.delete('/faq/:id', async (req, res, next) => {
  try {
    const db = dbRequired()
    const id = String(req.params.id || '').trim()
    if (!id) {
      const err = new Error('Invalid id')
      err.status = 400
      throw err
    }
    const ref = db.collection(FAQ_COL).doc(id)
    const existing = await ref.get()
    if (!existing.exists) {
      const err = new Error('FAQ entry not found')
      err.status = 404
      throw err
    }
    await ref.delete()
    res.status(204).end()
  } catch (e) {
    next(e)
  }
})

platformGuideRouter.post('/sections', async (req, res, next) => {
  try {
    const db = dbRequired()
    const title = assertSectionTitle(req.body?.title)
    const bodyHtml = assertSectionHtml(req.body?.bodyHtml)
    let sortOrder = req.body?.sortOrder
    if (sortOrder !== undefined && sortOrder !== null) {
      sortOrder = Number(sortOrder)
      if (!Number.isFinite(sortOrder)) {
        const err = new Error('sortOrder must be a number')
        err.status = 400
        throw err
      }
    } else {
      sortOrder = await nextSortOrder(db, SECTIONS_COL)
    }
    const ref = await db.collection(SECTIONS_COL).add({
      title,
      bodyHtml,
      sortOrder,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    const doc = await ref.get()
    res.status(201).json(serializeDoc(doc))
  } catch (e) {
    next(e)
  }
})

platformGuideRouter.patch('/sections/:id', async (req, res, next) => {
  try {
    const db = dbRequired()
    const id = String(req.params.id || '').trim()
    if (!id) {
      const err = new Error('Invalid id')
      err.status = 400
      throw err
    }
    const ref = db.collection(SECTIONS_COL).doc(id)
    const existing = await ref.get()
    if (!existing.exists) {
      const err = new Error('Section not found')
      err.status = 404
      throw err
    }
    const patch = { updatedAt: FieldValue.serverTimestamp() }
    if (req.body?.title !== undefined) patch.title = assertSectionTitle(req.body.title)
    if (req.body?.bodyHtml !== undefined) patch.bodyHtml = assertSectionHtml(req.body.bodyHtml)
    if (req.body?.sortOrder !== undefined) {
      const n = Number(req.body.sortOrder)
      if (!Number.isFinite(n)) {
        const err = new Error('sortOrder must be a number')
        err.status = 400
        throw err
      }
      patch.sortOrder = n
    }
    await ref.update(patch)
    const doc = await ref.get()
    res.json(serializeDoc(doc))
  } catch (e) {
    next(e)
  }
})

platformGuideRouter.delete('/sections/:id', async (req, res, next) => {
  try {
    const db = dbRequired()
    const id = String(req.params.id || '').trim()
    if (!id) {
      const err = new Error('Invalid id')
      err.status = 400
      throw err
    }
    const ref = db.collection(SECTIONS_COL).doc(id)
    const existing = await ref.get()
    if (!existing.exists) {
      const err = new Error('Section not found')
      err.status = 404
      throw err
    }
    await ref.delete()
    res.status(204).end()
  } catch (e) {
    next(e)
  }
})

platformGuideRouter.post('/image-upload-session', async (req, res, next) => {
  try {
    dbRequired()
    const { fileName, contentType, fileSize } = req.body || {}
    const maxBytes = DEFAULT_MAX_IMAGE_BYTES
    if (fileSize == null || Number.isNaN(Number(fileSize))) {
      const err = new Error('fileSize is required')
      err.status = 400
      throw err
    }
    const size = Number(fileSize)
    if (size < 1) {
      const err = new Error('Invalid file size')
      err.status = 400
      throw err
    }
    if (size > maxBytes) {
      const err = new Error(
        `Image is too large. Maximum size is ${Math.round(maxBytes / (1024 * 1024))} MB.`,
      )
      err.status = 400
      throw err
    }
    const mime = String(contentType || '').trim().toLowerCase()
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(mime)) {
      const err = new Error('Unsupported image type')
      err.status = 400
      throw err
    }
    const uid = String(req.user?.uid || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '')
    const safeName = safeBasename(fileName, 'image')
    const destPath = `platform-guide-images/editor/${uid}/${Date.now()}-${safeName}`
    const { url, contentType: ct, expiresInSeconds } = await generateImageWriteSignedUrl(
      destPath,
      mime,
    )
    res.json({
      uploadUrl: url,
      storagePath: destPath,
      contentType: ct,
      maxBytes,
      expiresInSeconds,
    })
  } catch (e) {
    next(e)
  }
})

platformGuideRouter.post('/image-upload-complete', async (req, res, next) => {
  try {
    const uid = String(req.user?.uid || '').replace(/[^a-zA-Z0-9_-]/g, '')
    const { storagePath } = req.body || {}
    if (!storagePath || typeof storagePath !== 'string') {
      const err = new Error('storagePath is required')
      err.status = 400
      throw err
    }
    const prefix = `platform-guide-images/editor/${uid}/`
    if (!storagePath.startsWith(prefix)) {
      const err = new Error('Invalid storage path')
      err.status = 400
      throw err
    }
    await verifyUploadedImage(storagePath, DEFAULT_MAX_IMAGE_BYTES)
    const imageUrl = await getImageSignedUrl(storagePath)
    res.json({ imageUrl, storagePath })
  } catch (e) {
    next(e)
  }
})
