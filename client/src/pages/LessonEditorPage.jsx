import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { api } from '../services/api.js'
import { putFileToSignedUrl } from '../services/directStorageUpload.js'
import { useToast } from '../contexts/ToastContext.jsx'
import { TraineeVisibilityTip } from '../components/admin/TraineeVisibilityTip.jsx'
import { LoadingSpinner } from '../components/LoadingSpinner.jsx'

export function LessonEditorPage() {
  const { showToast } = useToast()
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
  const [saveReadingBusy, setSaveReadingBusy] = useState(false)
  const [saveQuizBusy, setSaveQuizBusy] = useState(false)
  const [videoReplaceMode, setVideoReplaceMode] = useState(false)
  const [removeVideoBusy, setRemoveVideoBusy] = useState(false)
  const [archiveBusy, setArchiveBusy] = useState(false)
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

  useEffect(() => {
    if (!lesson || lesson.type !== 'video') return
    if (!lesson.content?.storagePath) setVideoReplaceMode(true)
    else setVideoReplaceMode(false)
  }, [lesson?.id, lesson?.type, lesson?.content?.storagePath])

  async function saveReading() {
    setError('')
    if (!title.trim()) {
      setError('Lesson title is required.')
      showToast({ variant: 'error', message: 'Lesson title is required.' })
      return
    }
    setSaveReadingBusy(true)
    try {
      await api.patch(`/api/lessons/${lessonId}`, {
        title: title.trim(),
        content: { body },
      })
      await load()
      showToast({ variant: 'success', message: 'Reading lesson saved.' })
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.')
    } finally {
      setSaveReadingBusy(false)
    }
  }

  async function saveQuizRef() {
    setError('')
    if (!title.trim()) {
      setError('Lesson title is required.')
      showToast({ variant: 'error', message: 'Lesson title is required.' })
      return
    }
    setSaveQuizBusy(true)
    try {
      await api.patch(`/api/lessons/${lessonId}`, {
        title: title.trim(),
        content: { quizId },
      })
      await load()
      showToast({ variant: 'success', message: 'Quiz reference saved.' })
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.')
    } finally {
      setSaveQuizBusy(false)
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
      const { data: session } = await api.post(`/api/lessons/${lessonId}/video-upload-session`, {
        fileName: pendingVideo.name,
        contentType: pendingVideo.type || 'video/mp4',
        fileSize: pendingVideo.size,
      })
      await putFileToSignedUrl(
        session.uploadUrl,
        pendingVideo,
        session.contentType,
        (pct) => setUploadProgress(pct),
      )
      await api.post(`/api/lessons/${lessonId}/video-upload-complete`, {
        storagePath: session.storagePath,
      })
      clearPendingVideo()
      setVideoReplaceMode(false)
      await load()
      showToast({ variant: 'success', message: 'Video uploaded.' })
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Upload failed.'
      setError(msg)
      showToast({ variant: 'error', message: msg })
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

  async function removeUploadedVideo() {
    setError('')
    setRemoveVideoBusy(true)
    try {
      await api.delete(`/api/lessons/${lessonId}/video`)
      clearPendingVideo()
      setVideoReplaceMode(true)
      await load()
      showToast({ variant: 'success', message: 'Video removed. Upload a new file when ready.' })
    } catch (err) {
      setError(err.response?.data?.error || 'Could not remove video.')
    } finally {
      setRemoveVideoBusy(false)
    }
  }

  async function archiveLesson() {
    if (!window.confirm('Archive this lesson? It will be hidden from trainees.')) return
    setError('')
    setArchiveBusy(true)
    try {
      await api.delete(`/api/lessons/${lessonId}`)
      showToast({ variant: 'success', message: 'Lesson archived.' })
      navigate(`/admin/courses/${lesson.courseId}/modules/${lesson.moduleId}`)
    } catch (err) {
      const msg = err.response?.data?.error || 'Could not archive lesson.'
      setError(msg)
      showToast({ variant: 'error', message: msg })
    } finally {
      setArchiveBusy(false)
    }
  }

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
    if (error) {
      return (
        <p
          className="motion-safe:animate-in-up motion-reduce:animate-none rounded-xl bg-red-50/90 px-4 py-3 text-sm text-red-800 shadow-warm-sm"
          role="alert"
        >
          {error}
        </p>
      )
    }
    return <LoadingSpinner label="Loading lesson" />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() =>
              navigate(`/admin/courses/${lesson.courseId}/modules/${lesson.moduleId}`)
            }
            className="ui-press text-xs font-semibold text-stone-400 transition-colors duration-200 ease-soft hover:text-stone-700"
          >
            ← Module
          </button>
          <h1 className="font-display text-2xl font-semibold text-stone-900">
            Edit lesson
          </h1>
          <p className="mt-0.5 text-sm text-stone-500 capitalize">
            {lesson.type} · {lesson.status}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={statusSaving !== null}
            onClick={() => setStatus('draft')}
            className="ui-btn-secondary !px-3 !py-1.5 !text-xs"
          >
            {statusSaving === 'draft' ? 'Saving…' : 'Mark draft'}
          </button>
          <button
            type="button"
            disabled={statusSaving !== null}
            onClick={() => setStatus('published')}
            className="ui-btn-primary !px-3 !py-1.5 !text-xs"
          >
            {statusSaving === 'published' ? 'Saving…' : 'Mark published'}
          </button>
          <button
            type="button"
            disabled={archiveBusy || statusSaving !== null}
            onClick={archiveLesson}
            className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-100 disabled:opacity-50"
          >
            {archiveBusy ? 'Archiving…' : 'Archive lesson'}
          </button>
        </div>
      </div>

      {statusFlash ? (
        <p
          className="motion-safe:animate-in-up motion-reduce:animate-none rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900 shadow-warm-sm"
          role="status"
          aria-live="polite"
        >
          {statusFlash}
        </p>
      ) : null}

      <div className="max-w-3xl rounded-xl border border-sky-100 bg-sky-50/40 px-4 py-2.5 shadow-warm-sm">
        <TraineeVisibilityTip variant="compact" />
      </div>

      {lesson.status === 'draft' ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-2.5 text-sm text-amber-950 shadow-warm-sm">
          <strong>Draft lesson</strong> — trainees never see this until you click{' '}
          <strong>Mark published</strong>. Publishing still requires a published course and module.
        </p>
      ) : null}

      {error ? (
        <p
          className="motion-safe:animate-in-up motion-reduce:animate-none rounded-xl bg-red-50/90 px-4 py-2.5 text-sm text-red-800 shadow-warm-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <label className="text-xs font-medium text-stone-600">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="ui-input w-full max-w-xl rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
        />
      </div>

      {lesson.type === 'video' && !lesson.content?.storagePath ? (
        <p
          className="max-w-3xl rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-2.5 text-sm text-amber-950 shadow-warm-sm"
          role="status"
        >
          <strong>No video file yet.</strong> Upload a video before publishing this lesson — otherwise
          publishing the course will be blocked.
        </p>
      ) : null}

      {lesson.type === 'reading' ? (
        <div className="space-y-3">
          <ReadingQuillFallback key={lessonId} body={body} onChange={setBody} modules={modules} />
          <button
            type="button"
            disabled={saveReadingBusy}
            onClick={saveReading}
            className="ui-btn-primary"
          >
            {saveReadingBusy ? 'Saving…' : 'Save reading'}
          </button>
        </div>
      ) : null}

      {lesson.type === 'video' ? (
        <div className="ui-surface space-y-4 p-5">
          <p className="text-sm text-stone-600">
            One video per lesson (MP4, MOV, or WEBM).{' '}
            {lesson.content?.storagePath ? (
              <>
                Current file:{' '}
                <span className="font-medium text-stone-900">
                  {lesson.content?.fileName || 'Uploaded video'}
                </span>
              </>
            ) : (
              <span className="font-medium text-stone-900">No file uploaded yet.</span>
            )}
          </p>
          {lesson.content?.storagePath && !videoReplaceMode && !pendingVideo ? (
            <div className="space-y-3">
              <p className="text-xs text-stone-500">
                Use <strong>Replace video</strong> to choose a new file, or <strong>Remove video</strong>{' '}
                to clear the lesson before uploading again.
              </p>
              {lesson.content?.downloadUrl ? (
                <video
                  src={lesson.content.downloadUrl}
                  controls
                  className="w-full max-w-xl rounded-xl border border-stone-200/60 shadow-warm-sm"
                />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={uploading || removeVideoBusy}
                  onClick={() => setVideoReplaceMode(true)}
                  className="ui-btn-secondary"
                >
                  Replace video
                </button>
                <button
                  type="button"
                  disabled={uploading || removeVideoBusy}
                  onClick={removeUploadedVideo}
                  className="ui-btn-secondary !border-red-200 !text-red-900"
                >
                  {removeVideoBusy ? 'Removing…' : 'Remove video'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-stone-400">
                Choose a file to preview it here. Nothing uploads until you start the upload.
              </p>
              {lesson.content?.storagePath ? (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => {
                    clearPendingVideo()
                    setVideoReplaceMode(false)
                  }}
                  className="text-xs font-semibold text-deep underline-offset-2 hover:underline"
                >
                  Cancel replace
                </button>
              ) : null}
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                disabled={uploading}
                onChange={onPickVideoFile}
                className="block w-full max-w-xl text-sm text-stone-700 file:mr-3 file:rounded-full file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-stone-800 hover:file:bg-stone-200"
              />
            </>
          )}
          {pendingVideo ? (
            <div className="space-y-3 rounded-xl border border-stone-200/80 bg-stone-50/60 p-4">
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
                  className="w-full max-w-xl rounded-lg border border-stone-200/60 bg-black shadow-warm-sm"
                />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={clearPendingVideo}
                  className="ui-btn-secondary"
                >
                  Clear selection
                </button>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={startPendingVideoUpload}
                  className="ui-btn-primary"
                >
                  Start upload
                </button>
              </div>
            </div>
          ) : null}
          {uploading ? (
            <div className="space-y-1.5">
              <div
                className="h-2.5 w-full max-w-xl overflow-hidden rounded-full bg-stone-200"
                role="progressbar"
                aria-valuenow={uploadProgress ?? 0}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Upload progress"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-deep to-sage transition-[width] duration-300 ease-soft-out"
                  style={{ width: `${uploadProgress ?? 0}%` }}
                />
              </div>
              <p className="text-xs text-stone-500">
                Uploading… {uploadProgress != null ? `${uploadProgress}%` : 'starting…'}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {lesson.type === 'quiz' || lesson.type === 'exam' ? (
        <div className="ui-surface space-y-5 p-5">
          <div className="space-y-2">
            <label className="text-xs font-medium text-stone-600">Quiz / exam definition ID</label>
            <input
              value={quizId}
              onChange={(e) => setQuizId(e.target.value)}
              placeholder="quiz document id (Module 5)"
              className="ui-input w-full max-w-xl rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
            />
          </div>
          <div>
            <button
              type="button"
              disabled={saveQuizBusy}
              onClick={saveQuizRef}
              className="ui-btn-primary"
            >
              {saveQuizBusy ? 'Saving…' : 'Save reference'}
            </button>
          </div>
          <p className="text-xs text-stone-400">
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

class ReadingQuillErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
          <p>
            The rich text editor could not load this content (often due to unusual HTML). Edit the
            HTML below and save — or simplify the content in a plain editor and paste back.
          </p>
          <textarea
            rows={14}
            value={this.props.body}
            onChange={(e) => this.props.onChange(e.target.value)}
            className="ui-input w-full rounded-xl border border-stone-200 bg-white px-3 py-2 font-mono text-xs outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
          />
        </div>
      )
    }
    return this.props.children
  }
}

function ReadingQuillFallback({ body, onChange, modules }) {
  return (
    <ReadingQuillErrorBoundary body={body} onChange={onChange}>
      <div className="lesson-editor-quill rounded-2xl border border-stone-200/60 bg-white p-2 shadow-warm-sm">
        <ReactQuill theme="snow" value={body} onChange={onChange} modules={modules} />
      </div>
    </ReadingQuillErrorBoundary>
  )
}
