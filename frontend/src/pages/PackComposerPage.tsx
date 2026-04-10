import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import {
  ArrowLeft, Save, Upload, Plus, Trash2, ChevronUp, ChevronDown,
  FileText, NotebookPen, X, CheckCircle2, AlertCircle, LayoutTemplate, Eye, BarChart3,
  Palette, ArrowUpToLine, ArrowDownToLine, Image as ImageIcon,
} from 'lucide-react'
import { api, PickerReport, PickerNote, PickerVisual, ImageItem } from '../lib/api'
import { PackSection, PackSlot, PackPage, SectionPreset, migrateLayout } from '../types/report'

// ─── Preset definitions ────────────────────────────────────────────────────────

const PRESETS: { id: SectionPreset; label: string; widths: string[] }[] = [
  { id: 'full',                    label: '100',          widths: ['100%'] },
  { id: 'half',                    label: '50 / 50',      widths: ['50%', '50%'] },
  { id: 'two-thirds',              label: '66 / 33',      widths: ['66.67%', '33.33%'] },
  { id: 'third-two-thirds',        label: '33 / 66',      widths: ['33.33%', '66.67%'] },
  { id: 'thirds',                  label: '33 / 33 / 33', widths: ['33.33%', '33.33%', '33.33%'] },
  { id: 'quarter-three-quarters',  label: '25 / 75',      widths: ['25%', '75%'] },
  { id: 'three-quarters-quarter',  label: '75 / 25',      widths: ['75%', '25%'] },
  { id: 'quarter-half-quarter',    label: '25 / 50 / 25', widths: ['25%', '50%', '25%'] },
  { id: 'half-quarter-quarter',    label: '50 / 25 / 25', widths: ['50%', '25%', '25%'] },
  { id: 'quarters',                label: '25 / 25 / 25 / 25', widths: ['25%', '25%', '25%', '25%'] },
]

function presetWidths(preset: SectionPreset): string[] {
  return PRESETS.find((p) => p.id === preset)?.widths ?? ['100%']
}

function presetSlotCount(preset: SectionPreset): number {
  return presetWidths(preset).length
}

function emptySlot(): PackSlot {
  return { artifactType: null, artifactId: null }
}

function newSection(preset: SectionPreset = 'full'): PackSection {
  return { id: uuid(), preset, slots: Array.from({ length: presetSlotCount(preset) }, emptySlot) }
}

function newPage(): PackPage {
  return { id: uuid(), sections: [] }
}

// ─── Artifact Picker Modal ────────────────────────────────────────────────────

interface PickerModalProps {
  reports: PickerReport[]
  notes: PickerNote[]
  visuals: PickerVisual[]
  onPick: (type: 'report' | 'note' | 'visual', id: string) => void
  onClose: () => void
}

