import path from 'path'
import { Router } from 'express'
import multer from 'multer'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getEnv } from '../config/env.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import {
  setCourseTreeStatus,
  validateCourseForPublish,
} from '../services/cmsValidation.js'
import { deleteStorageFile, getVideoSignedUrl, uploadVideoBuffer } from '../services/storage.js'
import {
  ALLOWED_VIDEO_MIME_TYPES,
  DEFAULT_MAX_VIDEO_BYTES,
} from '../utils/constants.js'
import { getDb } from '../utils/firestoreDb.js'
import { sanitizeReadingHtml } from '../utils/sanitizeReadingHtml.js'
import { serializeDoc } from '../utils/serialize.js'
import {
  assertCourseDescriptionLength,
  assertCourseTextLimits,
  assertCourseTitleLength,
} from '../utils/cmsLimits.js'

export const cmsRouter = Router()

cmsRouter.use(requireAuth, requireRole('admin'))

function dbRequired() {
  const db = getDb()
  if (!db) {
    const err = new Error('Database not configured')
    err.status = 503
    throw err
  }
  return db
}

function assertDueDateNotInPast(isoOrTimestamp) {
  if (!isoOrTimestamp) return
  const d = new Date(
    typeof isoOrTimestamp === 'string' || typeof isoOrTimestamp === 'number'
      ? isoOrTimestamp
      : isoOrTimestamp.toDate?.() ?? isoOrTimestamp,
  )
  if (Number.isNaN(d.getTime())) {
    const err = new Error('Invalid due date')
    err.status = 400
    throw err
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const cmp = new Date(d)
  cmp.setHours(0, 0, 0, 0)
  if (cmp < today) {
    const err = new Error('Due date cannot be in the past')
    err.status = 400
    throw err
  }
}

function makeUpload() {
  const { maxVideoUploadBytes } = getEnv()
  const maxBytes = maxVideoUploadBytes ?? DEFAULT_MAX_VIDEO_BYTES
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes },
    fileFilter: (req, file, cb) => {
      if (ALLOWED_VIDEO_MIME_TYPES.includes(file.mimetype)) cb(null, true)
      else cb(new Error('Unsupported video type'))
    },
  })
}

const uploadVideo = makeUpload()

