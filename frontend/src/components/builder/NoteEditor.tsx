import { useEffect, useState, useCallback, useRef } from 'react'
import { v4 as uuid } from 'uuid'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Highlight } from '@tiptap/extension-highlight'
import { TextAlign } from '@tiptap/extension-text-align'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Undo, Redo, Highlighter,
  Save, Trash2, ArrowLeft, ShieldCheck, CheckCircle2, Unlock,
  Plus, X, ChevronUp, ChevronDown, Type, Image as ImageIcon,
  TrendingUp, FileText, Palette, AlertTriangle, Send,
} from 'lucide-react'
import { api, PickerReport, PickerVisual, ImageItem, RawDataset } from '../../lib/api'
import {
  NoteDefinition, NoteSection, NoteSlot, NoteSlotType,
  SectionPreset, parseNoteContent, VisualDefinition,
} from '../../types/report'
import VisualRenderer from '../shared/VisualRenderer'
import ReportRenderer from '../shared/ReportRenderer'

// ─── Preset definitions ────────────────────────────────────────────────────────

const PRESETS: { id: SectionPreset; label: string; widths: string[]; slots: number }[] = [
  { id: 'full',             label: '100',          widths: ['100%'],                        slots: 1 },
  { id: 'half',             label: '50/50',         widths: ['50%','50%'],                   slots: 2 },
  { id: 'two-thirds',       label: '66/33',         widths: ['66.67%','33.33%'],             slots: 2 },
  { id: 'third-two-thirds', label: '33/66',         widths: ['33.33%','66.67%'],             slots: 2 },
  { id: 'thirds',           label: '33/33/33',      widths: ['33.33%','33.33%','33.33%'],    slots: 3 },
]

function presetWidths(preset: SectionPreset): string[] {
  return PRESETS.find((p) => p.id === preset)?.widths ?? ['100%']
}

function emptySlot(): NoteSlot {
  return { id: uuid(), type: 'text', html: '' }
}