function PickerModal({ reports, notes, visuals, onPick, onClose }: PickerModalProps) {
  const [tab, setTab] = useState<'reports' | 'notes' | 'visuals'>('reports')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[440px] max-h-[520px] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <span className="text-sm font-medium text-gray-100">Add Artifact</span>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex border-b border-gray-800">
          {(['reports', 'notes', 'visuals'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors capitalize
                ${tab === t ? 'text-gray-100 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {tab === 'reports' && (
            reports.length === 0
              ? <p className="text-xs text-gray-600 text-center py-6">No published reports</p>
              : reports.map((r) => (
                <button key={r.id} onClick={() => onPick('report', r.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800 transition-colors text-left">
                  <FileText className="h-4 w-4 shrink-0 text-gray-500" />
                  <span className="flex-1 text-sm text-gray-200 truncate">{r.title}</span>
                  {r.isConfirmed
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    : <AlertCircle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />}
                </button>
              ))
          )}
          {tab === 'notes' && (
            notes.length === 0
              ? <p className="text-xs text-gray-600 text-center py-6">No published notes</p>
              : notes.map((n) => (
                <button key={n.id} onClick={() => onPick('note', n.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800 transition-colors text-left">
                  <NotebookPen className="h-4 w-4 shrink-0 text-gray-500" />
                  <span className="flex-1 text-sm text-gray-200 truncate">{n.title}</span>
                  {n.isConfirmed
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    : <AlertCircle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />}
                </button>
              ))
          )}
          {tab === 'visuals' && (
            visuals.length === 0
              ? <p className="text-xs text-gray-600 text-center py-6">No published visuals</p>
              : visuals.map((v) => (
                <button key={v.id} onClick={() => onPick('visual', v.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800 transition-colors text-left">
                  <BarChart3 className="h-4 w-4 shrink-0 text-blue-400" />
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm text-gray-200 truncate">{v.title}</span>
                    <span className="text-xs text-gray-500 capitalize">{v.visualType}</span>
                  </div>
                  {v.isConfirmed
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    : <AlertCircle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />}
                </button>
              ))
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Slot Card ────────────────────────────────────────────────────────────────

interface SlotCardProps {
  slot: PackSlot
  width: string
  reports: PickerReport[]
  notes: PickerNote[]
  visuals: PickerVisual[]
  onPlace: (type: 'report' | 'note' | 'visual', id: string) => void
  onClear: () => void
  onNoteRefChange: (ref: string) => void
}

function SlotCard({ slot, width, reports, notes, visuals, onPlace, onClear, onNoteRefChange }: SlotCardProps) {
  const [showPicker, setShowPicker] = useState(false)

  const artifact = slot.artifactId
    ? slot.artifactType === 'report'
      ? reports.find((r) => r.id === slot.artifactId)
      : slot.artifactType === 'visual'
        ? visuals.find((v) => v.id === slot.artifactId)
        : notes.find((n) => n.id === slot.artifactId)
    : null

  const title = artifact?.title ?? 'Unknown'
  const isConfirmed = artifact ? ('isConfirmed' in artifact ? artifact.isConfirmed : false) : false

  return (
    <div style={{ width }} className="min-w-0 flex-shrink-0">
      <div className="h-full border-2 border-dashed border-gray-700 rounded-lg m-1 flex flex-col items-center justify-center min-h-[120px] relative group transition-colors hover:border-gray-600">
        {slot.artifactId ? (
          <div className="w-full h-full p-3 flex flex-col gap-2">
            <div className="flex items-start gap-2">
              {slot.artifactType === 'report'
                ? <FileText className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                : slot.artifactType === 'visual'
                  ? <BarChart3 className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                  : <NotebookPen className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
              }
              <span className="flex-1 text-xs text-gray-200 font-medium leading-snug">{title}</span>
              <button onClick={onClear}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-600 hover:text-red-400 transition-all shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-1.5 mt-auto">
              <span className="text-xs text-gray-600 capitalize">{slot.artifactType}</span>
              {isConfirmed
                ? <span title="Confirmed"><CheckCircle2 className="h-3 w-3 text-emerald-400" /></span>
                : <span title="Not confirmed"><AlertCircle className="h-3 w-3 text-yellow-400" /></span>
              }
              {slot.artifactType === 'note' && (
                <input
                  type="text"
                  value={slot.noteRef ?? ''}
                  onChange={(e) => onNoteRefChange(e.target.value || '')}
                  placeholder="Ref"
                  maxLength={3}
                  title="Note reference number (e.g. 1, 2, a)"
                  className="ml-auto w-10 bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5
                             text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          </div>
        ) : (
          <button onClick={() => setShowPicker(true)}
            className="flex flex-col items-center gap-2 text-gray-700 hover:text-gray-400 transition-colors p-4">
            <Plus className="h-6 w-6" />
            <span className="text-xs">Add artifact</span>
          </button>
        )}
      </div>

      {showPicker && (
        <PickerModal
          reports={reports} notes={notes} visuals={visuals}
          onPick={(type, id) => { onPlace(type, id); setShowPicker(false) }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

// ─── Section Card ─────────────────────────────────────────────────────────────

interface SectionCardProps {
  section: PackSection
  index: number
  total: number
  pageIndex: number
  totalPages: number
  reports: PickerReport[]
  notes: PickerNote[]
  visuals: PickerVisual[]
  onChange: (s: PackSection) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onMoveToPrevPage?: () => void
  onMoveToNextPage?: () => void
  onDelete: () => void
}

function SectionCard({
  section, index, total, pageIndex, totalPages,
  reports, notes, visuals,
  onChange, onMoveUp, onMoveDown, onMoveToPrevPage, onMoveToNextPage, onDelete,
}: SectionCardProps) {
  const widths = presetWidths(section.preset)

  const changePreset = (preset: SectionPreset) => {
    const count = presetSlotCount(preset)
    const slots = Array.from({ length: count }, (_, i) => section.slots[i] ?? emptySlot())
    onChange({ ...section, preset, slots })
  }

  const updateSlot = (i: number, type: 'report' | 'note' | 'visual', id: string) => {
    const slots = section.slots.map((s, si) => si === i ? { ...s, artifactType: type, artifactId: id } : s)
    onChange({ ...section, slots })
  }

  const clearSlot = (i: number) => {
    const slots = section.slots.map((s, si) => si === i ? emptySlot() : s)
    onChange({ ...section, slots })
  }

  const updateNoteRef = (i: number, ref: string) => {
    const slots = section.slots.map((s, si) => si === i ? { ...s, noteRef: ref || null } : s)
    onChange({ ...section, slots })
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl mb-4">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800">
        <LayoutTemplate className="h-3.5 w-3.5 text-gray-600 shrink-0" />
        <span className="text-xs text-gray-500 shrink-0">Section {index + 1}</span>
        <div className="flex items-center gap-1 flex-wrap">
          {PRESETS.map((p) => (
            <button key={p.id} onClick={() => changePreset(p.id)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                section.preset === p.id
                  ? 'bg-blue-400 text-white'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {/* Move within page */}
          <button onClick={onMoveUp} disabled={index === 0}
            className="p-1 text-gray-600 hover:text-gray-300 disabled:opacity-30 transition-colors" title="Move up within page">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={onMoveDown} disabled={index === total - 1}
            className="p-1 text-gray-600 hover:text-gray-300 disabled:opacity-30 transition-colors" title="Move down within page">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {/* Move to adjacent page */}
          {totalPages > 1 && (
            <>
              <button onClick={onMoveToPrevPage} disabled={!onMoveToPrevPage || pageIndex === 0}
                className="p-1 text-gray-600 hover:text-blue-400 disabled:opacity-30 transition-colors" title="Move to previous page">
                <ArrowUpToLine className="h-3.5 w-3.5" />
              </button>
              <button onClick={onMoveToNextPage} disabled={!onMoveToNextPage || pageIndex === totalPages - 1}
                className="p-1 text-gray-600 hover:text-blue-400 disabled:opacity-30 transition-colors" title="Move to next page">
                <ArrowDownToLine className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button onClick={onDelete}
            className="p-1 text-gray-600 hover:text-red-400 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex p-1">
        {section.slots.map((slot, i) => (
          <SlotCard
            key={i}
            slot={slot}
            width={widths[i]}
            reports={reports} notes={notes} visuals={visuals}
            onPlace={(type, id) => updateSlot(i, type, id)}
            onClear={() => clearSlot(i)}
            onNoteRefChange={(ref) => updateNoteRef(i, ref)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Page Background Panel ────────────────────────────────────────────────────

interface BgPanelProps {
  page: PackPage
  images: ImageItem[]
  onChange: (updates: Partial<PackPage>) => void
  onClose: () => void
}

function BgPanel({ page, images, onChange, onClose }: BgPanelProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 mb-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-300">Page Background</span>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-300"><X className="h-3.5 w-3.5" /></button>
      </div>

      {/* Background colour */}
      <div>
        <label className="text-xs text-gray-500 mb-1.5 block">Background colour</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={page.backgroundColour ?? '#ffffff'}
            onChange={(e) => onChange({ backgroundColour: e.target.value, backgroundImage: undefined })}
            className="w-8 h-8 rounded cursor-pointer border border-gray-700 bg-transparent"
          />
          <span className="text-xs text-gray-400">{page.backgroundColour ?? 'None'}</span>
          {page.backgroundColour && (
            <button onClick={() => onChange({ backgroundColour: undefined })}
              className="text-xs text-gray-600 hover:text-gray-300">Clear</button>
          )}
        </div>
      </div>

      {/* Background image */}
      {images.length > 0 && (
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">Background image</label>
          <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
            {images.map((img) => (
              <button
                key={img.id}
                onClick={() => onChange({ backgroundImage: img.filename, backgroundColour: undefined })}
                className={`relative rounded overflow-hidden border-2 transition-colors ${
                  page.backgroundImage === img.filename ? 'border-blue-500' : 'border-gray-700 hover:border-gray-500'
                }`}
                title={img.name}
              >
                <img
                  src={`http://${window.location.hostname}:8080${img.url}`}
                  alt={img.name}
                  className="w-full h-12 object-cover"
                />
              </button>
            ))}
          </div>
          {page.backgroundImage && (
            <button onClick={() => onChange({ backgroundImage: undefined })}
              className="mt-1.5 text-xs text-gray-600 hover:text-gray-300">Clear image</button>
          )}
        </div>
      )}

      {/* Overlay */}
      <div>
        <label className="text-xs text-gray-500 mb-1.5 block">
          Overlay opacity {page.overlayOpacity !== undefined ? `(${Math.round((page.overlayOpacity) * 100)}%)` : '(none)'}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range" min={0} max={100} step={5}
            value={Math.round((page.overlayOpacity ?? 0) * 100)}
            onChange={(e) => onChange({ overlayOpacity: parseInt(e.target.value) / 100 })}
            className="flex-1"
          />
          <input
            type="color"
            value={page.overlayColour ?? '#ffffff'}
            onChange={(e) => onChange({ overlayColour: e.target.value })}
            className="w-7 h-7 rounded cursor-pointer border border-gray-700 bg-transparent"
            title="Overlay colour"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Pack Composer Page ───────────────────────────────────────────────────────

export default function PackComposerPage() {
  const { packId } = useParams<{ packId: string }>()
  const navigate = useNavigate()

  const [name, setName] = useState('Untitled Pack')
  const [description, setDescription] = useState('')
  const [pages, setPages] = useState<PackPage[]>([])
  const [reports, setReports] = useState<PickerReport[]>([])
  const [notes, setNotes] = useState<PickerNote[]>([])
  const [visuals, setVisuals] = useState<PickerVisual[]>([])
  const [images, setImages] = useState<ImageItem[]>([])
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [bgPanelPageId, setBgPanelPageId] = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }
  const markDirty = () => setIsDirty(true)

  useEffect(() => {
    if (!packId) return
    api.getPack(packId).then((p) => {
      setName(p.name)
      setDescription(p.description)
      setStatus(p.status)
      // Migrate old PackSection[] format to PackPage[]
      setPages(migrateLayout(p.layout ?? []))
      setIsDirty(false)
    }).catch(() => showToast('Failed to load pack'))

    api.pickerReports().then((d) => setReports(d.reports)).catch(() => {})
    api.pickerNotes().then((d) => setNotes(d.notes)).catch(() => {})
    api.pickerVisuals().then((d) => setVisuals(d.visuals)).catch(() => {})
    api.listImages().then((d) => setImages(d.images)).catch(() => {})
  }, [packId])

  // ── Page operations ──────────────────────────────────────────────────────────

  const addPage = () => {
    setPages((prev) => [...prev, newPage()])
    markDirty()
  }

  const deletePage = (pageId: string) => {
    if (!window.confirm('Remove this page and all its sections?')) return
    setPages((prev) => prev.filter((p) => p.id !== pageId))
    markDirty()
  }

  const updatePageBg = useCallback((pageId: string, updates: Partial<PackPage>) => {
    setPages((prev) => prev.map((p) => p.id === pageId ? { ...p, ...updates } : p))
    markDirty()
  }, [])

  // ── Section operations ───────────────────────────────────────────────────────

  const addSectionToPage = (pageId: string, preset: SectionPreset = 'full') => {
    setPages((prev) => prev.map((p) =>
      p.id === pageId ? { ...p, sections: [...p.sections, newSection(preset)] } : p
    ))
    markDirty()
  }

  const updateSectionInPage = useCallback((pageId: string, updated: PackSection) => {
    setPages((prev) => prev.map((p) =>
      p.id === pageId ? { ...p, sections: p.sections.map((s) => s.id === updated.id ? updated : s) } : p
    ))
    markDirty()
  }, [])

  const moveSectionInPage = (pageId: string, sIdx: number, dir: -1 | 1) => {
    setPages((prev) => prev.map((p) => {
      if (p.id !== pageId) return p
      const next = [...p.sections]
      const swap = sIdx + dir
      if (swap < 0 || swap >= next.length) return p
      ;[next[sIdx], next[swap]] = [next[swap], next[sIdx]]
      return { ...p, sections: next }
    }))
    markDirty()
  }

  const moveSectionToPage = (fromPageId: string, sectionId: string, dir: -1 | 1) => {
    setPages((prev) => {
      const fromIdx = prev.findIndex((p) => p.id === fromPageId)
      const toIdx = fromIdx + dir
      if (toIdx < 0 || toIdx >= prev.length) return prev
      const section = prev[fromIdx].sections.find((s) => s.id === sectionId)
      if (!section) return prev
      return prev.map((p, i) => {
        if (i === fromIdx) return { ...p, sections: p.sections.filter((s) => s.id !== sectionId) }
        if (i === toIdx) return { ...p, sections: [...p.sections, section] }
        return p
      })
    })
    markDirty()
  }

  const deleteSectionFromPage = (pageId: string, sectionId: string) => {
    if (!window.confirm('Remove this section?')) return
    setPages((prev) => prev.map((p) =>
      p.id === pageId ? { ...p, sections: p.sections.filter((s) => s.id !== sectionId) } : p
    ))
    markDirty()
  }

  // ── Save / Publish ───────────────────────────────────────────────────────────

  const buildPayload = () => ({
    name,
    description,
    statements: pages.flatMap((pg) =>
      pg.sections.flatMap((s) => s.slots.map((sl) => sl.artifactId).filter(Boolean) as string[])
    ),
    layout: pages,
  })

  const handleSaveDraft = async () => {
    if (!packId) return
    setSaving(true)
    try {
      await api.savePackDraft(packId, buildPayload())
      setIsDirty(false)
      showToast('Draft saved')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!packId) return
    setSaving(true)
    try {
      await api.publishPack(packId, buildPayload())
      setStatus('published')
      setIsDirty(false)
      showToast('Pack published')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Publish failed'
      showToast(msg)
      alert(msg)
    } finally {
      setSaving(false)
    }
  }

  // ── Sidebar summary ──────────────────────────────────────────────────────────

  const allSlots = pages.flatMap((pg) => pg.sections.flatMap((s) => s.slots)).filter((sl) => sl.artifactId)
  const placedReports = allSlots.filter((sl) => sl.artifactType === 'report')
    .map((sl) => reports.find((r) => r.id === sl.artifactId)).filter(Boolean) as PickerReport[]
  const placedNotes = allSlots.filter((sl) => sl.artifactType === 'note')
    .map((sl) => notes.find((n) => n.id === sl.artifactId)).filter(Boolean) as PickerNote[]
  const placedVisuals = allSlots.filter((sl) => sl.artifactType === 'visual')
    .map((sl) => visuals.find((v) => v.id === sl.artifactId)).filter(Boolean) as PickerVisual[]

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      {/* Top bar */}
      <header className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-3 shrink-0">
        <button onClick={() => navigate('/builder?tab=packs')}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-200 transition-colors text-xs">
          <ArrowLeft className="h-3.5 w-3.5" />
          Builder
        </button>
        <div className="w-px h-5 bg-gray-700" />
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); markDirty() }}
          className="bg-transparent text-sm font-medium text-gray-100 focus:outline-none placeholder-gray-600 min-w-0 flex-1 max-w-xs"
          placeholder="Pack name…"
        />
        {isDirty && <span className="text-yellow-500 text-xs">•</span>}
        {status === 'published' && !isDirty && (
          <span className="text-xs text-emerald-400">Published</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => navigate(`/viewer/${packId}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                       bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors">
            <Eye className="h-3.5 w-3.5" />
            View
          </button>
          <button onClick={handleSaveDraft} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                       bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-40 transition-colors">
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
          <button onClick={handlePublish} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                       bg-blue-400 hover:bg-blue-700 text-white disabled:opacity-40 transition-colors">
            <Upload className="h-3.5 w-3.5" />
            {saving ? 'Saving…' : 'Publish'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-800">
            <p className="text-xs font-medium text-gray-400">Pack Contents</p>
            <p className="text-xs text-gray-600 mt-0.5">
              {pages.length} page{pages.length !== 1 ? 's' : ''} · {allSlots.length} artifact{allSlots.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {allSlots.length === 0 && (
              <p className="text-xs text-gray-600 text-center px-3 py-6">No artifacts placed yet</p>
            )}
            {placedReports.length > 0 && (
              <>
                <p className="px-3 py-1.5 text-xs text-gray-600 font-medium uppercase tracking-wide">Reports</p>
                {placedReports.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 px-3 py-2">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                    <span className="flex-1 text-xs text-gray-400 truncate">{r.title}</span>
                    {r.isConfirmed
                      ? <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                      : <AlertCircle className="h-3 w-3 text-yellow-400 shrink-0" />}
                  </div>
                ))}
              </>
            )}
            {placedNotes.length > 0 && (
              <>
                <p className="px-3 py-1.5 text-xs text-gray-600 font-medium uppercase tracking-wide mt-1">Notes</p>
                {placedNotes.map((n) => (
                  <div key={n.id} className="flex items-center gap-2 px-3 py-2">
                    <NotebookPen className="h-3.5 w-3.5 shrink-0 text-purple-500" />
                    <span className="flex-1 text-xs text-gray-400 truncate">{n.title}</span>
                    {n.isConfirmed
                      ? <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                      : <AlertCircle className="h-3 w-3 text-yellow-400 shrink-0" />}
                  </div>
                ))}
              </>
            )}
            {placedVisuals.length > 0 && (
              <>
                <p className="px-3 py-1.5 text-xs text-gray-600 font-medium uppercase tracking-wide mt-1">Visuals</p>
                {placedVisuals.map((v) => (
                  <div key={v.id} className="flex items-center gap-2 px-3 py-2">
                    <BarChart3 className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                    <span className="flex-1 text-xs text-gray-400 truncate">{v.title}</span>
                    {v.isConfirmed
                      ? <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                      : <AlertCircle className="h-3 w-3 text-yellow-400 shrink-0" />}
                  </div>
                ))}
              </>
            )}
            {/* Page summary */}
            {pages.length > 0 && (
              <>
                <p className="px-3 py-1.5 text-xs text-gray-600 font-medium uppercase tracking-wide mt-1">Pages</p>
                {pages.map((pg, i) => (
                  <div key={pg.id} className="flex items-center gap-2 px-3 py-1.5">
                    {pg.backgroundImage
                      ? <ImageIcon className="h-3 w-3 shrink-0 text-blue-400" />
                      : pg.backgroundColour
                        ? <span className="w-3 h-3 rounded-full shrink-0 border border-gray-600" style={{ backgroundColor: pg.backgroundColour }} />
                        : <span className="w-3 h-3 rounded-full shrink-0 border border-gray-700 bg-gray-800" />
                    }
                    <span className="text-xs text-gray-500">
                      Page {i + 1} · {pg.sections.length} section{pg.sections.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </aside>

        {/* Main canvas */}
        <main className="flex-1 overflow-y-auto bg-gray-950 p-6">
          <div className="max-w-4xl mx-auto">
            {pages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-700">
                <LayoutTemplate className="h-12 w-12 mb-4" />
                <p className="text-sm mb-1">No pages yet</p>
                <p className="text-xs">Click "Add Page" to start building</p>
              </div>
            )}

            {pages.map((page, pageIdx) => (
              <div key={page.id}>
                {/* Page divider */}
                <div className="flex items-center gap-2 mb-4 mt-2">
                  <div className="flex-1 border-t border-gray-700" />
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Background preview swatch */}
                    {page.backgroundImage
                      ? <ImageIcon className="h-3 w-3 text-blue-400" />
                      : page.backgroundColour
                        ? <span className="w-3 h-3 rounded-sm border border-gray-600" style={{ backgroundColor: page.backgroundColour }} />
                        : null
                    }
                    <span className="text-xs text-gray-500 font-medium">Page {pageIdx + 1}</span>
                    <button
                      onClick={() => setBgPanelPageId(bgPanelPageId === page.id ? null : page.id)}
                      title="Page background"
                      className={`p-1 rounded transition-colors ${bgPanelPageId === page.id ? 'text-blue-400 bg-blue-900/30' : 'text-gray-600 hover:text-gray-300'}`}
                    >
                      <Palette className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => deletePage(page.id)}
                      className="p-1 text-gray-600 hover:text-red-400 transition-colors" title="Delete page">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex-1 border-t border-gray-700" />
                </div>

                {/* Background panel */}
                {bgPanelPageId === page.id && (
                  <BgPanel
                    page={page}
                    images={images}
                    onChange={(updates) => updatePageBg(page.id, updates)}
                    onClose={() => setBgPanelPageId(null)}
                  />
                )}

                {/* Sections */}
                {page.sections.length === 0 && (
                  <p className="text-xs text-gray-700 text-center py-4">No sections on this page — add one below</p>
                )}
                {page.sections.map((section, sIdx) => (
                  <SectionCard
                    key={section.id}
                    section={section}
                    index={sIdx}
                    total={page.sections.length}
                    pageIndex={pageIdx}
                    totalPages={pages.length}
                    reports={reports} notes={notes} visuals={visuals}
                    onChange={(updated) => updateSectionInPage(page.id, updated)}
                    onMoveUp={() => moveSectionInPage(page.id, sIdx, -1)}
                    onMoveDown={() => moveSectionInPage(page.id, sIdx, 1)}
                    onMoveToPrevPage={pageIdx > 0 ? () => moveSectionToPage(page.id, section.id, -1) : undefined}
                    onMoveToNextPage={pageIdx < pages.length - 1 ? () => moveSectionToPage(page.id, section.id, 1) : undefined}
                    onDelete={() => deleteSectionFromPage(page.id, section.id)}
                  />
                ))}

                {/* Add section to this page */}
                <div className="flex flex-wrap items-center gap-2 pb-6">
                  <span className="text-xs text-gray-600">Add section:</span>
                  {PRESETS.map((p) => (
                    <button key={p.id} onClick={() => addSectionToPage(page.id, p.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md
                                 bg-gray-900 border border-gray-800 text-gray-400
                                 hover:text-gray-200 hover:border-gray-700 transition-colors">
                      <Plus className="h-3 w-3" />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Add page */}
            <div className="flex justify-center py-6">
              <button onClick={addPage}
                className="flex items-center gap-2 px-5 py-2.5 text-sm rounded-lg
                           border-2 border-dashed border-gray-700 text-gray-500
                           hover:border-blue-400 hover:text-blue-400 transition-colors">
                <Plus className="h-4 w-4" />
                Add Page
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 text-gray-100
                        text-xs px-4 py-2 rounded-lg shadow-lg border border-gray-700 z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