cmsRouter.post('/courses', async (req, res, next) => {
  try {
    const db = dbRequired()
    const { title, description, thumbnailUrl, dueDate } = req.body || {}
    if (!title || !description) {
      const err = new Error('title and description are required')
      err.status = 400
      throw err
    }
    assertCourseTextLimits(title, description)
    const tNorm = String(title).trim().toLowerCase()
    const dNorm = String(description).trim().toLowerCase()
    const existingSnap = await db.collection('courses').limit(400).get()
    for (const d of existingSnap.docs) {
      const row = d.data()
      if (row.status === 'archived') continue
      if (
        String(row.title || '')
          .trim()
          .toLowerCase() === tNorm &&
        String(row.description || '')
          .trim()
          .toLowerCase() === dNorm
      ) {
        const err = new Error('A course with the same title and description already exists.')
        err.status = 409
        throw err
      }
    }
    const ref = db.collection('courses').doc()
    const due = dueDate ? Timestamp.fromDate(new Date(dueDate)) : null
    await ref.set({
      title: String(title).trim(),
      description: String(description).trim(),
      thumbnailUrl: thumbnailUrl ? String(thumbnailUrl).trim() : null,
      status: 'draft',
      dueDate: due,
      createdBy: req.user.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    res.status(201).json(serializeDoc(await ref.get()))
  } catch (e) {
    next(e)
  }
})

cmsRouter.get('/courses', async (req, res, next) => {
  try {
    const db = dbRequired()
    const status = req.query.status ? String(req.query.status) : null
    const snap = await db.collection('courses').limit(200).get()
    const modSnap = await db.collection('modules').limit(2000).get()
    const moduleCountByCourse = new Map()
    for (const d of modSnap.docs) {
      const row = d.data()
      const cid = row.courseId
      if (!cid || row.status === 'archived') continue
      moduleCountByCourse.set(cid, (moduleCountByCourse.get(cid) || 0) + 1)
    }
    let rows = snap.docs.map((d) => ({
      ...serializeDoc(d),
      moduleCount: moduleCountByCourse.get(d.id) || 0,
    }))
    if (status) rows = rows.filter((r) => r.status === status)
    rows.sort((a, b) => String(a.title).localeCompare(String(b.title)))
    res.json(rows)
  } catch (e) {
    next(e)
  }
})

cmsRouter.get('/courses/:courseId/validate', async (req, res, next) => {
  try {
    const result = await validateCourseForPublish(req.params.courseId)
    res.json(result)
  } catch (e) {
    next(e)
  }
})

cmsRouter.get('/courses/:courseId', async (req, res, next) => {
  try {
    const db = dbRequired()
    const courseId = req.params.courseId
    const c = await db.collection('courses').doc(courseId).get()
    if (!c.exists) {
      const err = new Error('Course not found')
      err.status = 404
      throw err
    }
    const modulesSnap = await db
      .collection('modules')
      .where('courseId', '==', courseId)
      .get()
    const moduleCount = modulesSnap.docs.filter((d) => d.data().status !== 'archived').length
    res.json({
      ...serializeDoc(c),
      moduleCount,
    })
  } catch (e) {
    next(e)
  }
})

cmsRouter.patch('/courses/:courseId', async (req, res, next) => {
  try {
    const db = dbRequired()
    const ref = db.collection('courses').doc(req.params.courseId)
    const doc = await ref.get()
    if (!doc.exists) {
      const err = new Error('Course not found')
      err.status = 404
      throw err
    }
    const patch = { updatedAt: FieldValue.serverTimestamp() }
    if (req.body?.title !== undefined) {
      const t = String(req.body.title).trim()
      if (!t) {
        const err = new Error('Course title cannot be empty')
        err.status = 400
        throw err
      }
      assertCourseTitleLength(t)
      patch.title = t
    }
    if (req.body?.description !== undefined) {
      const d = String(req.body.description).trim()
      if (!d) {
        const err = new Error('Course description cannot be empty')
        err.status = 400
        throw err
      }
      assertCourseDescriptionLength(d)
      patch.description = d
    }
    if (req.body?.thumbnailUrl !== undefined) {
      patch.thumbnailUrl = req.body.thumbnailUrl
        ? String(req.body.thumbnailUrl).trim()
        : null
    }
    if (req.body?.dueDate !== undefined) {
      if (req.body.dueDate) {
        assertDueDateNotInPast(req.body.dueDate)
        patch.dueDate = Timestamp.fromDate(new Date(req.body.dueDate))
      } else {
        patch.dueDate = null
      }
    }
    await ref.update(patch)
    res.json(serializeDoc(await ref.get()))
  } catch (e) {
    next(e)
  }
})

cmsRouter.delete('/courses/:courseId', async (req, res, next) => {
  try {
    const db = dbRequired()
    const courseId = req.params.courseId
    const ref = db.collection('courses').doc(courseId)
    const doc = await ref.get()
    if (!doc.exists) {
      const err = new Error('Course not found')
      err.status = 404
      throw err
    }
    const enSnap = await db.collection('enrollments').where('courseId', '==', courseId).get()
    const hasActive = enSnap.docs.some((d) => d.data().status === 'active')
    if (hasActive) {
      const err = new Error(
        'Remove or withdraw all active trainee enrollments before archiving this course.',
      )
      err.status = 400
      throw err
    }
    await setCourseTreeStatus(courseId, 'archived')
    res.status(204).send()
  } catch (e) {
    next(e)
  }
})

cmsRouter.patch('/courses/:courseId/status', async (req, res, next) => {
  try {
    const db = dbRequired()
    const courseId = req.params.courseId
    const status = req.body?.status
    if (!['draft', 'published', 'archived'].includes(status)) {
      const err = new Error('Invalid status')
      err.status = 400
      throw err
    }
    const ref = db.collection('courses').doc(courseId)
    const doc = await ref.get()
    if (!doc.exists) {
      const err = new Error('Course not found')
      err.status = 404
      throw err
    }
    if (status === 'published') {
      const { valid, issues } = await validateCourseForPublish(courseId)
      if (!valid) {
        const err = new Error('Course is not ready to publish')
        err.status = 400
        err.issues = issues
        throw err
      }
      await setCourseTreeStatus(courseId, 'published')
      return res.json(serializeDoc(await ref.get()))
    }
    await setCourseTreeStatus(courseId, status)
    res.json(serializeDoc(await ref.get()))
  } catch (e) {
    if (e.issues) {
      return res.status(e.status || 400).json({ error: e.message, issues: e.issues })
    }
    next(e)
  }
})

cmsRouter.post('/courses/:courseId/modules', async (req, res, next) => {
  try {
    const db = dbRequired()
    const courseId = req.params.courseId
    const course = await db.collection('courses').doc(courseId).get()
    if (!course.exists) {
      const err = new Error('Course not found')
      err.status = 404
      throw err
    }
    const { title, description, order, completionCriteria } = req.body || {}
    if (!title || order === undefined || order === null) {
      const err = new Error('title and order are required')
      err.status = 400
      throw err
    }
    const desc =
      description !== undefined && description !== null
        ? String(description).trim()
        : ''
    const ref = db.collection('modules').doc()
    await ref.set({
      courseId,
      title: String(title).trim(),
      description: desc,
      order: Number(order),
      completionCriteria: {
        allLessonsCompleted: completionCriteria?.allLessonsCompleted !== false,
        examPassed: Boolean(completionCriteria?.examPassed),
      },
      status: 'draft',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    res.status(201).json(serializeDoc(await ref.get()))
  } catch (e) {
    next(e)
  }
})

cmsRouter.get('/courses/:courseId/modules', async (req, res, next) => {
  try {
    const db = dbRequired()
    const courseId = req.params.courseId
    const snap = await db.collection('modules').where('courseId', '==', courseId).get()
    const rows = snap.docs.map((d) => serializeDoc(d))
    rows.sort((a, b) => (a.order || 0) - (b.order || 0))
    res.json(rows)
  } catch (e) {
    next(e)
  }
})

cmsRouter.patch('/courses/:courseId/modules/reorder', async (req, res, next) => {
  try {
    const db = dbRequired()
    const courseId = req.params.courseId
    const orderedModuleIds = req.body?.orderedModuleIds
    if (!Array.isArray(orderedModuleIds) || orderedModuleIds.length === 0) {
      const err = new Error('orderedModuleIds must be a non-empty array')
      err.status = 400
      throw err
    }
    const batch = db.batch()
    let i = 1
    for (const id of orderedModuleIds) {
      const ref = db.collection('modules').doc(id)
      const doc = await ref.get()
      if (!doc.exists || doc.data().courseId !== courseId) {
        const err = new Error('Invalid module in list')
        err.status = 400
        throw err
      }
      batch.update(ref, { order: i, updatedAt: FieldValue.serverTimestamp() })
      i += 1
    }
    await batch.commit()
    const snap = await db.collection('modules').where('courseId', '==', courseId).get()
    const rows = snap.docs.map((d) => serializeDoc(d))
    rows.sort((a, b) => (a.order || 0) - (b.order || 0))
    res.json(rows)
  } catch (e) {
    next(e)
  }
})

cmsRouter.get('/modules/:moduleId', async (req, res, next) => {
  try {
    const db = dbRequired()
    const doc = await db.collection('modules').doc(req.params.moduleId).get()
    if (!doc.exists) {
      const err = new Error('Module not found')
      err.status = 404
      throw err
    }
    const lessonsSnap = await db
      .collection('lessons')
      .where('moduleId', '==', req.params.moduleId)
      .get()
    res.json({
      ...serializeDoc(doc),
      lessonCount: lessonsSnap.size,
    })
  } catch (e) {
    next(e)
  }
})

cmsRouter.patch('/modules/:moduleId', async (req, res, next) => {
  try {
    const db = dbRequired()
    const ref = db.collection('modules').doc(req.params.moduleId)
    const doc = await ref.get()
    if (!doc.exists) {
      const err = new Error('Module not found')
      err.status = 404
      throw err
    }
    const patch = { updatedAt: FieldValue.serverTimestamp() }
    if (req.body?.title !== undefined) {
      const t = String(req.body.title).trim()
      if (!t) {
        const err = new Error('Module title cannot be empty')
        err.status = 400
        throw err
      }
      patch.title = t
    }
    if (req.body?.description !== undefined) {
      patch.description = String(req.body.description).trim()
    }
    if (req.body?.order !== undefined) patch.order = Number(req.body.order)
    if (req.body?.completionCriteria) {
      patch.completionCriteria = {
        allLessonsCompleted:
          req.body.completionCriteria.allLessonsCompleted !== false,
        examPassed: Boolean(req.body.completionCriteria.examPassed),
      }
    }
    await ref.update(patch)
    res.json(serializeDoc(await ref.get()))
  } catch (e) {
    next(e)
  }
})

cmsRouter.patch('/modules/:moduleId/status', async (req, res, next) => {
  try {
    const db = dbRequired()
    const status = req.body?.status
    if (!['draft', 'published', 'archived'].includes(status)) {
      const err = new Error('Invalid status')
      err.status = 400
      throw err
    }
    const ref = db.collection('modules').doc(req.params.moduleId)
    const doc = await ref.get()
    if (!doc.exists) {
      const err = new Error('Module not found')
      err.status = 404
      throw err
    }
    await ref.update({ status, updatedAt: FieldValue.serverTimestamp() })
    res.json(serializeDoc(await ref.get()))
  } catch (e) {
    next(e)
  }
})

cmsRouter.delete('/modules/:moduleId', async (req, res, next) => {
  try {
    const db = dbRequired()
    const ref = db.collection('modules').doc(req.params.moduleId)
    const doc = await ref.get()
    if (!doc.exists) {
      const err = new Error('Module not found')
      err.status = 404
      throw err
    }
    await ref.update({ status: 'archived', updatedAt: FieldValue.serverTimestamp() })
    res.status(204).send()
  } catch (e) {
    next(e)
  }
})

cmsRouter.post('/modules/:moduleId/lessons', async (req, res, next) => {
  try {
    const db = dbRequired()
    const moduleId = req.params.moduleId
    const mod = await db.collection('modules').doc(moduleId).get()
    if (!mod.exists) {
      const err = new Error('Module not found')
      err.status = 404
      throw err
    }
    const courseId = mod.data().courseId
    const { title, type, order, content } = req.body || {}
    if (!title || !type || order === undefined || order === null) {
      const err = new Error('title, type, and order are required')
      err.status = 400
      throw err
    }
    if (!['reading', 'video', 'quiz', 'exam'].includes(type)) {
      const err = new Error('Invalid lesson type')
      err.status = 400
      throw err
    }
    let payloadContent = content && typeof content === 'object' ? { ...content } : {}
    if (type === 'reading' && payloadContent.body) {
      payloadContent = { body: sanitizeReadingHtml(String(payloadContent.body)) }
    }
    if (type === 'quiz' || type === 'exam') {
      payloadContent = {
        quizId: payloadContent.quizId ? String(payloadContent.quizId).trim() : '',
      }
    }
    if (type === 'video') {
      payloadContent = {
        storagePath: payloadContent.storagePath || '',
        downloadUrl: payloadContent.downloadUrl || '',
        fileName: payloadContent.fileName || '',
        mimeType: payloadContent.mimeType || '',
        durationSeconds: payloadContent.durationSeconds ?? null,
      }
    }
    const ref = db.collection('lessons').doc()
    await ref.set({
      moduleId,
      courseId,
      title: String(title).trim(),
      type,
      order: Number(order),
      content: payloadContent,
      status: 'draft',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    res.status(201).json(serializeDoc(await ref.get()))
  } catch (e) {
    next(e)
  }
})

cmsRouter.get('/modules/:moduleId/lessons', async (req, res, next) => {
  try {
    const db = dbRequired()
    const moduleId = req.params.moduleId
    const snap = await db.collection('lessons').where('moduleId', '==', moduleId).get()
    const rows = snap.docs.map((d) => serializeDoc(d))
    rows.sort((a, b) => (a.order || 0) - (b.order || 0))
    res.json(rows)
  } catch (e) {
    next(e)
  }
})

cmsRouter.patch('/modules/:moduleId/lessons/reorder', async (req, res, next) => {
  try {
    const db = dbRequired()
    const moduleId = req.params.moduleId
    const orderedLessonIds = req.body?.orderedLessonIds
    if (!Array.isArray(orderedLessonIds) || orderedLessonIds.length === 0) {
      const err = new Error('orderedLessonIds must be a non-empty array')
      err.status = 400
      throw err
    }
    const batch = db.batch()
    let i = 1
    for (const id of orderedLessonIds) {
      const ref = db.collection('lessons').doc(id)
      const doc = await ref.get()
      if (!doc.exists || doc.data().moduleId !== moduleId) {
        const err = new Error('Invalid lesson in list')
        err.status = 400
        throw err
      }
      batch.update(ref, { order: i, updatedAt: FieldValue.serverTimestamp() })
      i += 1
    }
    await batch.commit()
    const snap = await db.collection('lessons').where('moduleId', '==', moduleId).get()
    const rows = snap.docs.map((d) => serializeDoc(d))
    rows.sort((a, b) => (a.order || 0) - (b.order || 0))
    res.json(rows)
  } catch (e) {
    next(e)
  }
})

cmsRouter.get('/lessons/:lessonId', async (req, res, next) => {
  try {
    const db = dbRequired()
    const doc = await db.collection('lessons').doc(req.params.lessonId).get()
    if (!doc.exists) {
      const err = new Error('Lesson not found')
      err.status = 404
      throw err
    }
    res.json(serializeDoc(doc))
  } catch (e) {
    next(e)
  }
})

cmsRouter.patch('/lessons/:lessonId', async (req, res, next) => {
  try {
    const db = dbRequired()
    const ref = db.collection('lessons').doc(req.params.lessonId)
    const doc = await ref.get()
    if (!doc.exists) {
      const err = new Error('Lesson not found')
      err.status = 404
      throw err
    }
    const data = doc.data()
    const patch = { updatedAt: FieldValue.serverTimestamp() }
    if (req.body?.title !== undefined) {
      const t = String(req.body.title).trim()
      if (!t) {
        const err = new Error('Lesson title cannot be empty')
        err.status = 400
        throw err
      }
      patch.title = t
    }
    if (req.body?.order !== undefined) patch.order = Number(req.body.order)
    if (req.body?.content && typeof req.body.content === 'object') {
      let nextContent = { ...data.content, ...req.body.content }
      if (data.type === 'reading' && nextContent.body !== undefined) {
        nextContent = { body: sanitizeReadingHtml(String(nextContent.body)) }
      }
      if (data.type === 'quiz' || data.type === 'exam') {
        nextContent = {
          quizId: nextContent.quizId ? String(nextContent.quizId).trim() : '',
        }
      }
      patch.content = nextContent
    }
    await ref.update(patch)
    res.json(serializeDoc(await ref.get()))
  } catch (e) {
    next(e)
  }
})

cmsRouter.patch('/lessons/:lessonId/status', async (req, res, next) => {
  try {
    const db = dbRequired()
    const status = req.body?.status
    if (!['draft', 'published', 'archived'].includes(status)) {
      const err = new Error('Invalid status')
      err.status = 400
      throw err
    }
    const ref = db.collection('lessons').doc(req.params.lessonId)
    const doc = await ref.get()
    if (!doc.exists) {
      const err = new Error('Lesson not found')
      err.status = 404
      throw err
    }
    const lesson = doc.data()
    if (status === 'published' && lesson.type === 'video' && !lesson.content?.storagePath) {
      const err = new Error('Upload a video before publishing this lesson')
      err.status = 400
      throw err
    }
    await ref.update({ status, updatedAt: FieldValue.serverTimestamp() })
    res.json(serializeDoc(await ref.get()))
  } catch (e) {
    next(e)
  }
})

cmsRouter.delete('/lessons/:lessonId', async (req, res, next) => {
  try {
    const db = dbRequired()
    const ref = db.collection('lessons').doc(req.params.lessonId)
    const doc = await ref.get()
    if (!doc.exists) {
      const err = new Error('Lesson not found')
      err.status = 404
      throw err
    }
    await ref.update({ status: 'archived', updatedAt: FieldValue.serverTimestamp() })
    res.status(204).send()
  } catch (e) {
    next(e)
  }
})

cmsRouter.post(
  '/lessons/:lessonId/upload-video',
  (req, res, next) => {
    uploadVideo.single('video')(req, res, (err) => {
      if (err) {
        const { maxVideoUploadBytes } = getEnv()
        const maxBytes = maxVideoUploadBytes ?? DEFAULT_MAX_VIDEO_BYTES
        if (err.code === 'LIMIT_FILE_SIZE') {
          const e = new Error(
            `Video is too large. Maximum size is ${Math.round(maxBytes / (1024 * 1024))} MB.`,
          )
          e.status = 400
          return next(e)
        }
        const e = new Error(err.message || 'Upload failed')
        e.status = 400
        return next(e)
      }
      next()
    })
  },
  async (req, res, next) => {
    try {
      const db = dbRequired()
      if (!req.file) {
        const err = new Error('video file is required')
        err.status = 400
        throw err
      }
      const ref = db.collection('lessons').doc(req.params.lessonId)
      const doc = await ref.get()
      if (!doc.exists) {
        const err = new Error('Lesson not found')
        err.status = 404
        throw err
      }
      const data = doc.data()
      if (data.type !== 'video') {
        const err = new Error('Lesson is not a video lesson')
        err.status = 400
        throw err
      }
      const courseId = data.courseId
      const moduleId = data.moduleId
      const safeName =
        path.basename(req.file.originalname || 'video').replace(/[^a-zA-Z0-9._-]/g, '_') ||
        'video'
      const destPath = `videos/${courseId}/${moduleId}/${req.params.lessonId}-${Date.now()}-${safeName}`
      if (data.content?.storagePath) {
        await deleteStorageFile(data.content.storagePath)
      }
      await uploadVideoBuffer({
        destPath,
        buffer: req.file.buffer,
        contentType: req.file.mimetype,
      })
      const downloadUrl = await getVideoSignedUrl(destPath)
      const content = {
        storagePath: destPath,
        downloadUrl,
        fileName: safeName,
        mimeType: req.file.mimetype,
        durationSeconds: null,
      }
      await ref.update({
        content,
        updatedAt: FieldValue.serverTimestamp(),
      })
      res.json(serializeDoc(await ref.get()))
    } catch (e) {
      next(e)
    }
  },
)

cmsRouter.delete('/lessons/:lessonId/video', async (req, res, next) => {
  try {
    const db = dbRequired()
    const ref = db.collection('lessons').doc(req.params.lessonId)
    const doc = await ref.get()
    if (!doc.exists) {
      const err = new Error('Lesson not found')
      err.status = 404
      throw err
    }
    const data = doc.data()
    if (data.type !== 'video') {
      const err = new Error('Lesson is not a video lesson')
      err.status = 400
      throw err
    }
    if (data.content?.storagePath) await deleteStorageFile(data.content.storagePath)
    const content = {
      storagePath: '',
      downloadUrl: '',
      fileName: '',
      mimeType: '',
      durationSeconds: null,
    }
    await ref.update({ content, updatedAt: FieldValue.serverTimestamp() })
    res.json(serializeDoc(await ref.get()))
  } catch (e) {
    next(e)
  }
})

cmsRouter.post('/courses/:courseId/enrollments', async (req, res, next) => {
  try {
    const db = dbRequired()
    const courseId = req.params.courseId
    const course = await db.collection('courses').doc(courseId).get()
    if (!course.exists) {
      const err = new Error('Course not found')
      err.status = 404
      throw err
    }
    const traineeIds = req.body?.traineeIds
    if (!Array.isArray(traineeIds) || traineeIds.length === 0) {
      const err = new Error('traineeIds must be a non-empty array')
      err.status = 400
      throw err
    }
    const courseData = course.data()
    const defaultDue = courseData.dueDate || null
    const dueDate =
      req.body?.dueDate !== undefined
        ? req.body.dueDate
          ? Timestamp.fromDate(new Date(req.body.dueDate))
          : null
        : defaultDue

    const existingForCourse = await db
      .collection('enrollments')
      .where('courseId', '==', courseId)
      .get()
    const existingByTrainee = new Map(
      existingForCourse.docs.map((d) => [d.data().traineeId, d]),
    )

    const created = []
    for (const traineeId of traineeIds) {
      const uid = String(traineeId).trim()
      const existingDoc = existingByTrainee.get(uid)
      if (existingDoc) {
        await existingDoc.ref.update({
          status: 'active',
          dueDate,
          updatedAt: FieldValue.serverTimestamp(),
        })
        created.push(serializeDoc(await existingDoc.ref.get()))
        continue
      }
      const ref = db.collection('enrollments').doc()
      await ref.set({
        courseId,
        traineeId: uid,
        status: 'active',
        dueDate,
        enrolledBy: req.user.uid,
        enrolledAt: FieldValue.serverTimestamp(),
        completedAt: null,
        updatedAt: FieldValue.serverTimestamp(),
      })
      created.push(serializeDoc(await ref.get()))
    }
    res.status(201).json(created)
  } catch (e) {
    next(e)
  }
})

cmsRouter.get('/courses/:courseId/enrollments', async (req, res, next) => {
  try {
    const db = dbRequired()
    const courseId = req.params.courseId
    const snap = await db
      .collection('enrollments')
      .where('courseId', '==', courseId)
      .get()
    const rows = []
    for (const d of snap.docs) {
      const en = serializeDoc(d)
      const u = await db.collection('users').doc(en.traineeId).get()
      rows.push({
        ...en,
        trainee: u.exists ? serializeDoc(u) : null,
      })
    }
    res.json(rows)
  } catch (e) {
    next(e)
  }
})

cmsRouter.patch('/enrollments/:enrollmentId', async (req, res, next) => {
  try {
    const db = dbRequired()
    const ref = db.collection('enrollments').doc(req.params.enrollmentId)
    const doc = await ref.get()
    if (!doc.exists) {
      const err = new Error('Enrollment not found')
      err.status = 404
      throw err
    }
    const patch = { updatedAt: FieldValue.serverTimestamp() }
    if (req.body?.status !== undefined) {
      if (!['active', 'completed', 'withdrawn'].includes(req.body.status)) {
        const err = new Error('Invalid enrollment status')
        err.status = 400
        throw err
      }
      patch.status = req.body.status
      if (req.body.status === 'completed') {
        patch.completedAt = FieldValue.serverTimestamp()
      }
    }
    if (req.body?.dueDate !== undefined) {
      patch.dueDate = req.body.dueDate
        ? Timestamp.fromDate(new Date(req.body.dueDate))
        : null
    }
    await ref.update(patch)
    res.json(serializeDoc(await ref.get()))
  } catch (e) {
    next(e)
  }
})