function newSection(preset: SectionPreset = 'full'): NoteSection {
  const count = PRESETS.find((p) => p.id === preset)?.slots ?? 1
  return { id: uuid(), preset, slots: Array.from({ length: count }, emptySlot) }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLOURS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#000000']
const HIGHLIGHTS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa']
const CARD_BG_SWATCHES = ['#ffffff', '#f8fafc', '#eff6ff', '#f0fdf4', '#fefce8', '#fdf4ff', '#fff1f2', '#1e293b']
// Approximate max card height in px — used for overflow warning
const CARD_MAX_HEIGHT = 680

// ─── Tiptap text slot editor ──────────────────────────────────────────────────

function TextSlotEditor({
  html, onChange,
}: { html: string; onChange: (html: string) => void }) {
  const [showColour, setShowColour] = useState(false)
  const [showHighlight, setShowHighlight] = useState(false)
  const colourRef = useRef<HTMLDivElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: html,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: { class: 'prose prose-sm max-w-none focus:outline-none min-h-[80px] p-3 text-gray-900' },
    },
  })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!colourRef.current?.contains(e.target as Node)) setShowColour(false)
      if (!highlightRef.current?.contains(e.target as Node)) setShowHighlight(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!editor) return null

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Mini toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1 bg-gray-50 border-b border-gray-200 flex-wrap">
        {[
          { cmd: () => editor.chain().focus().undo().run(), icon: <Undo className="h-3 w-3" />, title: 'Undo' },
          { cmd: () => editor.chain().focus().redo().run(), icon: <Redo className="h-3 w-3" />, title: 'Redo' },
        ].map((b, i) => (
          <button key={i} onMouseDown={(e) => { e.preventDefault(); b.cmd() }}
            title={b.title}
            className="p-1 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-200 transition-colors">
            {b.icon}
          </button>
        ))}
        <div className="w-px h-3 bg-gray-300 mx-0.5" />
        {([1,2,3] as const).map((l) => (
          <button key={l} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: l }).run() }}
            title={`H${l}`}
            className={`p-1 rounded transition-colors text-xs font-bold ${editor.isActive('heading',{level:l}) ? 'bg-blue-400 text-white' : 'text-gray-500 hover:bg-gray-200'}`}>
            H{l}
          </button>
        ))}
        <div className="w-px h-3 bg-gray-300 mx-0.5" />
        <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run() }}
          className={`p-1 rounded transition-colors ${editor.isActive('bold') ? 'bg-blue-400 text-white' : 'text-gray-500 hover:bg-gray-200'}`}>
          <Bold className="h-3 w-3" />
        </button>
        <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }}
          className={`p-1 rounded transition-colors ${editor.isActive('italic') ? 'bg-blue-400 text-white' : 'text-gray-500 hover:bg-gray-200'}`}>
          <Italic className="h-3 w-3" />
        </button>
        <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run() }}
          className={`p-1 rounded transition-colors ${editor.isActive('underline') ? 'bg-blue-400 text-white' : 'text-gray-500 hover:bg-gray-200'}`}>
          <UnderlineIcon className="h-3 w-3" />
        </button>
        <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleStrike().run() }}
          className={`p-1 rounded transition-colors ${editor.isActive('strike') ? 'bg-blue-400 text-white' : 'text-gray-500 hover:bg-gray-200'}`}>
          <Strikethrough className="h-3 w-3" />
        </button>
        <div className="w-px h-3 bg-gray-300 mx-0.5" />
        {/* Text colour */}
        <div className="relative" ref={colourRef}>
          <button onMouseDown={(e) => { e.preventDefault(); setShowColour(!showColour); setShowHighlight(false) }}
            className="p-1 rounded text-gray-500 hover:bg-gray-200 transition-colors flex flex-col items-center">
            <span className="text-xs font-bold leading-none" style={{ color: editor.getAttributes('textStyle').color || '#1f2937' }}>A</span>
          </button>
          {showColour && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg p-1.5 flex gap-1 shadow-xl">
              {COLOURS.map((c) => (
                <button key={c} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setColor(c).run(); setShowColour(false) }}
                  className="w-4 h-4 rounded-full border border-gray-300 hover:scale-110 transition-transform"
                  style={{ backgroundColor: c }} />
              ))}
              <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetColor().run(); setShowColour(false) }}
                className="w-4 h-4 rounded-full border border-gray-300 bg-gray-100 text-gray-500 text-xs flex items-center justify-center">×</button>
            </div>
          )}
        </div>
        {/* Highlight */}
        <div className="relative" ref={highlightRef}>
          <button onMouseDown={(e) => { e.preventDefault(); setShowHighlight(!showHighlight); setShowColour(false) }}
            className={`p-1 rounded transition-colors ${editor.isActive('highlight') ? 'bg-yellow-400' : 'text-gray-500 hover:bg-gray-200'}`}>
            <Highlighter className="h-3 w-3" />
          </button>
          {showHighlight && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg p-1.5 flex gap-1 shadow-xl">
              {HIGHLIGHTS.map((c) => (
                <button key={c} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setHighlight({ color: c }).run(); setShowHighlight(false) }}
                  className="w-4 h-4 rounded border border-gray-300 hover:scale-110 transition-transform"
                  style={{ backgroundColor: c }} />
              ))}
              <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetHighlight().run(); setShowHighlight(false) }}
                className="w-4 h-4 rounded border border-gray-300 bg-gray-100 text-xs flex items-center justify-center">×</button>
            </div>
          )}
        </div>
        <div className="w-px h-3 bg-gray-300 mx-0.5" />
        <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run() }}
          className={`p-1 rounded transition-colors ${editor.isActive('bulletList') ? 'bg-blue-400 text-white' : 'text-gray-500 hover:bg-gray-200'}`}>
          <List className="h-3 w-3" />
        </button>
        <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run() }}
          className={`p-1 rounded transition-colors ${editor.isActive('orderedList') ? 'bg-blue-400 text-white' : 'text-gray-500 hover:bg-gray-200'}`}>
          <ListOrdered className="h-3 w-3" />
        </button>
        <div className="w-px h-3 bg-gray-300 mx-0.5" />
        {(['left','center','right'] as const).map((align) => (
          <button key={align} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setTextAlign(align).run() }}
            className={`p-1 rounded transition-colors ${editor.isActive({textAlign:align}) ? 'bg-blue-400 text-white' : 'text-gray-500 hover:bg-gray-200'}`}>
            {align === 'left' ? <AlignLeft className="h-3 w-3" /> : align === 'center' ? <AlignCenter className="h-3 w-3" /> : <AlignRight className="h-3 w-3" />}
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

// ─── Slot editor ──────────────────────────────────────────────────────────────

function SlotEditor({
  slot, images, reports, visuals, onChange, visualData = {}, reportData = {}, fetchReportData, fetchVisualData,
}: {
  slot: NoteSlot
  images: ImageItem[]
  reports: PickerReport[]
  visuals: PickerVisual[]
  onChange: (s: NoteSlot) => void
  visualData?: Record<string, { definition: VisualDefinition; dataset: RawDataset | null }>
  reportData?: Record<string, { definition: unknown; dataset: RawDataset | null }>
  fetchReportData?: (reportId: string) => void
  fetchVisualData?: (visualId: string) => void
}) {
  const BASE = `http://${window.location.hostname}:8080`

  if (!slot.type || (slot.type === 'text' && slot.html === '' && !slot.imageFilename && !slot.visualId && !slot.reportId)) {
    // Type picker
    const types: { type: NoteSlotType; icon: React.ReactNode; label: string }[] = [
      { type: 'text',   icon: <Type className="h-5 w-5" />,      label: 'Text' },
      { type: 'image',  icon: <ImageIcon className="h-5 w-5" />, label: 'Image' },
      { type: 'visual', icon: <TrendingUp className="h-5 w-5" />, label: 'Visual' },
      { type: 'report', icon: <FileText className="h-5 w-5" />,  label: 'Report' },
    ]
    return (
      <div className="h-full min-h-[100px] border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center gap-4 p-4">
        {types.map((t) => (
          <button key={t.type}
            onClick={() => onChange({ ...slot, type: t.type, html: t.type === 'text' ? ' ' : undefined })}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-50 transition-colors">
            {t.icon}
            <span className="text-xs font-medium">{t.label}</span>
          </button>
        ))}
      </div>
    )
  }

  if (slot.type === 'text') {
    return (
      <TextSlotEditor
        html={slot.html ?? ''}
        onChange={(html) => onChange({ ...slot, html })}
      />
    )
  }

  if (slot.type === 'image') {
    const WIDTH_OPTIONS = [
      { value: '100%', label: 'Full' },
      { value: '75%', label: '75%' },
      { value: '50%', label: '50%' },
      { value: '200px', label: '200px' },
      { value: '300px', label: '300px' },
      { value: '400px', label: '400px' },
    ]

    if (slot.imageFilename) {
      return (
        <div className="relative group rounded-lg overflow-hidden border border-gray-200">
          <img src={`${BASE}/images/${slot.imageFilename}`} alt={slot.imageName ?? ''}
            className="w-full object-cover" style={{ width: slot.imageWidth || '100%', height: slot.imageWidth ? undefined : 'auto' }} />
          <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <select value={slot.imageWidth || '100%'} onChange={(e) => onChange({ ...slot, imageWidth: e.target.value })}
              className="text-xs bg-white/90 rounded px-1 py-0.5 border border-gray-300 text-gray-700">
              {WIDTH_OPTIONS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </div>
          <button onClick={() => onChange({ ...slot, imageFilename: undefined, imageName: undefined, imageWidth: undefined })}
            className="absolute top-2 right-2 p-1 bg-white/80 rounded-full text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )
    }
    return (
      <div className="min-h-[100px] border-2 border-dashed border-gray-300 rounded-lg p-3">
        <p className="text-xs text-gray-500 font-medium mb-2">Pick image from library</p>
        {images.length === 0
          ? <p className="text-xs text-gray-400">No images uploaded yet — use the Images tab in the builder sidebar</p>
          : <div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto">
              {images.map((img) => (
                <button key={img.id}
                  onClick={() => onChange({ ...slot, imageFilename: img.filename, imageName: img.name, imageWidth: '100%' })}
                  className="rounded overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors"
                  title={img.name}>
                  <img src={`${BASE}${img.url}`} alt={img.name} className="w-full h-14 object-cover" />
                </button>
              ))}
            </div>
        }
      </div>
    )
  }

  if (slot.type === 'visual') {
    const WIDTH_OPTIONS = [
      { value: '100%', label: 'Full' },
      { value: '75%', label: '75%' },
      { value: '50%', label: '50%' },
      { value: '200px', label: '200px' },
      { value: '300px', label: '300px' },
      { value: '400px', label: '400px' },
    ]

    if (slot.visualId) {
      const data = visualData[slot.visualId]
      return (
        <div className="relative group" style={{ width: slot.visualWidth || '100%' }}>
          {data && data.dataset ? (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <VisualRenderer definition={data.definition} dataset={data.dataset} />
            </div>
          ) : data ? (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <TrendingUp className="h-4 w-4 text-blue-400 shrink-0" />
              <span className="flex-1 text-sm text-gray-700 truncate">{slot.visualTitle ?? slot.visualId}</span>
              <span className="text-xs text-gray-400">No data</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <TrendingUp className="h-4 w-4 text-blue-400 shrink-0" />
              <span className="flex-1 text-sm text-gray-700 truncate">{slot.visualTitle ?? slot.visualId}</span>
              <span className="text-xs text-gray-400">Loading...</span>
            </div>
          )}
          <div className="absolute top-2 right-10 flex gap-1">
            <select value={slot.visualWidth || '100%'} onChange={(e) => onChange({ ...slot, visualWidth: e.target.value })}
              className="text-xs bg-white/90 rounded px-1 py-0.5 border border-gray-300 text-gray-700">
              {WIDTH_OPTIONS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </div>
          <button onClick={() => onChange({ ...slot, visualId: undefined, visualTitle: undefined, visualWidth: undefined })}
            className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )
    }
    return (
      <div className="min-h-[100px] border-2 border-dashed border-gray-300 rounded-lg p-3">
        <p className="text-xs text-gray-500 font-medium mb-2">Pick visual</p>
        {visuals.length === 0
          ? <p className="text-xs text-gray-400">No published visuals available</p>
          : <div className="space-y-1 max-h-48 overflow-y-auto">
              {visuals.map((v) => (
                <button key={v.id}
                  onClick={() => {
                    onChange({ ...slot, visualId: v.id, visualTitle: v.title, visualWidth: '100%' })
                    fetchVisualData?.(v.id)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 rounded-md transition-colors">
                  <TrendingUp className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  <span className="text-xs text-gray-700 truncate">{v.title}</span>
                </button>
              ))}
            </div>
        }
      </div>
    )
  }

  if (slot.type === 'report') {
    const WIDTH_OPTIONS = [
      { value: '100%', label: 'Full' },
      { value: '75%', label: '75%' },
      { value: '50%', label: '50%' },
      { value: '200px', label: '200px' },
      { value: '300px', label: '300px' },
      { value: '400px', label: '400px' },
    ]

    if (slot.reportId) {
      const data = reportData?.[slot.reportId]
      return (
        <div className="relative group" style={{ width: slot.reportWidth || '100%' }}>
          {data && data.dataset ? (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <ReportRenderer definition={data.definition as any} dataset={data.dataset} />
            </div>
          ) : data ? (
            <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <FileText className="h-4 w-4 text-gray-500 shrink-0" />
              <span className="flex-1 text-sm text-gray-700 truncate">{slot.reportTitle ?? slot.reportId}</span>
              <span className="text-xs text-gray-400">No data</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <FileText className="h-4 w-4 text-gray-500 shrink-0" />
              <span className="flex-1 text-sm text-gray-700 truncate">{slot.reportTitle ?? slot.reportId}</span>
              <span className="text-xs text-gray-400">Loading...</span>
            </div>
          )}
          <div className="absolute top-2 left-2 flex gap-1">
            <select value={slot.reportWidth || '100%'} onChange={(e) => onChange({ ...slot, reportWidth: e.target.value })}
              className="text-xs bg-white/90 rounded px-1 py-0.5 border border-gray-300 text-gray-700">
              {WIDTH_OPTIONS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </div>
          <button onClick={() => onChange({ ...slot, reportId: undefined, reportTitle: undefined, reportWidth: undefined })}
            className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )
    }
    return (
      <div className="min-h-[100px] border-2 border-dashed border-gray-300 rounded-lg p-3">
        <p className="text-xs text-gray-500 font-medium mb-2">Pick published report</p>
        {reports.length === 0
          ? <p className="text-xs text-gray-400">No published reports available</p>
          : <div className="space-y-1 max-h-48 overflow-y-auto">
              {reports.map((r) => (
                <button key={r.id}
                  onClick={() => {
                    onChange({ ...slot, reportId: r.id, reportTitle: r.title, reportWidth: '100%' })
                    fetchReportData?.(r.id)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 rounded-md transition-colors">
                  <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-700 truncate">{r.title}</span>
                </button>
              ))}
            </div>
        }
      </div>
    )
  }

  return null
}

// ─── Section editor ───────────────────────────────────────────────────────────

function SectionEditor({
  section, index, total, images, reports, visuals, onChange, onMoveUp, onMoveDown, onDelete, visualData = {}, reportData = {}, fetchReportData, fetchVisualData,
}: {
  section: NoteSection
  index: number
  total: number
  images: ImageItem[]
  reports: PickerReport[]
  visuals: PickerVisual[]
  onChange: (s: NoteSection) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  visualData?: Record<string, { definition: VisualDefinition; dataset: RawDataset | null }>
  reportData?: Record<string, { definition: unknown; dataset: RawDataset | null }>
  fetchReportData?: (reportId: string) => void
  fetchVisualData?: (visualId: string) => void
}) {
  const widths = presetWidths(section.preset)

  const changePreset = (preset: SectionPreset) => {
    const count = PRESETS.find((p) => p.id === preset)?.slots ?? 1
    const slots = Array.from({ length: count }, (_, i) => section.slots[i] ?? emptySlot())
    onChange({ ...section, preset, slots })
  }

  const updateSlot = (i: number, updated: NoteSlot) => {
    const slots = section.slots.map((s, si) => si === i ? updated : s)
    onChange({ ...section, slots })
  }

  return (
    <div className="mb-4 group/section">
      {/* Section toolbar */}
      <div className="flex items-center gap-1.5 mb-1.5 opacity-0 group-hover/section:opacity-100 transition-opacity">
        <span className="text-xs text-gray-400">Layout:</span>
        {PRESETS.map((p) => (
          <button key={p.id} onClick={() => changePreset(p.id)}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              section.preset === p.id ? 'bg-blue-400 text-white' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
            }`}>
            {p.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-0.5">
          <button onClick={onMoveUp} disabled={index === 0}
            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={onMoveDown} disabled={index === total - 1}
            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Slots */}
      <div className="flex gap-3">
        {section.slots.map((slot, i) => (
          <div key={slot.id} style={{ width: widths[i] }} className="min-w-0 flex-shrink-0">
            <SlotEditor
              slot={slot}
              images={images}
              reports={reports}
              visuals={visuals}
              onChange={(updated) => updateSlot(i, updated)}
              visualData={visualData}
              reportData={reportData}
              fetchReportData={fetchReportData}
              fetchVisualData={fetchVisualData}
            />
          </div>
        ))}
      </div>

      {/* Sub-sections */}
      {section.subsections && section.subsections.length > 0 && (
        <div className="mt-2 pl-4 border-l-2 border-gray-200">
          {section.subsections.map((sub, si) => (
            <SectionEditor
              key={sub.id}
              section={sub}
              index={si}
              total={section.subsections!.length}
              images={images}
              reports={reports}
              visuals={visuals}
              onChange={(updated) => {
                const newSubs = [...(section.subsections ?? [])]
                newSubs[si] = updated
                onChange({ ...section, subsections: newSubs })
              }}
              onMoveUp={() => {
                if (si === 0) return
                const newSubs = [...(section.subsections ?? [])]
                ;[newSubs[si - 1], newSubs[si]] = [newSubs[si], newSubs[si - 1]]
                onChange({ ...section, subsections: newSubs })
              }}
              onMoveDown={() => {
                const newSubs = section.subsections ?? []
                if (si === newSubs.length - 1) return
                ;[newSubs[si], newSubs[si + 1]] = [newSubs[si + 1], newSubs[si]]
                onChange({ ...section, subsections: newSubs })
              }}
              onDelete={() => {
                onChange({ ...section, subsections: section.subsections?.filter((_, i) => i !== si) })
              }}
              visualData={visualData}
              reportData={reportData}
              fetchReportData={fetchReportData}
              fetchVisualData={fetchVisualData}
            />
          ))}
        </div>
      )}

      {/* Add sub-section button */}
      {!section.subsections && (
        <div className="mt-1 pl-4">
          <button
            onClick={() => onChange({ ...section, subsections: [newSection('full')] })}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-blue-400 border border-dashed border-gray-300 hover:border-blue-400 rounded transition-colors">
            <Plus className="h-3 w-3" />
            Add sub-section
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main NoteEditor ──────────────────────────────────────────────────────────

interface Props {
  noteId: string
  initialIsConfirmed?: boolean
  initialConfirmedAt?: string
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

export default function NoteEditor({ noteId, initialIsConfirmed = false, initialConfirmedAt, onClose, onSaved, onDeleted }: Props) {
  const [title, setTitle] = useState('Untitled Note')
  const [definition, setDefinition] = useState<NoteDefinition>({ sections: [] })
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isDirty, setIsDirty] = useState(false)
  const [_status, setStatus] = useState<'draft' | 'published'>('draft')
  const [isConfirmed, setIsConfirmed] = useState(initialIsConfirmed)
  const [confirmedAt, setConfirmedAt] = useState<string | null>(initialConfirmedAt ?? null)
  const [readyToConfirm, setReadyToConfirm] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showBgPicker, setShowBgPicker] = useState(false)
  const [overflow, setOverflow] = useState(false)
  const [images, setImages] = useState<ImageItem[]>([])
  const [reports, setReports] = useState<PickerReport[]>([])
  const [visuals, setVisuals] = useState<PickerVisual[]>([])
  const [visualData, setVisualData] = useState<Record<string, { definition: VisualDefinition; dataset: RawDataset | null }>>({})
  const [reportData, setReportData] = useState<Record<string, { definition: unknown; dataset: RawDataset | null }>>({})

  const cardRef = useRef<HTMLDivElement>(null)
  const bgPickerRef = useRef<HTMLDivElement>(null)

  // Close bg picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!bgPickerRef.current?.contains(e.target as Node)) setShowBgPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Overflow detection
  useEffect(() => {
    if (!cardRef.current) return
    const obs = new ResizeObserver(() => {
      if (cardRef.current) setOverflow(cardRef.current.scrollHeight > CARD_MAX_HEIGHT)
    })
    obs.observe(cardRef.current)
    return () => obs.disconnect()
  }, [definition])

  // Load note + picker data
  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.getNote(noteId),
      api.pickerReports().then((d) => d.reports).catch(() => [] as PickerReport[]),
      api.pickerVisuals().then((d) => d.visuals).catch(() => [] as PickerVisual[]),
      api.listImages().then((d) => d.images).catch(() => [] as ImageItem[]),
    ]).then(([note, reps, vis, imgs]) => {
      setTitle(note.title)
      setStatus(note.status as 'draft' | 'published')
      setDefinition(parseNoteContent(note.content || ''))
      setIsConfirmed(note.isConfirmed || false)
      setReadyToConfirm(note.readyToConfirm || false)
      setReports(reps)
      setVisuals(vis)
      setImages(imgs)
      setIsDirty(false)
      const noteDef = parseNoteContent(note.content || '')

      // Pre-fetch all visual and report definitions used in the note
      noteDef.sections.forEach((section: any) => {
        section.slots.forEach((slot: any) => {
          if (slot.visualId && !visualData[slot.visualId]) {
            api.getVisual(slot.visualId, true).then((v: any) => {
              setVisualData((prev: any) => ({ ...prev, [slot.visualId!]: { definition: v.definition as VisualDefinition, dataset: null } }))
              if (v.definition.cube && v.definition.view) {
                api.getDataset(v.definition.cube, v.definition.view, v.definition.context || []).then((ds: RawDataset) => {
                  setVisualData((prev: any) => ({ ...prev, [slot.visualId!]: { ...prev[slot.visualId!], dataset: ds } }))
                })
              }
            })
          }
          if (slot.reportId && !reportData[slot.reportId]) {
            api.getPublishedReport(slot.reportId).then((r: any) => {
              setReportData((prev: any) => ({ ...prev, [slot.reportId!]: { definition: r.definition, dataset: r.dataset } }))
            }).catch(() => {})
          }
        })
        if (section.subsections) {
          section.subsections.forEach((sub: any) => {
            sub.slots.forEach((slot: any) => {
              if (slot.visualId && !visualData[slot.visualId]) {
                api.getVisual(slot.visualId, true).then((v: any) => {
                  setVisualData((prev: any) => ({ ...prev, [slot.visualId!]: { definition: v.definition as VisualDefinition, dataset: null } }))
                })
              }
              if (slot.reportId && !reportData[slot.reportId]) {
                api.getPublishedReport(slot.reportId).then((r: any) => {
                  setReportData((prev: any) => ({ ...prev, [slot.reportId!]: { definition: r.definition, dataset: r.dataset } }))
                })
              }
            })
          })
        }
      })
    }).catch(() => {}).finally(() => setLoading(false))
  }, [noteId])

  const markDirty = () => setIsDirty(true)

  const updateDefinition = useCallback((updates: Partial<NoteDefinition>) => {
    setDefinition((prev) => ({ ...prev, ...updates }))
    markDirty()
  }, [])

  const addSection = (preset: SectionPreset = 'full') => {
    setDefinition((prev) => ({ ...prev, sections: [...prev.sections, newSection(preset)] }))
    markDirty()
  }

  const updateSection = useCallback((id: string, updated: NoteSection) => {
    setDefinition((prev) => ({ ...prev, sections: prev.sections.map((s) => s.id === id ? updated : s) }))
    markDirty()
  }, [])

  const moveSection = (idx: number, dir: -1 | 1) => {
    setDefinition((prev) => {
      const next = [...prev.sections]
      const swap = idx + dir
      if (swap < 0 || swap >= next.length) return prev
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return { ...prev, sections: next }
    })
    markDirty()
  }

  const fetchReportData = useCallback((reportId: string) => {
    api.getPublishedReport(reportId).then((r: any) => {
      setReportData((prev: any) => ({ ...prev, [reportId]: { definition: r.definition, dataset: r.dataset } }))
    })
  }, [])

  const fetchVisualData = useCallback((visualId: string) => {
    api.getVisual(visualId, true).then((v: any) => {
      setVisualData((prev: any) => ({ ...prev, [visualId]: { definition: v.definition as VisualDefinition, dataset: null } }))
      if (v.definition.cube && v.definition.view) {
        api.getDataset(v.definition.cube, v.definition.view, v.definition.context || []).then((ds: RawDataset) => {
          setVisualData((prev: any) => ({ ...prev, [visualId]: { ...prev[visualId], dataset: ds } }))
        })
      }
    })
  }, [])

  const deleteSection = (id: string) => {
    setDefinition((prev) => ({ ...prev, sections: prev.sections.filter((s) => s.id !== id) }))
    markDirty()
  }

  const contentString = () => JSON.stringify(definition)

  const handleSaveDraft = useCallback(async () => {
    setSaving(true)
    try {
      await api.saveNoteDraft(noteId, title, contentString())
      setIsDirty(false)
      setIsConfirmed(false)
      onSaved()
    } catch {
      alert('Save failed — check backend is running')
    } finally {
      setSaving(false)
    }
  }, [noteId, title, definition, onSaved])

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      const r = await api.confirmNote(noteId)
      setIsConfirmed(true)
      setReadyToConfirm(false)
      setConfirmedAt(r.confirmedAt)
      setShowConfirmDialog(false)
      onSaved()
    } catch {
      alert('Confirm failed — check backend is running')
    } finally {
      setConfirming(false)
    }
  }

  const handleSubmitForConfirm = async () => {
    setSaving(true)
    try {
      await api.submitNoteForConfirm(noteId)
      setReadyToConfirm(true)
      onSaved()
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Submit failed — check backend is running')
    } finally {
      setSaving(false)
    }
  }

  const handleRelease = async () => {
    if (!window.confirm('Release this note? It will become editable and require re-confirmation.')) return
    try {
      await api.releaseNote(noteId)
      setIsConfirmed(false)
      setReadyToConfirm(false)
      setIsDirty(true)
      onSaved()
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Release failed')
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete note "${title}"? This cannot be undone.`)) return
    try {
      await api.deleteNote(noteId)
      onDeleted()
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Delete failed')
    }
  }

  if (loading) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950">
      {/* Top bar */}
      <div className="h-11 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-3 shrink-0">
        <button onClick={onClose} title="Back"
          className="p-2 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>

        <input
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value); markDirty() }}
          className="flex-1 bg-transparent text-gray-100 text-sm font-medium focus:outline-none placeholder-gray-600 min-w-0"
          placeholder="Note title…"
        />

        {isDirty && <span className="text-yellow-500 text-xs shrink-0">•</span>}
        {overflow && (
          <span title="Content may overflow one page" className="flex items-center gap-1 text-yellow-500 text-xs shrink-0">
            <AlertTriangle className="h-3.5 w-3.5" />
            Overflow
          </span>
        )}
        {isConfirmed && (
          <span title={`Confirmed ${confirmedAt ? new Date(confirmedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}`}>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          </span>
        )}

        {/* Card background picker */}
        <div className="relative" ref={bgPickerRef}>
          <button
            onClick={() => setShowBgPicker(!showBgPicker)}
            title="Card background colour"
            className="p-2 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors flex items-center gap-1">
            <Palette className="h-4 w-4" />
            {definition.cardBackground && (
              <span className="w-3 h-3 rounded-full border border-gray-600" style={{ backgroundColor: definition.cardBackground }} />
            )}
          </button>
          {showBgPicker && (
            <div className="absolute top-full right-0 mt-1 z-50 bg-gray-800 border border-gray-700 rounded-lg p-2 flex gap-1.5 shadow-xl">
              {CARD_BG_SWATCHES.map((c) => (
                <button key={c}
                  onClick={() => { updateDefinition({ cardBackground: c }); setShowBgPicker(false) }}
                  className={`w-6 h-6 rounded border-2 hover:scale-110 transition-transform ${definition.cardBackground === c ? 'border-blue-400' : 'border-gray-600'}`}
                  style={{ backgroundColor: c }}
                  title={c} />
              ))}
              {definition.cardBackground && (
                <button onClick={() => { updateDefinition({ cardBackground: undefined }); setShowBgPicker(false) }}
                  className="w-6 h-6 rounded border border-gray-600 bg-gray-700 text-gray-300 text-xs flex items-center justify-center hover:bg-gray-600">×</button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button onClick={handleSaveDraft} disabled={saving} title="Save Draft"
            className="p-2 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-800 disabled:opacity-30 transition-colors">
            <Save className="h-4 w-4" />
          </button>
          {!isConfirmed && !readyToConfirm && (
            <button onClick={handleSubmitForConfirm} disabled={saving || isDirty} title="Submit for Confirm"
              className="p-2 rounded text-blue-400 hover:text-blue-300 hover:bg-blue-900/50 disabled:opacity-30 transition-colors">
              <Send className="h-4 w-4" />
            </button>
          )}
          {readyToConfirm && !isConfirmed && (
            <button onClick={() => setShowConfirmDialog(true)} disabled={saving || confirming || isDirty}
              title="Confirm"
              className="p-2 rounded text-blue-400 hover:text-blue-300 hover:bg-blue-900/50 disabled:opacity-30 transition-colors">
              <ShieldCheck className="h-4 w-4" />
            </button>
          )}
          {isConfirmed && (
            <button onClick={handleRelease} disabled={saving} title="Release"
              className="p-2 rounded text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/50 disabled:opacity-30 transition-colors">
              <Unlock className="h-4 w-4" />
            </button>
          )}
          {isConfirmed && (
            <button onClick={() => setShowConfirmDialog(true)} disabled={saving || confirming || isDirty}
              title="Re-confirm"
              className="p-2 rounded text-emerald-400 hover:bg-emerald-900/50 disabled:opacity-30 transition-colors">
              <ShieldCheck className="h-4 w-4" />
            </button>
          )}
          <button onClick={handleDelete} title="Delete"
            className="p-2 rounded text-red-400 hover:text-red-300 hover:bg-red-900/50 transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto bg-gray-200 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Overflow warning banner */}
          {overflow && (
            <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-yellow-100 border border-yellow-300 rounded-lg text-yellow-800 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Content is taller than one page. Viewers may see this note clipped when displayed in a pack.
            </div>
          )}

          {/* Note card */}
          <div
            ref={cardRef}
            className="bg-white rounded-xl shadow-2xl overflow-hidden"
            style={{ backgroundColor: definition.cardBackground ?? '#ffffff' }}
          >
            <div className="p-6 space-y-0">
              {/* Note title inside card */}
              {title && title !== 'Untitled Note' && (
                <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
              )}

              {(!definition.sections || definition.sections.length === 0) && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Plus className="h-8 w-8 mb-2" />
                  <p className="text-sm">Add a section below to start building this note</p>
                </div>
              )}

              {(definition.sections ?? []).map((section, i) => (
                <SectionEditor
                  key={section.id}
                  section={section}
                  index={i}
                  total={(definition.sections ?? []).length}
                  images={images}
                  reports={reports}
                  visuals={visuals}
                  onChange={(updated) => updateSection(section.id, updated)}
                  onMoveUp={() => moveSection(i, -1)}
                  onMoveDown={() => moveSection(i, 1)}
                  onDelete={() => deleteSection(section.id)}
                  visualData={visualData}
                  reportData={reportData}
                  fetchReportData={fetchReportData}
                  fetchVisualData={fetchVisualData}
                />
              ))}
            </div>
          </div>

          {/* Add section */}
          <div className="mt-4 flex flex-wrap items-center gap-2 justify-center">
            <span className="text-xs text-gray-500">Add section:</span>
            {PRESETS.map((p) => (
              <button key={p.id} onClick={() => addSection(p.id)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md
                           bg-gray-900 border border-gray-700 text-gray-400
                           hover:text-gray-200 hover:border-gray-600 transition-colors">
                <Plus className="h-3 w-3" />
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Confirm dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[440px] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
              <h2 className="text-sm font-semibold text-gray-100">Confirm Commentary</h2>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">By confirming you attest that:</p>
            <ul className="text-xs text-gray-400 space-y-1.5 list-disc list-inside leading-relaxed">
              <li>The commentary has been reviewed and is accurate</li>
              <li>The content is appropriate for publication in a pack</li>
              <li>Any figures or references mentioned have been verified</li>
            </ul>
            <p className="text-xs text-yellow-600">This confirmation will be recorded with your name and timestamp.</p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowConfirmDialog(false)}
                className="flex-1 py-2 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md transition-colors">
                Cancel
              </button>
              <button onClick={handleConfirm} disabled={confirming}
                className="flex-1 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-medium disabled:opacity-40 transition-colors">
                {confirming ? 'Confirming…' : 'I confirm the commentary is correct'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
