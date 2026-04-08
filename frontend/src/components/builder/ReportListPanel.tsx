import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, FileText, Package, Pencil, Trash2, ShieldAlert, ChevronRight, ChevronDown, NotebookPen, TrendingUp } from 'lucide-react'
import { useReportStore } from '../../store/useReportStore'
import { api, PackListItem, PickerReport, PickerNote, PickerVisual, NoteListItem, VisualListItem } from '../../lib/api'
import PackEditor from './PackEditor'

interface ReportListPanelProps {
  tab: 'reports' | 'notes' | 'visuals' | 'packs'
  setTab: (tab: 'reports' | 'notes' | 'visuals' | 'packs') => void
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string, title: string) => void
  onSelectNote: (id: string) => void
  onSelectVisual: (id: string) => void
  onOpenNote: (id: string) => void
  onOpenVisual: (id: string) => void
}

const TYPE_ICON: Record<string, string> = {
  report: '',
  note:   '📝',
  chart:  '📈',
  kpi:    '🎯',
}

export default function ReportListPanel({ tab, setTab, onSelect, onNew, onDelete, onSelectNote, onSelectVisual, onOpenNote, onOpenVisual }: ReportListPanelProps) {
  const { reportList, definition } = useReportStore()
  const navigate = useNavigate()
  const [packs, setPacks] = useState<PackListItem[]>([])
  const [pickerReports, setPickerReports] = useState<PickerReport[]>([])
  const [pickerNotes, setPickerNotes] = useState<PickerNote[]>([])
  const [pickerVisuals, setPickerVisuals] = useState<PickerVisual[]>([])
  const [editingPack, setEditingPack] = useState<PackListItem | null | 'new'>(null)
  const [expandedPacks, setExpandedPacks] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState<NoteListItem[]>([])
  const [visuals, setVisuals] = useState<VisualListItem[]>([])

  const loadPacks = () => {
    api.listPacks().then((d) => setPacks(d.packs)).catch(() => {})
    api.pickerReports().then((d) => setPickerReports(d.reports)).catch(() => {})
    api.pickerNotes().then((d) => setPickerNotes(d.notes)).catch(() => {})
    api.pickerVisuals().then((d) => setPickerVisuals(d.visuals)).catch(() => {})
  }

  const loadNotes = () => {
    api.listNotes().then((d) => setNotes(d.notes)).catch(() => {})
  }

  const loadVisuals = () => {
    api.listVisuals().then((d) => setVisuals(d.visuals)).catch(() => {})
  }

  useEffect(() => { loadPacks(); loadNotes(); loadVisuals() }, [])
  useEffect(() => { if (tab === 'packs') loadPacks() }, [tab])

  const handleNewNote = async () => {
    try {
      const n = await api.createNote()
      loadNotes()
      onOpenNote(n.id)
    } catch {
      alert('Could not create note — check backend is running')
    }
  }

  const handleNewVisual = async () => {
    try {
      const v = await api.createVisual()
      loadVisuals()
      onOpenVisual(v.id)
    } catch {
      alert('Could not create a visual — check backend is running')
    }
  }

  const handleDeleteVisual = async (id: string, title: string) => {
    if (!window.confirm(`Delete visual "${title}"? This cannot be undone.`)) return
    try {
      await api.deleteVisual(id)
      loadVisuals()
    } catch {}
  }

  const handleDeleteNote = async (id: string, title: string) => {
    if (!window.confirm(`Delete note "${title}"? This cannot be undone.`)) return
    try {
      await api.deleteNote(id)
      loadNotes()
    } catch {}
  }

  const togglePack = (id: string) => {
    setExpandedPacks((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handlePackSaved = (packId: string) => {
    setEditingPack(null)
    loadPacks()
    // After creating a new pack, go straight to the composer
    if (editingPack === 'new') navigate(`/builder/packs/${packId}`)
  }

  const handleDeletePack = async (id: string, name: string) => {
    if (!window.confirm(`Delete pack "${name}"? This cannot be undone.`)) return
    try {
      await api.deletePack(id)
      loadPacks()
    } catch {}
  }

  return (
    <>
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 h-full">

        {/* Tab switcher */}
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setTab('reports')}
            className={`flex-1 flex items-center justify-center py-2.5 transition-colors
              ${tab === 'reports' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
            title="Reports"
          >
            <FileText className="h-4 w-4" />
          </button>
          <button
            onClick={() => setTab('notes')}
            className={`flex-1 flex items-center justify-center py-2.5 transition-colors
              ${tab === 'notes' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
            title="Notes"
          >
            <NotebookPen className="h-4 w-4" />
          </button>
          <button
            onClick={() => setTab('visuals')}
            className={`flex-1 flex items-center justify-center py-2.5 transition-colors
              ${tab === 'visuals' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
            title="Visuals"
          >
            <TrendingUp className="h-4 w-4" />
          </button>
          <button
            onClick={() => setTab('packs')}
            className={`flex-1 flex items-center justify-center py-2.5 transition-colors
              ${tab === 'packs' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
            title="Packs"
          >
            <Package className="h-4 w-4" />
          </button>
        </div>

        {/* Reports tab */}
        {tab === 'reports' && (
          <>
            <div className="px-3 py-2 border-b border-gray-800">
              <button
                onClick={onNew}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md
                           bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                New Report
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-1">
              {reportList.length === 0 && (
                <p className="px-3 py-4 text-xs text-gray-600 text-center">No reports yet</p>
              )}
              {reportList.map((r) => (
                <div key={r.id}
                  className={`flex items-center gap-2 px-3 py-2 group transition-colors cursor-pointer
                    ${definition.id === r.id ? 'bg-gray-800' : 'hover:bg-gray-800'}`}
                  onClick={() => onSelect(r.id)}
                >
                  <span className="text-sm shrink-0">
                    {TYPE_ICON[r.type] || <FileText className="h-3.5 w-3.5 text-gray-500" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs truncate ${definition.id === r.id ? 'text-gray-100' : 'text-gray-400 group-hover:text-gray-200'}`}>
                      {r.title || 'Untitled'}
                    </p>
                  </div>
                  <span className="shrink-0 flex items-center gap-1">
                    {/* Status dots — hidden on hover, replaced by action buttons */}
                    <span className="flex items-center gap-1 group-hover:hidden">
                      {!r.everPublished ? (
                        <span className="text-xs text-gray-600">draft</span>
                      ) : r.isConfirmed ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="Published and confirmed" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" title="Published — data not confirmed" />
                      )}
                      {r.hasDraft && r.everPublished && (
                        <span className="text-xs text-yellow-500" title="Has unsaved changes">•</span>
                      )}
                    </span>
                    {/* Action buttons — visible on hover */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onSelect(r.id) }}
                      className="p-0.5 text-gray-600 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Edit report"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(r.id, r.title) }}
                      className="p-0.5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete report"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                </div>
              ))}
            </nav>
          </>
        )}

        {/* Notes tab */}
        {tab === 'notes' && (
          <>
            <div className="px-3 py-2 border-b border-gray-800">
              <button
                onClick={handleNewNote}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md
                           bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                New Note
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-1">
              {notes.length === 0 && (
                <p className="px-3 py-4 text-xs text-gray-600 text-center">No notes yet</p>
              )}
              {notes.map((n) => (
                <div key={n.id}
                  className="flex items-center gap-2 px-3 py-2 group hover:bg-gray-800 transition-colors cursor-pointer"
                  onClick={() => onOpenNote(n.id)}
                >
                  <NotebookPen className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 group-hover:text-gray-200 truncate">
                      {n.title || 'Untitled Note'}
                    </p>
                  </div>
                  <span className="shrink-0 flex items-center gap-1">
                    <span className="flex items-center gap-1 group-hover:hidden">
                      {!n.everPublished
                        ? <span className="text-xs text-gray-600">draft</span>
                        : n.isConfirmed
                          ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="Published and confirmed" />
                          : <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" title="Published — not confirmed" />
                      }
                      {n.hasDraft && n.everPublished && (
                        <span className="text-xs text-yellow-500" title="Has unsaved changes">•</span>
                      )}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenNote(n.id) }}
                      className="p-0.5 text-gray-600 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Edit note"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteNote(n.id, n.title) }}
                      className="p-0.5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete note"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                </div>
              ))}
            </nav>
          </>
        )}

        {/* Visuals tab */}
        {tab === 'visuals' && (
          <>
            <div className="px-3 py-2 border-b border-gray-800">
              <button
                onClick={handleNewVisual}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md
                           bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                New Visual
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-1">
              {visuals.length === 0 && (
                <p className="px-3 py-4 text-xs text-gray-600 text-center">No visuals yet</p>
              )}
              {visuals.map((v) => (
                <div key={v.id}
                  className="flex items-center gap-2 px-3 py-2 group hover:bg-gray-800 transition-colors cursor-pointer"
                  onClick={() => onOpenVisual(v.id)}
                >
                  <TrendingUp className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 group-hover:text-gray-200 truncate">
                      {v.title || 'Untitled Visual'}
                    </p>
                    <p className="text-xs text-gray-600 capitalize">{v.visualType}</p>
                  </div>
                  <span className="shrink-0 flex items-center gap-1">
                    <span className="flex items-center gap-1 group-hover:hidden">
                      {!v.everPublished
                        ? <span className="text-xs text-gray-600">draft</span>
                        : v.isConfirmed
                          ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="Published and confirmed" />
                          : <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" title="Published — not confirmed" />
                      }
                      {v.hasDraft && v.everPublished && (
                        <span className="text-xs text-yellow-500" title="Has unsaved changes">•</span>
                      )}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenVisual(v.id) }}
                      className="p-0.5 text-gray-600 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Edit visual"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteVisual(v.id, v.title) }}
                      className="p-0.5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete visual"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                </div>
              ))}
            </nav>
          </>
        )}

        {/* Packs tab */}
        {tab === 'packs' && (
          <>
            <div className="px-3 py-2 border-b border-gray-800">
              <button
                onClick={() => setEditingPack('new')}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md
                           bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                New Pack
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-1">
              {packs.length === 0 && (
                <p className="px-3 py-4 text-xs text-gray-600 text-center">No packs yet</p>
              )}
              {packs.map((p) => {
                const isOpen = expandedPacks.has(p.id)
                const rMap = new Map(pickerReports.map((r) => [r.id, { title: r.title, type: 'report', hasDraft: r.hasDraft }]))
                const nMap = new Map(pickerNotes.map((n) => [n.id, { title: n.title, type: 'note', hasDraft: false }]))
                const vMap = new Map(pickerVisuals.map((v) => [v.id, { title: v.title, type: v.visualType, hasDraft: false }]))
                const packArtifacts = p.statements.map((id) => {
                  const a = rMap.get(id) ?? nMap.get(id) ?? vMap.get(id)
                  return a ? { id, ...a } : null
                }).filter(Boolean) as { id: string; title: string; type: string; hasDraft: boolean }[]
                return (
                  <div key={p.id}>
                    {/* Pack header row */}
                    <div className="flex items-center gap-1 px-2 py-2 group hover:bg-gray-800 transition-colors">
                      <button onClick={() => togglePack(p.id)} className="text-gray-600 hover:text-gray-300 shrink-0">
                        {isOpen
                          ? <ChevronDown className="h-3.5 w-3.5" />
                          : <ChevronRight className="h-3.5 w-3.5" />
                        }
                      </button>
                      <Package className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/builder/packs/${p.id}`)}>
                        <p className="text-xs text-gray-200 truncate font-medium hover:text-blue-400 transition-colors">{p.name}</p>
                      </div>
                      <span className="shrink-0 flex items-center gap-1">
                        {p.status === 'draft' && (
                          <span className="text-xs text-yellow-500">draft</span>
                        )}
                        {p.hasDraft && p.status === 'published' && (
                          <span className="text-xs text-yellow-500" title="Has unsaved changes">•</span>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); setEditingPack(p) }}
                          className="p-0.5 text-gray-600 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Edit pack">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button onClick={() => handleDeletePack(p.id, p.name)}
                          className="p-0.5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete pack">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    </div>
                    {/* Expanded artifacts */}
                    {isOpen && (
                      <div className="pb-1">
                        {packArtifacts.length === 0 ? (
                          <p className="pl-9 text-xs text-gray-600 py-1">No artifacts</p>
                        ) : (
                          packArtifacts.map((a) => (
                            <div key={a.id}
                              className="flex items-center gap-1.5 pl-9 pr-3 py-1.5 hover:bg-gray-800 transition-colors cursor-pointer"
                              onClick={() => {
                                if (a.type === 'report') onSelect(a.id)
                                else if (a.type === 'note') onSelectNote(a.id)
                                else onSelectVisual(a.id)
                              }}>
                              {a.type === 'note'
                                ? <NotebookPen className="h-3 w-3 shrink-0 text-blue-400" />
                                : a.type === 'kpi' || a.type === 'chart'
                                ? <TrendingUp className="h-3 w-3 shrink-0 text-blue-400" />
                                : <FileText className="h-3 w-3 shrink-0 text-gray-600" />
                              }
                              <span className="flex-1 text-xs text-gray-400 truncate">{a.title}</span>
                              {a.hasDraft && (
                                <span className="text-xs text-yellow-500 shrink-0" title="Has unsaved changes">•</span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>
          </>
        )}
      <div className="px-3 py-3 border-t border-gray-800 shrink-0">
        <Link to="/admin"
          className="flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium
                     text-gray-500 hover:bg-gray-800 hover:text-gray-300 transition-colors">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
          Admin Portal
        </Link>
      </div>
      </aside>

      {editingPack !== null && (
        <PackEditor
          pack={editingPack === 'new' ? null : editingPack}
          onSaved={handlePackSaved}
          onClose={() => setEditingPack(null)}
        />
      )}
    </>
  )
}
