import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../services/api.js'
import { LoadingSpinner } from '../components/LoadingSpinner.jsx'

const STATUS_TABS = ['all', 'active', 'completed', 'overdue', 'withdrawn']
const SORT_COLS = ['name', 'progress', 'dueDate', 'lastActive']

export function TraineeListPage() {
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState({ data: [], total: 0, page: 1, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(params.get('search') || '')
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  const [status, setStatus] = useState(params.get('status') || 'all')
  const [sort, setSort] = useState(params.get('sort') || 'name')
  const [order, setOrder] = useState(params.get('order') || 'asc')
  const [page, setPage] = useState(Number(params.get('page')) || 1)
  const debounceRef = useRef(null)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(debounceRef.current)
  }, [search])

  async function load() {
    setLoading(true)
    try {
      const { data: d } = await api.get('/api/admin/dashboard/trainees', {
        params: { page, limit: 25, search: debouncedSearch, status, sort, order },
      })
      setData(d)
    } catch {
      // fail silently
    } finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    setParams({ search: debouncedSearch, status, sort, order, page: String(page) })
  }, [debouncedSearch, status, sort, order, page])

  function toggleSort(col) {
    if (sort === col) setOrder((o) => o === 'asc' ? 'desc' : 'asc')
    else { setSort(col); setOrder('asc') }
  }

  async function exportCsv() {
    try {
      const { data: blob } = await api.get('/api/admin/dashboard/export/trainees', {
        params: { status, search },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'trainees.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // silent
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="ui-section-label">Admin</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Trainee Performance</h1>
        </div>
        <button type="button" onClick={exportCsv} className="ui-btn-secondary min-h-[44px]">
          Export CSV
        </button>
      </div>

      {/* Search + Status tabs */}
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="ui-input w-full max-w-xs"
        />
        <div className="flex flex-wrap gap-1">
          {STATUS_TABS.map((s) => (
            <button key={s} type="button"
              onClick={() => { setStatus(s); setPage(1) }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${status === s ? 'bg-deep text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? <LoadingSpinner label="Loading trainees" /> : (
        <div className="ui-surface overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-stone-200/60 bg-stone-50/50">
              <tr>
                {[
                  { key: 'name', label: 'Name' },
                  { key: 'email', label: 'Email', nosort: true },
                  { key: 'status', label: 'Status', nosort: true },
                  { key: 'progress', label: 'Progress' },
                  { key: 'dueDate', label: 'Due Date' },
                  { key: 'lastActive', label: 'Last Active' },
                ].map((col) => (
                  <th key={col.key} className="px-4 py-3 font-medium text-stone-600">
                    {col.nosort ? col.label : (
                      <button type="button" onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-stone-900">
                        {col.label}
                        {sort === col.key && <span className="text-xs">{order === 'asc' ? '↑' : '↓'}</span>}
                      </button>
                    )}
                  </th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data.data.map((t) => (
                <tr key={t.traineeId} className="transition-colors hover:bg-stone-50/50">
                  <td className="px-4 py-3 font-medium text-stone-900">
                    {t.name}
                    {t.courseCount > 1 && <span className="ml-1.5 rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold text-stone-500">{t.courseCount} courses</span>}
                  </td>
                  <td className="px-4 py-3 text-stone-600">{t.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      t.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                      t.status === 'overdue' ? 'bg-red-100 text-red-800' :
                      t.status === 'withdrawn' ? 'bg-stone-100 text-stone-600' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-stone-100">
                        <div className="h-full rounded-full bg-deep" style={{ width: `${t.progress}%` }} />
                      </div>
                      <span className="text-xs font-medium text-stone-600">{t.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}
                    {t.daysRemaining != null && t.daysRemaining < 0 && (
                      <span className="ml-1 text-xs font-semibold text-red-600">({Math.abs(t.daysRemaining)}d overdue)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone-500 text-xs">
                    {t.lastActive ? new Date(t.lastActive).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/admin/trainees/${t.traineeId}`} className="text-sm font-semibold text-deep hover:underline">View</Link>
                  </td>
                </tr>
              ))}
              {data.data.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-stone-500">No trainees found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            className="ui-btn-secondary !px-3 !py-1.5 text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-stone-600">Page {page} of {data.totalPages}</span>
          <button type="button" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}
            className="ui-btn-secondary !px-3 !py-1.5 text-sm disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  )
}
