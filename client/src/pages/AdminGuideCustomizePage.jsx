import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api.js'
import { putFileToSignedUrl } from '../services/directStorageUpload.js'
import { useToast } from '../contexts/ToastContext.jsx'
import { LoadingSpinner } from '../components/LoadingSpinner.jsx'
import { CKEditor5Editor } from '../components/admin/CKEditor5Editor.jsx'

export function AdminGuideCustomizePage() {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [faq, setFaq] = useState([])
  const [sections, setSections] = useState([])

  const [faqQuestion, setFaqQuestion] = useState('')
  const [faqAnswer, setFaqAnswer] = useState('')
  const [faqSort, setFaqSort] = useState('')
  const [faqSaving, setFaqSaving] = useState(false)

  const [editingFaqId, setEditingFaqId] = useState(null)
  const [editFaqQuestion, setEditFaqQuestion] = useState('')
  const [editFaqAnswer, setEditFaqAnswer] = useState('')
  const [editFaqSort, setEditFaqSort] = useState('')

  const [sectionTitle, setSectionTitle] = useState('')
  const [sectionBody, setSectionBody] = useState('')
  const [sectionEditorKey, setSectionEditorKey] = useState(0)
  const [sectionSort, setSectionSort] = useState('')
  const [sectionSaving, setSectionSaving] = useState(false)

  const [editingSectionId, setEditingSectionId] = useState(null)
  const [editSectionTitle, setEditSectionTitle] = useState('')
  const [editSectionBody, setEditSectionBody] = useState('')
  const [editSectionSort, setEditSectionSort] = useState('')

  const load = useCallback(async () => {
    const { data } = await api.get('/api/admin/platform-guide')
    setFaq(data.faq || [])
    setSections(data.customSections || [])
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await load()
      } catch (err) {
        if (!cancelled) {
          showToast({
            variant: 'error',
            message: err.response?.data?.error || 'Could not load guide extras.',
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [load, showToast])

  const handleGuideImageUpload = useCallback(
    async (file) => {
      try {
        const { data: session } = await api.post('/api/admin/platform-guide/image-upload-session', {
          fileName: file.name,
          contentType: file.type || 'image/png',
          fileSize: file.size,
        })
        await putFileToSignedUrl(session.uploadUrl, file, session.contentType, () => {})
        const { data: result } = await api.post('/api/admin/platform-guide/image-upload-complete', {
          storagePath: session.storagePath,
        })
        return result.imageUrl
      } catch (err) {
        const msg = err.response?.data?.error || err.message || 'Image upload failed.'
        showToast({ variant: 'error', message: msg })
        throw err
      }
    },
    [showToast],
  )

  async function addFaq(e) {
    e.preventDefault()
    if (!faqQuestion.trim() || !faqAnswer.trim()) {
      showToast({ variant: 'error', message: 'Question and answer are required.' })
      return
    }
    setFaqSaving(true)
    try {
      const body = { question: faqQuestion.trim(), answer: faqAnswer.trim() }
      if (faqSort !== '' && Number.isFinite(Number(faqSort))) body.sortOrder = Number(faqSort)
      await api.post('/api/admin/platform-guide/faq', body)
      setFaqQuestion('')
      setFaqAnswer('')
      setFaqSort('')
      await load()
      showToast({ variant: 'success', message: 'FAQ entry added.' })
    } catch (err) {
      showToast({ variant: 'error', message: err.response?.data?.error || 'Save failed.' })
    } finally {
      setFaqSaving(false)
    }
  }

  async function saveFaqEdit(id) {
    try {
      const body = {
        question: editFaqQuestion.trim(),
        answer: editFaqAnswer.trim(),
      }
      if (editFaqSort !== '' && Number.isFinite(Number(editFaqSort))) {
        body.sortOrder = Number(editFaqSort)
      }
      await api.patch(`/api/admin/platform-guide/faq/${id}`, body)
      setEditingFaqId(null)
      await load()
      showToast({ variant: 'success', message: 'FAQ updated.' })
    } catch (err) {
      showToast({ variant: 'error', message: err.response?.data?.error || 'Update failed.' })
    }
  }

  async function removeFaq(id) {
    if (!window.confirm('Delete this FAQ entry?')) return
    try {
      await api.delete(`/api/admin/platform-guide/faq/${id}`)
      await load()
      showToast({ variant: 'success', message: 'FAQ removed.' })
    } catch (err) {
      showToast({ variant: 'error', message: err.response?.data?.error || 'Delete failed.' })
    }
  }

  function startEditFaq(row) {
    setEditingFaqId(row.id)
    setEditFaqQuestion(row.question || '')
    setEditFaqAnswer(row.answer || '')
    setEditFaqSort(row.sortOrder != null ? String(row.sortOrder) : '')
  }

  async function addSection(e) {
    e.preventDefault()
    if (!sectionTitle.trim() || !sectionBody.trim()) {
      showToast({ variant: 'error', message: 'Title and content are required.' })
      return
    }
    setSectionSaving(true)
    try {
      const body = { title: sectionTitle.trim(), bodyHtml: sectionBody }
      if (sectionSort !== '' && Number.isFinite(Number(sectionSort))) body.sortOrder = Number(sectionSort)
      await api.post('/api/admin/platform-guide/sections', body)
      setSectionTitle('')
      setSectionBody('')
      setSectionSort('')
      setSectionEditorKey((k) => k + 1)
      await load()
      showToast({ variant: 'success', message: 'Section added.' })
    } catch (err) {
      showToast({ variant: 'error', message: err.response?.data?.error || 'Save failed.' })
    } finally {
      setSectionSaving(false)
    }
  }

  async function saveSectionEdit(id) {
    try {
      const body = {
        title: editSectionTitle.trim(),
        bodyHtml: editSectionBody,
      }
      if (editSectionSort !== '' && Number.isFinite(Number(editSectionSort))) {
        body.sortOrder = Number(editSectionSort)
      }
      await api.patch(`/api/admin/platform-guide/sections/${id}`, body)
      setEditingSectionId(null)
      await load()
      showToast({ variant: 'success', message: 'Section updated.' })
    } catch (err) {
      showToast({ variant: 'error', message: err.response?.data?.error || 'Update failed.' })
    }
  }

  async function removeSection(id) {
    if (!window.confirm('Delete this custom section?')) return
    try {
      await api.delete(`/api/admin/platform-guide/sections/${id}`)
      await load()
      showToast({ variant: 'success', message: 'Section removed.' })
    } catch (err) {
      showToast({ variant: 'error', message: err.response?.data?.error || 'Delete failed.' })
    }
  }

  if (loading) return <LoadingSpinner label="Loading guide settings" />

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="ui-section-label">Admin</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">
            Customize platform guide
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
            Add FAQ entries and extra guide sections. The built-in guide and standard FAQs stay as-is;
            your content appears in the guide after <strong>Reminder automation</strong> (sections) and
            below the standard questions (FAQs).
          </p>
        </div>
        <Link to="/admin/guide" className="ui-btn-secondary shrink-0">
          View guide
        </Link>
      </div>

      <section className="ui-surface space-y-5 p-6">
        <h2 className="font-display text-lg font-semibold text-stone-900">Additional FAQs</h2>
        <p className="text-sm text-stone-600">
          Shown in the same FAQ area as the built-in questions. Lower <strong>sort order</strong> values
          appear first among your added entries.
        </p>
        <form onSubmit={addFaq} className="space-y-3 rounded-xl border border-stone-200/60 bg-stone-50/50 p-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-stone-600">Question</label>
            <input
              value={faqQuestion}
              onChange={(e) => setFaqQuestion(e.target.value)}
              className="ui-input w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-stone-600">Answer</label>
            <textarea
              value={faqAnswer}
              onChange={(e) => setFaqAnswer(e.target.value)}
              rows={4}
              className="ui-input w-full resize-y rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-stone-600">Sort order (optional)</label>
            <input
              value={faqSort}
              onChange={(e) => setFaqSort(e.target.value)}
              inputMode="numeric"
              placeholder="Auto"
              className="ui-input w-40 rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
            />
          </div>
          <button type="submit" disabled={faqSaving} className="ui-btn-primary">
            {faqSaving ? 'Adding…' : 'Add FAQ'}
          </button>
        </form>

        <ul className="divide-y divide-stone-200/60 rounded-xl border border-stone-200/60">
          {faq.length === 0 ? (
            <li className="px-4 py-6 text-sm text-stone-500">No additional FAQs yet.</li>
          ) : (
            faq.map((row) => (
              <li key={row.id} className="px-4 py-4">
                {editingFaqId === row.id ? (
                  <div className="space-y-3">
                    <input
                      value={editFaqQuestion}
                      onChange={(e) => setEditFaqQuestion(e.target.value)}
                      className="ui-input w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
                    />
                    <textarea
                      value={editFaqAnswer}
                      onChange={(e) => setEditFaqAnswer(e.target.value)}
                      rows={4}
                      className="ui-input w-full resize-y rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={editFaqSort}
                        onChange={(e) => setEditFaqSort(e.target.value)}
                        inputMode="numeric"
                        placeholder="Sort order"
                        className="ui-input w-36 rounded-xl border border-stone-200 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => saveFaqEdit(row.id)}
                        className="ui-btn-primary !px-3 !py-1.5 !text-xs"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingFaqId(null)}
                        className="ui-btn-secondary !px-3 !py-1.5 !text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-stone-900">{row.question}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-stone-600">{row.answer}</p>
                      <p className="mt-1 text-xs text-stone-400">Sort: {row.sortOrder ?? '—'}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => startEditFaq(row)}
                        className="ui-btn-secondary !px-3 !py-1.5 !text-xs"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFaq(row.id)}
                        className="ui-btn-secondary !border-red-200 !px-3 !py-1.5 !text-xs !text-red-900"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="ui-surface space-y-5 p-6">
        <h2 className="font-display text-lg font-semibold text-stone-900">Custom guide sections</h2>
        <p className="text-sm text-stone-600">
          Rich text sections appear after the built-in chapters and before the FAQ block. Use sort order
          to sequence multiple sections.
        </p>
        <form
          onSubmit={addSection}
          className="space-y-3 rounded-xl border border-stone-200/60 bg-stone-50/50 p-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-stone-600">Section title</label>
            <input
              value={sectionTitle}
              onChange={(e) => setSectionTitle(e.target.value)}
              className="ui-input w-full max-w-xl rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-stone-600">Content</label>
            <CKEditor5Editor
              key={`new-section-${sectionEditorKey}`}
              content={sectionBody}
              onChange={setSectionBody}
              onImageUpload={handleGuideImageUpload}
              placeholder="Write your custom section…"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-stone-600">Sort order (optional)</label>
            <input
              value={sectionSort}
              onChange={(e) => setSectionSort(e.target.value)}
              inputMode="numeric"
              placeholder="Auto"
              className="ui-input w-40 rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
            />
          </div>
          <button type="submit" disabled={sectionSaving} className="ui-btn-primary">
            {sectionSaving ? 'Adding…' : 'Add section'}
          </button>
        </form>

        <ul className="space-y-4">
          {sections.length === 0 ? (
            <li className="rounded-xl border border-stone-200/60 px-4 py-6 text-sm text-stone-500">
              No custom sections yet.
            </li>
          ) : (
            sections.map((row) => (
              <li key={row.id} className="rounded-xl border border-stone-200/60 p-4">
                {editingSectionId === row.id ? (
                  <div className="space-y-3">
                    <input
                      value={editSectionTitle}
                      onChange={(e) => setEditSectionTitle(e.target.value)}
                      className="ui-input w-full max-w-xl rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm outline-none ring-deep/30 focus:border-clay/40 focus:ring-2"
                    />
                    <CKEditor5Editor
                      key={`edit-${row.id}`}
                      content={editSectionBody}
                      onChange={setEditSectionBody}
                      onImageUpload={handleGuideImageUpload}
                      placeholder="Section content…"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={editSectionSort}
                        onChange={(e) => setEditSectionSort(e.target.value)}
                        inputMode="numeric"
                        placeholder="Sort order"
                        className="ui-input w-36 rounded-xl border border-stone-200 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => saveSectionEdit(row.id)}
                        className="ui-btn-primary !px-3 !py-1.5 !text-xs"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSectionId(null)}
                        className="ui-btn-secondary !px-3 !py-1.5 !text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-base font-semibold text-stone-900">{row.title}</p>
                      <p className="mt-1 text-xs text-stone-400">Sort: {row.sortOrder ?? '—'}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSectionId(row.id)
                          setEditSectionTitle(row.title || '')
                          setEditSectionBody(row.bodyHtml || '')
                          setEditSectionSort(row.sortOrder != null ? String(row.sortOrder) : '')
                        }}
                        className="ui-btn-secondary !px-3 !py-1.5 !text-xs"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSection(row.id)}
                        className="ui-btn-secondary !border-red-200 !px-3 !py-1.5 !text-xs !text-red-900"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  )
}
