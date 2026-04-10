import { useState, useEffect } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, Search, Layers, X, CheckCircle2, AlertCircle, NotebookPen, BarChart3 } from 'lucide-react'
import { api, PackListItem, PickerReport, PickerNote, PickerVisual } from '../../lib/api'

const TYPE_ICON: Record<string, string> = {
  report: '📊',
  note:   '📝',
  chart:  '📈',
  kpi:    '🎯',
}

// ─── Artifact picker modal ────────────────────────────────────────────────────

function ArtifactPicker({
  currentStatements,
  onAdd,
  onClose,
}: {
  currentStatements: string[]
  onAdd: (id: string, title: string, type: string, isConfirmed?: boolean, confirmedAt?: string) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'reports' | 'notes' | 'visuals'>('reports')
  const [reports, setReports] = useState<PickerReport[]>([])
  const [notes, setNotes] = useState<PickerNote[]>([])
  const [visuals, setVisuals] = useState<PickerVisual[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.pickerReports().then((d) => setReports(d.reports)).catch(() => {})
    api.pickerNotes().then((d) => setNotes(d.notes)).catch(() => {})
    api.pickerVisuals().then((d) => setVisuals(d.visuals)).catch(() => {})
  }, [])

  const filterItems = <T extends { title: string }>(items: T[]) =>
    items.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()))

  const renderRow = (id: string, title: string, type: string, icon: React.ReactNode, isConfirmed?: boolean, confirmedAt?: string) => {
    const already = currentStatements.includes(id)
    return (
      <button
        key={id}
        onClick={() => !already && onAdd(id, title, type, isConfirmed, confirmedAt)}
        disabled={already}
        className={`w-full flex items-center gap-2 px-4 py-2 text-left text-sm transition-colors
          ${already ? 'text-gray-600 cursor-not-allowed' : 'text-gray-300 hover:bg-gray-800'}`}
      >
        {icon}
        <span className="flex-1 truncate">{title}</span>
        {already
          ? <span className="text-xs text-gray-600 shrink-0">added</span>
          : isConfirmed
          ? <span title="Confirmed"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" /></span>
          : <span title="Not confirmed"><AlertCircle className="h-3.5 w-3.5 text-yellow-600 shrink-0" /></span>
        }
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-96 flex flex-col max-h-[70vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <span className="text-sm font-semibold text-gray-200">Add Artifact to Pack</span>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          {(['reports', 'notes', 'visuals'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-medium transition-colors capitalize
                ${tab === t ? 'text-gray-100 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="px-3 py-2 border-b border-gray-800">
          <div className="flex items-center gap-2 bg-gray-800 rounded-md px-2 py-1.5">
            <Search className="h-3.5 w-3.5 text-gray-500 shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${tab}...`}
              className="flex-1 bg-transparent text-xs text-gray-200 placeholder-gray-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {tab === 'reports' && (
            filterItems(reports).length === 0
              ? <p className="text-xs text-gray-600 text-center py-6">No published reports available</p>
              : filterItems(reports).map((r) => renderRow(r.id, r.title, r.type ?? 'report',
                  <span className="text-base shrink-0">{TYPE_ICON[r.type] ?? '📊'}</span>, r.isConfirmed, r.confirmedAt))
          )}
          {tab === 'notes' && (
            filterItems(notes).length === 0
              ? <p className="text-xs text-gray-600 text-center py-6">No published notes available</p>
              : filterItems(notes).map((n) => renderRow(n.id, n.title, 'note',
                  <NotebookPen className="h-4 w-4 text-purple-400 shrink-0" />, n.isConfirmed, n.confirmedAt))
          )}
          {tab === 'visuals' && (
            filterItems(visuals).length === 0
              ? <p className="text-xs text-gray-600 text-center py-6">No published visuals available</p>
              : filterItems(visuals).map((v) => renderRow(v.id, v.title, v.visualType,
                  <BarChart3 className="h-4 w-4 text-blue-400 shrink-0" />, v.isConfirmed, v.confirmedAt))
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Pack Editor ──────────────────────────────────────────────────────────────

interface PackEditorProps {
  pack: PackListItem | null
  onSaved: (packId: string) => void
  onClose: () => void
}

interface StatementItem {
  id: string
  title: string
  type: string
  isConfirmed?: boolean
  confirmedAt?: string
}

export default function PackEditor({ pack, onSaved, onClose }: PackEditorProps) {
  const isNew = !pack
  const [name, setName] = useState(pack?.name ?? '')
  const [description, setDescription] = useState(pack?.description ?? '')
  const [statements, setStatements] = useState<StatementItem[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')

  // Resolve statement IDs to titles on load
  useEffect(() => {
    if (!pack?.statements?.length) return
    Promise.allSettled([
      api.pickerReports().then((d) => d.reports),
      api.pickerNotes().then((d) => d.notes),
      api.pickerVisuals().then((d) => d.visuals),
    ]).then(([rRes, nRes, vRes]) => {
      const reports = rRes.status === 'fulfilled' ? rRes.value : []
      const notes   = nRes.status === 'fulfilled' ? nRes.value : []
      const visuals = vRes.status === 'fulfilled' ? vRes.value : []
      const rMap = new Map(reports.map((r) => [r.id, { title: r.title, type: r.type ?? 'report', isConfirmed: r.isConfirmed, confirmedAt: r.confirmedAt }]))
      const nMap = new Map(notes.map((n) => [n.id, { title: n.title, type: 'note', isConfirmed: n.isConfirmed, confirmedAt: n.confirmedAt }]))
      const vMap = new Map(visuals.map((v) => [v.id, { title: v.title, type: v.visualType, isConfirmed: v.isConfirmed, confirmedAt: v.confirmedAt }]))
      setStatements(
        pack.statements.map((id) => {
          const a = rMap.get(id) ?? nMap.get(id) ?? vMap.get(id)
          return { id, title: a?.title ?? id, type: a?.type ?? 'report', isConfirmed: a?.isConfirmed, confirmedAt: a?.confirmedAt }
        })
      )
    })
  }, [])

  const packId = pack?.id ?? crypto.randomUUID()

  const handleAdd = (id: string, title: string, type: string, isConfirmed?: boolean, confirmedAt?: string) => {
    setStatements((prev) => [...prev, { id, title, type, isConfirmed, confirmedAt }])
    setShowPicker(false)
  }

  const handleRemove = (id: string) => {
    setStatements((prev) => prev.filter((s) => s.id !== id))
  }

  const moveItem = (index: number, dir: -1 | 1) => {
    const next = [...statements]
    const swap = index + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[index], next[swap]] = [next[swap], next[index]]
    setStatements(next)
  }

  const payload = { name, description, statements: statements.map((s) => s.id), layout: pack?.layout ?? [] }

  const handleSaveDraft = async () => {
    if (!name.trim()) { setError('Pack name is required'); return }
    setSaving(true)
    setError('')
    try {
      await api.savePackDraft(packId, payload)
      onSaved(packId)
    } catch {
      setError('Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!name.trim()) { setError('Pack name is required'); return }
    if (statements.length === 0) { setError('Add at least one report before publishing'); return }
    setPublishing(true)
    setError('')
    try {
      await api.publishPack(packId, payload)
      onSaved(packId)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Publish failed')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
        <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[480px] flex flex-col max-h-[85vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-gray-200">
                {isNew ? 'New Pack' : 'Edit Pack'}
              </span>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Pack name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Monthly P&L — April 2026"
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm
                           text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Description <span className="text-gray-600">(optional)</span></label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this pack"
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm
                           text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Reports in pack */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-gray-400">Reports in pack</label>
                <button
                  onClick={() => setShowPicker(true)}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Add artifact
                </button>
              </div>

              {statements.length === 0 ? (
                <div className="border border-dashed border-gray-700 rounded-md px-4 py-6 text-center">
                  <p className="text-xs text-gray-600">No reports added yet</p>
                  <p className="text-xs text-gray-700 mt-1">Only published reports can be added</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {statements.map((s, i) => {
                    const confirmed = s.isConfirmed
                    const confirmedLabel = s.confirmedAt
                      ? new Date(s.confirmedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : ''
                    return (
                      <div key={s.id} className="bg-gray-800 rounded-md px-3 py-2">
                        <div className="flex items-center gap-2">
                          {confirmed
                            ? <span title="Published and confirmed"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" /></span>
                            : <span title="Not confirmed"><AlertCircle className="h-3.5 w-3.5 text-yellow-500 shrink-0" /></span>
                          }
                          <span className="flex-1 text-xs text-gray-300 truncate">{s.title}</span>
                          <button onClick={() => moveItem(i, -1)} disabled={i === 0}
                            className="p-0.5 text-gray-600 hover:text-gray-300 disabled:opacity-30">
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => moveItem(i, 1)} disabled={i === statements.length - 1}
                            className="p-0.5 text-gray-600 hover:text-gray-300 disabled:opacity-30">
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleRemove(s.id)}
                            className="p-0.5 text-gray-600 hover:text-red-400 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className={`text-xs mt-0.5 pl-5 ${confirmed ? 'text-emerald-600' : 'text-yellow-700'}`}>
                          {confirmed ? `Confirmed ${confirmedLabel}` : 'Data not confirmed — cannot publish pack'}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-950 rounded-md px-3 py-2">{error}</p>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-gray-800 flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-xs text-gray-400 hover:text-gray-200 rounded-md
                         bg-gray-800 hover:bg-gray-700 transition-colors">
              Cancel
            </button>
            <button onClick={handleSaveDraft} disabled={saving || publishing}
              className="flex-1 py-2 text-xs font-medium rounded-md bg-gray-700
                         hover:bg-gray-600 text-gray-200 disabled:opacity-40 transition-colors">
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button onClick={handlePublish} disabled={saving || publishing}
              className="flex-1 py-2 text-xs font-medium rounded-md bg-blue-400
                         hover:bg-blue-700 text-white disabled:opacity-40 transition-colors">
              {publishing ? 'Publishing…' : 'Publish Pack'}
            </button>
          </div>
        </div>
      </div>

      {showPicker && (
        <ArtifactPicker
          currentStatements={statements.map((s) => s.id)}
          onAdd={handleAdd}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}
