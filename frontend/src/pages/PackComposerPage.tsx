import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import {
  ArrowLeft, Save, Upload, Plus, Trash2, ChevronUp, ChevronDown,
  FileText, NotebookPen, X, CheckCircle2, AlertCircle, LayoutTemplate, Eye, TrendingUp,
} from 'lucide-react'
import { api, PickerReport, PickerNote, PickerVisual } from '../lib/api'
import { PackSection, PackSlot, SectionPreset } from '../types/report'

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
                    : <AlertCircle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                  }
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
                    : <AlertCircle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                  }
                </button>
              ))
          )}
          {tab === 'visuals' && (
            visuals.length === 0
              ? <p className="text-xs text-gray-600 text-center py-6">No published visuals</p>
              : visuals.map((v) => (
                <button key={v.id} onClick={() => onPick('visual', v.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800 transition-colors text-left">
                  <TrendingUp className="h-4 w-4 shrink-0 text-blue-400" />
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm text-gray-200 truncate">{v.title}</span>
                    <span className="text-xs text-gray-500 capitalize">{v.visualType}</span>
                  </div>
                  {v.isConfirmed
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    : <AlertCircle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                  }
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
          // Filled slot
          <div className="w-full h-full p-3 flex flex-col gap-2">
            <div className="flex items-start gap-2">
              {slot.artifactType === 'report'
                ? <FileText className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                : slot.artifactType === 'visual'
                  ? <TrendingUp className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
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
                  title="Note reference number — must match the superscript on the report row (e.g. 1, 2, a)"
                  className="ml-auto w-10 bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5
                             text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          </div>
        ) : (
          // Empty slot
          <button onClick={() => setShowPicker(true)}
            className="flex flex-col items-center gap-2 text-gray-700 hover:text-gray-400 transition-colors p-4">
            <Plus className="h-6 w-6" />
            <span className="text-xs">Add artifact</span>
          </button>
        )}
      </div>

      {showPicker && (
        <PickerModal
          reports={reports}
          notes={notes}
          visuals={visuals}
          onPick={(type, id) => { onPlace(type as 'report' | 'note' | 'visual', id); setShowPicker(false) }}
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
  reports: PickerReport[]
  notes: PickerNote[]
  visuals: PickerVisual[]
  onChange: (s: PackSection) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}

function SectionCard({ section, index, total, reports, notes, visuals, onChange, onMoveUp, onMoveDown, onDelete }: SectionCardProps) {
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
      {/* Section toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800">
        <LayoutTemplate className="h-3.5 w-3.5 text-gray-600 shrink-0" />
        <span className="text-xs text-gray-500 shrink-0">Section {index + 1}</span>
        <div className="flex items-center gap-1 flex-wrap">
          {PRESETS.map((p) => (
            <button key={p.id} onClick={() => changePreset(p.id)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                section.preset === p.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={onMoveUp} disabled={index === 0}
            className="p-1 text-gray-600 hover:text-gray-300 disabled:opacity-30 transition-colors">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={onMoveDown} disabled={index === total - 1}
            className="p-1 text-gray-600 hover:text-gray-300 disabled:opacity-30 transition-colors">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete}
            className="p-1 text-gray-600 hover:text-red-400 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Slots */}
      <div className="flex p-1">
        {section.slots.map((slot, i) => (
          <SlotCard
            key={i}
            slot={slot}
            width={widths[i]}
            reports={reports}
            notes={notes}
            visuals={visuals}
            onPlace={(type, id) => updateSlot(i, type, id)}
            onClear={() => clearSlot(i)}
            onNoteRefChange={(ref) => updateNoteRef(i, ref)}
          />
        ))}
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
  const [sections, setSections] = useState<PackSection[]>([])
  const [reports, setReports] = useState<PickerReport[]>([])
  const [notes, setNotes] = useState<PickerNote[]>([])
  const [visuals, setVisuals] = useState<PickerVisual[]>([])
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // Load pack + available artifacts
  useEffect(() => {
    if (!packId) return
    api.getPack(packId).then((p) => {
      setName(p.name)
      setDescription(p.description)
      setStatus(p.status)
      setSections(p.layout?.length ? p.layout : [])
      setIsDirty(false)
    }).catch(() => showToast('Failed to load pack'))

    api.pickerReports().then((d) => setReports(d.reports)).catch(() => {})
    api.pickerNotes().then((d) => setNotes(d.notes)).catch(() => {})
    api.pickerVisuals().then((d) => setVisuals(d.visuals)).catch(() => {})
  }, [packId])

  const markDirty = () => setIsDirty(true)

  const updateSection = useCallback((id: string, updated: PackSection) => {
    setSections((prev) => prev.map((s) => s.id === id ? updated : s))
    markDirty()
  }, [])

  const moveSection = (index: number, dir: -1 | 1) => {
    setSections((prev) => {
      const next = [...prev]
      const swap = next[index + dir]
      next[index + dir] = next[index]
      next[index] = swap
      return next
    })
    markDirty()
  }

  const deleteSection = (index: number) => {
    if (!window.confirm('Remove this section?')) return
    setSections((prev) => prev.filter((_, i) => i !== index))
    markDirty()
  }

  const addSection = (preset: SectionPreset = 'full') => {
    setSections((prev) => [...prev, newSection(preset)])
    markDirty()
  }

  const buildPayload = () => ({
    name,
    description,
    statements: sections.flatMap((s) => s.slots.map((sl) => sl.artifactId).filter(Boolean) as string[]),
    layout: sections,
  })

  const handleSaveDraft = async () => {
    if (!packId) return
    setSaving(true)
    try {
      await api.savePackDraft(packId, buildPayload())
      setStatus((s) => s === 'published' ? 'published' : 'draft')
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
                       bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition-colors">
            <Upload className="h-3.5 w-3.5" />
            {saving ? 'Saving…' : 'Publish'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — pack contents summary */}
        {(() => {
          const placedSlots = sections.flatMap((s) => s.slots).filter((sl) => sl.artifactId)
          const placedReports = placedSlots.filter((sl) => sl.artifactType === 'report')
            .map((sl) => reports.find((r) => r.id === sl.artifactId)).filter(Boolean) as PickerReport[]
          const placedNotes = placedSlots.filter((sl) => sl.artifactType === 'note')
            .map((sl) => notes.find((n) => n.id === sl.artifactId)).filter(Boolean) as PickerNote[]
          const placedVisuals = placedSlots.filter((sl) => sl.artifactType === 'visual')
            .map((sl) => visuals.find((v) => v.id === sl.artifactId)).filter(Boolean) as PickerVisual[]
          const isEmpty = placedReports.length === 0 && placedNotes.length === 0 && placedVisuals.length === 0

          return (
            <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-800">
                <p className="text-xs font-medium text-gray-400">Pack Contents</p>
                <p className="text-xs text-gray-600 mt-0.5">{placedSlots.length} artifact{placedSlots.length !== 1 ? 's' : ''} placed</p>
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {isEmpty && (
                  <p className="text-xs text-gray-600 text-center px-3 py-6">No artifacts placed yet</p>
                )}
                {placedReports.length > 0 && (
                  <>
                    <p className="px-3 py-1.5 text-xs text-gray-600 font-medium uppercase tracking-wide">Reports</p>
                    {placedReports.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 px-3 py-2">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                        <span className="flex-1 text-xs text-gray-400 truncate">{r.title}</span>
                        {r.isConfirmed
                          ? <span title="Confirmed"><CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" /></span>
                          : <span title="Not confirmed"><AlertCircle className="h-3 w-3 text-yellow-400 shrink-0" /></span>
                        }
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
                          ? <span title="Confirmed"><CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" /></span>
                          : <span title="Not confirmed"><AlertCircle className="h-3 w-3 text-yellow-400 shrink-0" /></span>
                        }
                      </div>
                    ))}
                  </>
                )}
                {placedVisuals.length > 0 && (
                  <>
                    <p className="px-3 py-1.5 text-xs text-gray-600 font-medium uppercase tracking-wide mt-1">Visuals</p>
                    {placedVisuals.map((v) => (
                      <div key={v.id} className="flex items-center gap-2 px-3 py-2">
                        <TrendingUp className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                        <span className="flex-1 text-xs text-gray-400 truncate">{v.title}</span>
                        {v.isConfirmed
                          ? <span title="Confirmed"><CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" /></span>
                          : <span title="Not confirmed"><AlertCircle className="h-3 w-3 text-yellow-400 shrink-0" /></span>
                        }
                      </div>
                    ))}
                  </>
                )}
              </div>
            </aside>
          )
        })()}

        {/* Main canvas */}
        <main className="flex-1 overflow-y-auto bg-gray-950 p-6">
          <div className="max-w-4xl mx-auto">
            {sections.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-700">
                <LayoutTemplate className="h-12 w-12 mb-4" />
                <p className="text-sm mb-1">No sections yet</p>
                <p className="text-xs">Add a section below to start building your pack layout</p>
              </div>
            )}

            {sections.map((section, i) => (
              <SectionCard
                key={section.id}
                section={section}
                index={i}
                total={sections.length}
                reports={reports}
                notes={notes}
                visuals={visuals}
                onChange={(updated) => updateSection(section.id, updated)}
                onMoveUp={() => moveSection(i, -1)}
                onMoveDown={() => moveSection(i, 1)}
                onDelete={() => deleteSection(i)}
              />
            ))}

            {/* Add section */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-xs text-gray-600">Add section:</span>
              {PRESETS.map((p) => (
                <button key={p.id} onClick={() => addSection(p.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md
                             bg-gray-900 border border-gray-800 text-gray-400
                             hover:text-gray-200 hover:border-gray-700 transition-colors">
                  <Plus className="h-3 w-3" />
                  {p.label}
                </button>
              ))}
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
