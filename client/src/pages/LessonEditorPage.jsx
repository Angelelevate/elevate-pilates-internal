import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { api } from '../services/api.js'

export function LessonEditorPage() {
  const { lessonId } = useParams()
  const navigate = useNavigate()
  const [lesson, setLesson] = useState(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [quizId, setQuizId] = useState('')
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [pendingVideo, setPendingVideo] = useState(null)
  const [pendingVideoPreviewUrl, setPendingVideoPreviewUrl] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [statusSaving, setStatusSaving] = useState(null)
  const [statusFlash, setStatusFlash] = useState(null)
  const videoInputRef = useRef(null)

  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['blockquote', 'link'],
        ['clean'],
      ],
    }),
    [],
  )

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/lessons/${lessonId}`)
      setLesson(data)
      setTitle(data.title)
      setBody(data.content?.body || '')
      setQuizId(data.content?.quizId || '')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load lesson.')
    }
  }, [lessonId])

  useEffect(() => {
    void load()
  }, [load])

  async function saveReading() {
    setError('')
    try {
      await api.patch(`/api/lessons/${lessonId}`, {
        title,
        content: { body },
      })
      await load()
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.')
    }
  }

  async function saveQuizRef() {
    setError('')
    try {
      await api.patch(`/api/lessons/${lessonId}`, {
        title,
        content: { quizId },
      })
      await load()
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.')
    }
  }

  function clearPendingVideo() {
    setPendingVideo(null)
    setPendingVideoPreviewUrl(null)
    if (videoInputRef.current) videoInputRef.current.value = ''
  }

  function onPickVideoFile(e) {
    const file = e.target.files?.[0]
    if (!file) {
      setPendingVideo(null)
      setPendingVideoPreviewUrl(null)
      return
    }
    setPendingVideo(file)
    setPendingVideoPreviewUrl(URL.createObjectURL(file))
    setError('')
  }

  async function startPendingVideoUpload() {
    if (!pendingVideo || uploading) return
    setUploading(true)
    setUploadProgress(0)
    setError('')
    try {
      const fd = new FormData()
      fd.append('video', pendingVideo)
      await api.post(`/api/lessons/${lessonId}/upload-video`, fd, {
        onUploadProgress: (ev) => {
          if (ev.total) setUploadProgress(Math.round((ev.loaded * 100) / ev.total))
        },
      })
      clearPendingVideo()
      await load()
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed.')
    } finally {
      setUploading(false)
      setUploadProgress(null)
    }
  }

  useEffect(() => {
    return () => {
      if (pendingVideoPreviewUrl) URL.revokeObjectURL(pendingVideoPreviewUrl)
    }
  }, [pendingVideoPreviewUrl])

  useEffect(() => {
    if (!statusFlash) return
    const id = setTimeout(() => setStatusFlash(null), 4000)
    return () => clearTimeout(id)
  }, [statusFlash])

  async function setStatus(status) {
    setError('')
    setStatusFlash(null)
    setStatusSaving(status)
    try {
      await api.patch(`/api/lessons/${lessonId}/status`, { status })
      await load()
      setStatusFlash(
        status === 'draft'
          ? 'Lesson is now draft.'
          : 'Lesson is now published.',
      )
    } catch (err) {
      setError(err.response?.data?.error || 'Status update failed.')
    } finally {
      setStatusSaving(null)
    }
  }

  if (!lesson) {
    return <p className="text-sm text-stone-600">{error || 'Loading…'}</p>
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() =>
              navigate(`/admin/courses/${lesson.courseId}/modules/${lesson.moduleId}`)
            }
            className="text-xs font-semibold text-stone-500 hover:text-stone-800"
          >
            ← Module
          </button>
          <h1 className="font-display text-2xl font-semibold text-stone-900">
            Edit lesson
          </h1>
          <p className="text-sm text-stone-600 capitalize">
            {lesson.type} · {lesson.status}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={statusSaving !== null}
            onClick={() => setStatus('draft')}
            className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {statusSaving === 'draft' ? 'Saving…' : 'Mark draft'}
          </button>
          <button
            type="button"
            disabled={statusSaving !== null}
            onClick={() => setStatus('published')}
            className="rounded-full bg-deep px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {statusSaving === 'published' ? 'Saving…' : 'Mark published'}
          </button>
        </div>
      </div>

      {statusFlash ? (
        <p
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
          role="status"
          aria-live="polite"
        >
          {statusFlash}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <label className="text-xs font-medium text-stone-700">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full max-w-xl rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none ring-deep/30 focus:ring-2"
        />
      </div>

      {lesson.type === 'reading' ? (
        <div className="space-y-3">
          <div className="lesson-editor-quill rounded-2xl border border-stone-200 bg-white p-2 shadow-sm">
            <ReactQuill theme="snow" value={body} onChange={setBody} modules={modules} />
          </div>
          <button
            type="button"
            onClick={saveReading}
            className="rounded-full bg-deep px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Save reading
          </button>
        </div>
      ) : null}

      {lesson.type === 'video' ? (
        <div className="space-y-3 rounded-2xl border border-stone-200/80 bg-white/80 p-4 shadow-sm">
          <p className="text-sm text-stone-600">
            Upload MP4, MOV, or WEBM. Current file on lesson:{' '}
            <span className="font-medium text-stone-900">
              {lesson.content?.fileName || 'None'}
            </span>
          </p>
          <p className="text-xs text-stone-500">
            Choose a file to preview it here. Nothing uploads until you start the upload — so the wrong
            file never leaves your device by accident.
          </p>
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            disabled={uploading}
            onChange={onPickVideoFile}
            className="block w-full max-w-xl text-sm text-stone-700 file:mr-3 file:rounded-full file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-stone-800 hover:file:bg-stone-200"
          />
          {pendingVideo ? (
            <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/80 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium text-stone-900">{pendingVideo.name}</span>
                <span className="text-xs text-stone-500">
                  {(pendingVideo.size / (1024 * 1024)).toFixed(1)} MB
                </span>
              </div>
              {pendingVideoPreviewUrl ? (
                <video
                  src={pendingVideoPreviewUrl}
                  controls
                  className="w-full max-w-xl rounded-lg border border-stone-200 bg-black"
                />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={clearPendingVideo}
                  className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50 disabled:opacity-50"
                >
                  Clear selection
                </button>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={startPendingVideoUpload}
                  className="rounded-full bg-deep px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  Start upload
                </button>
              </div>
            </div>
          ) : null}
          {uploading ? (
            <div className="space-y-1">
              <div
                className="h-2 w-full max-w-xl overflow-hidden rounded-full bg-stone-200"
                role="progressbar"
                aria-valuenow={uploadProgress ?? 0}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Upload progress"
              >
                <div
                  className="h-full rounded-full bg-deep transition-[width] duration-150"
                  style={{ width: `${uploadProgress ?? 0}%` }}
                />
              </div>
              <p className="text-xs text-stone-600">
                Uploading… {uploadProgress != null ? `${uploadProgress}%` : 'starting…'}
              </p>
            </div>
          ) : null}
          {lesson.content?.downloadUrl ? (
            <video
              src={lesson.content.downloadUrl}
              controls
              className="mt-2 w-full max-w-xl rounded-xl border border-stone-200"
            />
          ) : null}
        </div>
      ) : null}

      {lesson.type === 'quiz' || lesson.type === 'exam' ? (
        <div className="space-y-3 rounded-2xl border border-stone-200/80 bg-white/80 p-4 shadow-sm">
          <label className="text-xs font-medium text-stone-700">Quiz / exam definition ID</label>
          <input
            value={quizId}
            onChange={(e) => setQuizId(e.target.value)}
            placeholder="quiz document id (Module 5)"
            className="w-full max-w-xl rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none ring-deep/30 focus:ring-2"
          />
          <button
            type="button"
            onClick={saveQuizRef}
            className="rounded-full bg-deep px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Save reference
          </button>
          <p className="text-xs text-stone-500">
            Wire this to quiz definitions when the quiz engine is enabled.
          </p>
        </div>
      ) : null}

      <p className="text-sm">
        <Link
          to={`/admin/lessons/${lessonId}/preview`}
          className="font-semibold text-deep underline-offset-2 hover:underline"
        >
          Open learner preview (admin)
        </Link>
      </p>
    </div>
  )
}
