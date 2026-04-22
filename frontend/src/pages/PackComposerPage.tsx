import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation, useBlocker, useBeforeUnload } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import {
  Save, Upload, Feather, Plus, Trash2, ChevronUp, ChevronDown,
  FileText, X, Layers, LayoutTemplate, Eye, BarChart3,
  Palette, ArrowUpToLine, ArrowDownToLine, Image as ImageIcon, Type, LayoutGrid, List,
  Replace, Flag, CheckCheck, Settings, Code,
} from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { Extension } from '@tiptap/core'

// Allow inline style attributes to survive HTML import
const InlineStyle = Extension.create({
  name: 'inlineStyle',
  addGlobalAttributes() {
    return [{
      types: ['textStyle', 'paragraph', 'heading', 'bulletList', 'orderedList', 'listItem'],
      attributes: {
        style: {
          default: null,
          parseHTML: (el) => el.getAttribute('style') || null,
          renderHTML: (attrs) => attrs.style ? { style: attrs.style } : {},
        },
      },
    }]
  },
})
import { Color } from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import { api, PickerReport, PickerVisual, ImageItem, RawDataset } from '../lib/api'
import { PackSection, PackSlot, PackPage, SectionPreset, migrateLayout, ReportDefinition, VisualDefinition, PackSectionRow, RowPreset, PackDefaults, defaultPackDefaults } from '../types/report'
import ReportRenderer from '../components/shared/ReportRenderer'
import VisualRenderer from '../components/shared/VisualRenderer'

// ─── Preset definitions ────────────────────────────────────────────────────────

const PRESETS: { id: SectionPreset; label: string; widths: string[]; isMultiRow?: boolean }[] = [
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
  // Multi-row presets (parsed: "full-3" = 1 slot row then 3 slot row)
  { id: 'full-3',                  label: '1 + 3',       widths: ['100%', '33.33%', '33.33%', '33.33%'], isMultiRow: true },
  { id: '3-full',                  label: '3 + 1',       widths: ['33.33%', '33.33%', '33.33%', '100%'], isMultiRow: true },
  { id: 'full-2',                  label: '1 + 2',       widths: ['100%', '50%', '50%'], isMultiRow: true },
  { id: '2-full',                  label: '2 + 1',       widths: ['50%', '50%', '100%'], isMultiRow: true },
  { id: 'full-half',               label: '1 + 1-1',    widths: ['100%', '50%', '50%'], isMultiRow: true },
  { id: 'half-full',               label: '1-1 + 1',    widths: ['50%', '50%', '100%'], isMultiRow: true },
  { id: 'half-half',               label: '1-1 + 1-1',  widths: ['50%', '50%', '50%', '50%'], isMultiRow: true },
  { id: 'full-half-half',           label: '1 + 1-1 + 1-1', widths: ['100%', '50%', '50%', '50%', '50%'], isMultiRow: true },
  { id: 'half-half-full',          label: '1-1 + 1-1 + 1', widths: ['50%', '50%', '50%', '50%', '100%'], isMultiRow: true },
]

const ROW_PRESETS: { id: RowPreset; label: string; widths: string[] }[] = [
  { id: 'full',    label: '1', widths: ['100%'] },
  { id: 'half',   label: '2', widths: ['50%', '50%'] },
  { id: 'thirds',  label: '3', widths: ['33.33%', '33.33%', '33.33%'] },
  { id: 'quarters', label: '4', widths: ['25%', '25%', '25%', '25%'] },
]

function isMultiRowPreset(preset: SectionPreset): boolean {
  return preset.includes('-') && PRESETS.some(p => p.id === preset && (p as any).isMultiRow)
}

function parseMultiRow(preset: SectionPreset): { slotsPerRow: number[] } {
  const SLOT_MAP: Record<string, number> = { full: 1, half: 2, thirds: 3, quarters: 4 }
  const parts = preset.split('-').map(n => SLOT_MAP[n] ?? parseInt(n, 10))
  return { slotsPerRow: parts }
}

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
  if (isMultiRowPreset(preset)) {
    const { slotsPerRow } = parseMultiRow(preset)
    const ROW_PRESET_MAP = ['', 'full', 'half', 'thirds', 'quarters']
    const rows: PackSectionRow[] = slotsPerRow.map((count: number) => ({
      id: uuid(),
      preset: ROW_PRESET_MAP[count] as RowPreset,
      slots: Array.from({ length: count }, emptySlot)
    }))
    return { id: uuid(), preset, slots: [], rows }
  }
  return { id: uuid(), preset, slots: Array.from({ length: presetSlotCount(preset) }, emptySlot) }
}

function newPage(): PackPage {
  return { id: uuid(), sections: [] }
}

function slotBgStyle(colour: string | null | undefined, opacity: number | null | undefined): React.CSSProperties {
  if (!colour) return {}
  const r = parseInt(colour.slice(1, 3), 16)
  const g = parseInt(colour.slice(3, 5), 16)
  const b = parseInt(colour.slice(5, 7), 16)
  return { backgroundColor: `rgba(${r},${g},${b},${opacity ?? 0})` }
}

// ─── Type Picker ──────────────────────────────────────────────────────────────

type SlotType = 'report' | 'visual' | 'image' | 'text' | 'toc' | 'html'

interface TypePickerProps {
  reports: PickerReport[]
  visuals: PickerVisual[]
  images: ImageItem[]
  onPick: (type: SlotType, id?: string, extra?: string) => void
  onClose: () => void
}

function TypePicker({ reports, visuals, images, onPick, onClose }: TypePickerProps) {
  const [step, setStep] = useState<SlotType | null>(null)

  if (!step) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-80 p-4 space-y-2"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-100">Add to slot</span>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300"><X className="h-4 w-4" /></button>
        </div>
        {([
          { type: 'report' as SlotType, icon: <FileText className="h-5 w-5 text-gray-400" />, label: 'Report', sub: 'TM1 data table' },
          { type: 'visual' as SlotType, icon: <BarChart3 className="h-5 w-5 text-blue-400" />, label: 'Visual', sub: 'Chart or KPI' },
          { type: 'image' as SlotType, icon: <ImageIcon className="h-5 w-5 text-emerald-400" />, label: 'Image', sub: 'From image library' },
          { type: 'text' as SlotType, icon: <Type className="h-5 w-5 text-purple-400" />, label: 'Text', sub: 'Rich text editor' },
          { type: 'toc' as SlotType, icon: <List className="h-5 w-5 text-amber-400" />, label: 'Contents', sub: 'Auto table of contents' },
          { type: 'html' as SlotType, icon: <Code className="h-5 w-5 text-orange-400" />, label: 'HTML', sub: 'Custom HTML + CSS' },
        ]).map(({ type, icon, label, sub }) => (
          <button key={type}
            onClick={() => (type === 'text' || type === 'toc' || type === 'html') ? onPick(type) : setStep(type)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-800 transition-colors text-left">
            {icon}
            <div>
              <p className="text-sm text-gray-200 font-medium">{label}</p>
              <p className="text-xs text-gray-500">{sub}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[440px] max-h-[520px] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
          <button onClick={() => setStep(null)} className="text-gray-500 hover:text-gray-300 text-xs">← Back</button>
          <span className="text-sm font-medium text-gray-100 capitalize">{step === 'report' ? 'Reports' : step === 'visual' ? 'Visuals' : 'Images'}</span>
          <button onClick={onClose} className="ml-auto text-gray-600 hover:text-gray-300"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {step === 'report' && (
            reports.length === 0
              ? <p className="text-xs text-gray-600 text-center py-6">No published reports</p>
              : reports.map((r) => (
                <button key={r.id} onClick={() => onPick('report', r.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800 transition-colors text-left">
                  <FileText className="h-4 w-4 shrink-0 text-gray-500" />
                  <span className="flex-1 text-sm text-gray-200 truncate">{r.title}</span>
                </button>
              ))
          )}
          {step === 'visual' && (
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
                </button>
              ))
          )}
          {step === 'image' && (
            images.length === 0
              ? <p className="text-xs text-gray-600 text-center py-6">No images in library</p>
              : images.map((img) => (
                <button key={img.id} onClick={() => onPick('image', img.id, img.filename)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800 transition-colors text-left">
                  <img src={`http://${window.location.hostname}:8080/images/${img.filename}`}
                    alt={img.name} className="h-8 w-12 object-cover rounded shrink-0" />
                  <span className="flex-1 text-sm text-gray-200 truncate">{img.name}</span>
                </button>
              ))
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Inline Text Editor ───────────────────────────────────────────────────────

function TextSlotEditor({ content, onChange }: { content: string; onChange: (html: string) => void }) {
  const [showHtmlPane, setShowHtmlPane] = useState(false)
  const [rawHtml, setRawHtml] = useState('')
  const isImporting = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      InlineStyle,
    ],
    content: content || '<p></p>',
    onUpdate: ({ editor }) => {
      if (isImporting.current) return  // raw HTML already saved directly — don't overwrite with sanitized version
      onChange(editor.getHTML())
    },
  })

  if (!editor) return null

  const importHtml = () => {
    if (!rawHtml.trim()) return
    onChange(rawHtml)            // save raw HTML first — preserves divs, tables, inline styles
    isImporting.current = true   // block onUpdate from overwriting with sanitized version
    editor.commands.setContent(rawHtml)
    isImporting.current = false
    setRawHtml('')
    setShowHtmlPane(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Mini toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-gray-700 flex-wrap">
        {[
          { label: 'B', action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), cls: 'font-bold' },
          { label: 'I', action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), cls: 'italic' },
          { label: 'U', action: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive('underline'), cls: 'underline' },
        ].map(({ label, action, active, cls }) => (
          <button key={label} onMouseDown={(e) => { e.preventDefault(); action() }}
            className={`px-1.5 py-0.5 rounded text-xs transition-colors ${cls} ${active ? 'bg-gray-600 text-gray-100' : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'}`}>
            {label}
          </button>
        ))}
        <div className="w-px h-3 bg-gray-700 mx-0.5" />
        {[1, 2, 3].map((level) => (
          <button key={level} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: level as 1|2|3 }).run() }}
            className={`px-1.5 py-0.5 rounded text-xs transition-colors ${editor.isActive('heading', { level }) ? 'bg-gray-600 text-gray-100' : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'}`}>
            H{level}
          </button>
        ))}
        <div className="w-px h-3 bg-gray-700 mx-0.5" />
        <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run() }}
          className={`px-1.5 py-0.5 rounded text-xs transition-colors ${editor.isActive('bulletList') ? 'bg-gray-600 text-gray-100' : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'}`}>
          •—
        </button>
        <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run() }}
          className={`px-1.5 py-0.5 rounded text-xs transition-colors ${editor.isActive('orderedList') ? 'bg-gray-600 text-gray-100' : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'}`}>
          1—
        </button>
        <div className="w-px h-3 bg-gray-700 mx-0.5" />
        <button onMouseDown={(e) => {
            e.preventDefault()
            if (!showHtmlPane) setRawHtml(editor?.getHTML() ?? '')
            setShowHtmlPane((v) => !v)
          }}
          className={`px-1.5 py-0.5 rounded text-xs font-mono transition-colors ${showHtmlPane ? 'bg-gray-600 text-gray-100' : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'}`}
          title="View / edit HTML">
          &lt;/&gt;
        </button>
      </div>

      {/* HTML paste pane */}
      {showHtmlPane && (
        <div className="border-b border-gray-700 bg-gray-900 p-2 flex flex-col gap-2">
          <textarea
            autoFocus
            value={rawHtml}
            onChange={(e) => setRawHtml(e.target.value)}
            placeholder="Paste HTML here…"
            className="w-full h-24 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-200 p-2 resize-none focus:outline-none focus:border-blue-500"
          />
          <div className="flex items-center gap-2">
            <button onClick={importHtml}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition-colors">
              Apply
            </button>
            <button onClick={() => navigator.clipboard.writeText(rawHtml)}
              className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded transition-colors">
              Copy
            </button>
            <button onClick={() => { setShowHtmlPane(false); setRawHtml('') }}
              className="px-2.5 py-1 text-gray-400 hover:text-gray-200 text-xs transition-colors">
              Close
            </button>
            <span className="text-xs text-gray-600 ml-auto">Edit then Apply to update</span>
          </div>
        </div>
      )}

      <EditorContent editor={editor}
        className="flex-1 overflow-auto p-2 bg-white focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[60px] [&_.ProseMirror]:prose [&_.ProseMirror]:prose-sm [&_.ProseMirror]:max-w-none" />
    </div>
  )
}

// ─── Slot Card ────────────────────────────────────────────────────────────────

// Strip <script> tags from HTML for safety
function sanitizeHtml(html: string): string {
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
}

interface SlotCardProps {
  slot: PackSlot
  width: string
  reports: PickerReport[]
  visuals: PickerVisual[]
  images: ImageItem[]
  onPlace: (type: SlotType, id?: string, extra?: string) => void
  onClear: () => void
  onTextChange: (html: string) => void
  onHtmlChange: (html: string) => void
  onNoteLabelChange: (label: string) => void
  onLabelChange?: (label: string) => void
  onExcludeFromTocChange?: (exclude: boolean) => void
  onDescriptionChange?: (desc: string) => void
  onSlotBgChange?: (colour: string | null, opacity: number | null) => void
  onSaveSlot?: () => void
  hasUnsavedChanges?: boolean
}

function SlotCard({ slot, width, reports, visuals, images, onPlace, onClear, onTextChange, onHtmlChange, onNoteLabelChange, onLabelChange, onExcludeFromTocChange, onDescriptionChange, onSlotBgChange, onSaveSlot, hasUnsavedChanges }: SlotCardProps) {
  const HTML_A4_W = 1123  // A4 landscape at 96 dpi
  const HTML_A4_H = 794
  const [showPicker, setShowPicker] = useState(false)
  const [htmlPreview, setHtmlPreview] = useState(false)
  const previewWrapRef = useRef<HTMLDivElement>(null)
  const [previewW, setPreviewW] = useState(0)

  useEffect(() => {
    const el = previewWrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setPreviewW(el.getBoundingClientRect().width))
    ro.observe(el)
    setPreviewW(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [htmlPreview, slot.artifactType])

  // ── Text slot ────────────────────────────────────────────────────────────────
  if (slot.artifactType === 'text') {
    const isNarrow = width && parseInt(width, 10) < 40
    return (
      <div style={{ width }} className="min-w-0 flex-shrink-0">
        <div className="h-full border border-gray-700 rounded-lg m-0.5 flex flex-col min-h-[100px] relative group">
          <div className={`flex flex-wrap items-center ${isNarrow ? 'px-1 py-0.5 gap-1' : 'px-2 py-1'} border-b border-gray-800`}>
            <input
              type="text"
              value={slot.noteLabel ?? ''}
              onChange={(e) => onNoteLabelChange(e.target.value)}
              placeholder={isNarrow ? "N" : "Note Ref"}
              className={`${isNarrow ? 'w-8 text-[10px] px-1 py-0' : 'w-16 text-xs px-2 py-0.5'} bg-gray-900 border border-gray-700 rounded text-gray-300 focus:outline-none focus:border-blue-500`}
              title="Note reference (e.g. 1, 2a) - links to report row noteRefs"
            />
            <input
              type="text"
              value={slot.label ?? ''}
              onChange={(e) => onLabelChange?.(e.target.value)}
              placeholder={isNarrow ? "L" : "TOC Label"}
              className={`${isNarrow ? 'w-8 text-[10px] px-1 py-0' : 'w-20 text-xs px-2 py-0.5'} bg-gray-900 border border-gray-700 rounded text-gray-300 focus:outline-none focus:border-blue-500`}
              title="Label for TOC display"
            />
            <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer shrink-0" title="Exclude from TOC">
              <input
                type="checkbox"
                checked={slot.excludeFromToc === true}
                onChange={(e) => onExcludeFromTocChange?.(e.target.checked)}
                className="w-3 h-3 rounded accent-blue-500"
              />
              {!isNarrow && <span>No TOC</span>}
            </label>
            {onSlotBgChange && (
              <div className="flex items-center gap-1 shrink-0" title="Slot background wash">
                <input
                  type="color"
                  value={slot.slotBackground ?? '#ffffff'}
                  onChange={(e) => onSlotBgChange(e.target.value, slot.slotBackground != null ? (slot.slotOpacity ?? 0) : 1)}
                  className="w-4 h-4 rounded cursor-pointer border border-gray-700 bg-transparent p-0"
                />
                <input
                  type="range"
                  min={0} max={100} step={1}
                  value={Math.round((slot.slotOpacity ?? 0) * 100)}
                  onChange={(e) => onSlotBgChange(slot.slotBackground ?? '#ffffff', Number(e.target.value) / 100)}
                  className={`${isNarrow ? 'w-10' : 'w-14'} accent-blue-500`}
                  title={`Background opacity: ${Math.round((slot.slotOpacity ?? 0) * 100)}%`}
                />
              </div>
            )}
            {!isNarrow && (
              <>
                <input
                  type="text"
                  value={slot.description ?? ''}
                  onChange={(e) => onDescriptionChange?.(e.target.value)}
                  placeholder="Description"
                  className="flex-1 text-xs bg-gray-900 border border-gray-700 rounded px-2 py-0.5 text-gray-400 focus:outline-none focus:border-blue-500"
                  title="Description for this text slot"
                />
                {onSaveSlot && (
                  <button
                    onClick={onSaveSlot}
                    title="Save this text slot"
                    className={`p-1 rounded transition-colors ${hasUnsavedChanges ? 'text-yellow-400 hover:text-yellow-300 bg-yellow-400/10' : 'text-gray-600 hover:text-gray-400'}`}
                  >
                    <Save className="h-3.5 w-3.5" />
                  </button>
                )}
              </>
            )}
            <div className="flex items-center gap-0.5 ml-auto">
              <button
                onClick={() => { if (window.confirm('Change slot type? Current content will be cleared.')) { onClear(); setShowPicker(true) } }}
                className="p-0.5 text-gray-600 hover:text-blue-400 transition-colors" title="Change slot type">
                <Replace className="h-3.5 w-3.5" />
              </button>
              <button onClick={onClear} className="p-0.5 text-gray-600 hover:text-red-400 transition-colors" title="Clear slot">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <TextSlotEditor content={slot.textContent ?? ''} onChange={onTextChange} />
          </div>
        </div>
      </div>
    )
  }

  // ── TOC slot ─────────────────────────────────────────────────────────────────
  if (slot.artifactType === 'toc') {
    return (
      <div style={{ width }} className="min-w-0 flex-shrink-0">
        <div className="h-full border border-amber-800/40 rounded-lg m-1 flex flex-col min-h-[80px] relative group" style={slotBgStyle(slot.slotBackground, slot.slotOpacity)}>
          <div className="flex items-center justify-between px-2 py-1 border-b border-amber-800/30">
            <div className="flex items-center gap-1.5">
              <List className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs text-amber-300 font-medium">Table of Contents</span>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => { if (window.confirm('Change slot type? This TOC slot will be cleared.')) { onClear(); setShowPicker(true) } }}
                className="p-0.5 text-gray-600 hover:text-blue-400 transition-colors" title="Change slot type">
                <Replace className="h-3.5 w-3.5" />
              </button>
              <button onClick={onClear} className="p-0.5 text-gray-600 hover:text-red-400 transition-colors" title="Clear slot">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="px-3 py-2 flex items-center gap-2">
            <p className="text-xs text-amber-700 italic flex-1">Auto-generated from pack contents</p>
            {onSlotBgChange && (
              <div className="flex items-center gap-1 shrink-0" title="Slot background colour and opacity">
                <input
                  type="color"
                  value={slot.slotBackground ?? '#ffffff'}
                  onChange={(e) => onSlotBgChange(e.target.value, slot.slotBackground != null ? (slot.slotOpacity ?? 0) : 1)}
                  className="w-5 h-5 rounded cursor-pointer border border-gray-700 bg-transparent p-0"
                />
                <input
                  type="range"
                  min={0} max={100} step={1}
                  value={Math.round((slot.slotOpacity ?? 0) * 100)}
                  onChange={(e) => onSlotBgChange(slot.slotBackground ?? '#ffffff', Number(e.target.value) / 100)}
                  className="w-14 accent-blue-500"
                  title={`Opacity: ${Math.round((slot.slotOpacity ?? 0) * 100)}% (0 = transparent, 100 = solid)`}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── HTML slot ────────────────────────────────────────────────────────────────
  if (slot.artifactType === 'html') {
    const isNarrow = width && parseInt(width, 10) < 40
    return (
      <div style={{ width }} className="min-w-0 flex-shrink-0">
        <div className="h-full border border-orange-800/40 rounded-lg m-0.5 flex flex-col min-h-[100px] relative group bg-orange-950/10">
          {/* Toolbar — matches text slot pattern */}
          <div className={`flex flex-wrap items-center ${isNarrow ? 'px-1 py-0.5 gap-1' : 'px-2 py-1'} border-b border-orange-800/30 shrink-0`}>
            <Code className="h-3.5 w-3.5 text-orange-400 shrink-0" />
            {!isNarrow && <span className="text-[10px] text-orange-600/50 shrink-0">297×210mm</span>}
            <input
              type="text"
              value={slot.label ?? ''}
              onChange={(e) => onLabelChange?.(e.target.value)}
              placeholder={isNarrow ? "L" : "TOC Label"}
              className={`${isNarrow ? 'w-8 text-[10px] px-1 py-0' : 'w-24 text-xs px-2 py-0.5'} bg-gray-900 border border-gray-700 rounded text-gray-300 focus:outline-none focus:border-orange-500`}
              title="Label for TOC display"
            />
            <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer shrink-0" title="Exclude from TOC">
              <input
                type="checkbox"
                checked={slot.excludeFromToc === true}
                onChange={(e) => onExcludeFromTocChange?.(e.target.checked)}
                className="w-3 h-3 rounded accent-orange-500"
              />
              {!isNarrow && <span>No TOC</span>}
            </label>
            {!isNarrow && onSlotBgChange && (
              <div className="flex items-center gap-1 shrink-0" title="Slot background wash">
                <input
                  type="color"
                  value={slot.slotBackground ?? '#ffffff'}
                  onChange={(e) => onSlotBgChange(e.target.value, slot.slotOpacity ?? 0)}
                  className="w-5 h-5 rounded cursor-pointer border border-gray-700 bg-transparent p-0"
                />
                <input
                  type="range"
                  min={0} max={100} step={1}
                  value={Math.round((slot.slotOpacity ?? 0) * 100)}
                  onChange={(e) => onSlotBgChange(slot.slotBackground ?? '#ffffff', Number(e.target.value) / 100)}
                  className="w-14 accent-orange-500"
                  title={`Background opacity: ${Math.round((slot.slotOpacity ?? 0) * 100)}%`}
                />
              </div>
            )}
            <div className="flex items-center gap-0.5 ml-auto">
              <button
                onClick={() => setHtmlPreview((v) => !v)}
                title={htmlPreview ? 'Edit code' : 'Preview render'}
                className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${htmlPreview ? 'bg-orange-700/40 text-orange-300' : 'text-gray-500 hover:text-orange-300'}`}
              >
                {htmlPreview ? 'Code' : 'Preview'}
              </button>
              <button
                onClick={() => { if (window.confirm('Change slot type? HTML content will be cleared.')) { onClear(); setShowPicker(true) } }}
                className="p-0.5 text-gray-600 hover:text-blue-400 transition-colors" title="Change slot type">
                <Replace className="h-3.5 w-3.5" />
              </button>
              <button onClick={onClear} className="p-0.5 text-gray-600 hover:text-red-400 transition-colors" title="Clear slot">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {/* Content area */}
          {htmlPreview ? (
            <div
              ref={previewWrapRef}
              className="w-full rounded-b-lg overflow-hidden"
              style={{ height: previewW > 0 ? Math.round(HTML_A4_H * (previewW / HTML_A4_W)) : HTML_A4_H }}
            >
              {previewW > 0 && (
                <iframe
                  srcDoc={`<style>html,body{margin:0;padding:0;overflow:hidden;box-sizing:border-box;width:100%;height:100%}</style>${slot.htmlContent ?? ''}`}
                  sandbox="allow-same-origin"
                  title="HTML preview"
                  style={{
                    width: HTML_A4_W,
                    height: HTML_A4_H,
                    border: 'none',
                    display: 'block',
                    transform: `scale(${previewW / HTML_A4_W})`,
                    transformOrigin: 'top left',
                  }}
                />
              )}
            </div>
          ) : (
            <textarea
              value={slot.htmlContent ?? ''}
              onChange={(e) => onHtmlChange(sanitizeHtml(e.target.value))}
              placeholder="Paste HTML here…"
              spellCheck={false}
              className="w-full bg-gray-950 text-[11px] text-gray-200 font-mono px-2 py-2 resize-y focus:outline-none placeholder-gray-600 rounded-b-lg"
              style={{ minHeight: 300 }}
            />
          )}
        </div>
      </div>
    )
  }

  // ── Image slot ───────────────────────────────────────────────────────────────
  if (slot.artifactType === 'image') {
    const imgSrc = slot.imageFilename
      ? `http://${window.location.hostname}:8080/images/${slot.imageFilename}`
      : null
    return (
      <div style={{ width }} className="min-w-0 flex-shrink-0">
        <div className="h-full border border-gray-700 rounded-lg m-1 flex flex-col min-h-[120px] relative group">
          <div className="flex items-center gap-1 px-2 py-1 border-b border-gray-800 shrink-0">
            {onLabelChange && (
              <input
                type="text"
                value={slot.label ?? ''}
                onChange={(e) => onLabelChange(e.target.value)}
                placeholder="TOC Label"
                className="flex-1 text-[10px] bg-gray-900 border border-gray-700 rounded px-1 py-0.5 text-gray-400 focus:outline-none focus:border-blue-500"
                title="Label for TOC"
              />
            )}
            {onSlotBgChange && (
              <div className="flex items-center gap-1 shrink-0">
                <input type="color" value={slot.slotBackground ?? '#ffffff'}
                  onChange={(e) => onSlotBgChange(e.target.value, slot.slotBackground != null ? (slot.slotOpacity ?? 0) : 1)}
                  className="w-4 h-4 rounded cursor-pointer border border-gray-700 bg-transparent p-0" title="Background colour" />
                <input type="range" min={0} max={100} step={1}
                  value={Math.round((slot.slotOpacity ?? 0) * 100)}
                  onChange={(e) => onSlotBgChange(slot.slotBackground ?? '#ffffff', Number(e.target.value) / 100)}
                  className="w-12 accent-blue-500" title={`Opacity: ${Math.round((slot.slotOpacity ?? 0) * 100)}%`} />
              </div>
            )}
            <div className="flex items-center gap-0.5 ml-auto">
              <button onClick={() => { if (window.confirm('Change slot type? The selected image will be cleared.')) { onClear(); setShowPicker(true) } }}
                className="p-0.5 text-gray-600 hover:text-blue-400" title="Change slot type">
                <Replace className="h-3.5 w-3.5" />
              </button>
              <button onClick={onClear} className="p-0.5 text-gray-600 hover:text-red-400" title="Clear slot">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-2">
            {imgSrc
              ? <img src={imgSrc} alt={slot.imageFilename ?? ''} className="max-w-full max-h-48 object-contain rounded" />
              : <span className="text-xs text-gray-500">Image slot</span>
            }
          </div>
        </div>
      </div>
    )
  }

  // ── Report / Visual slot ─────────────────────────────────────────────────────
  const artifact = slot.artifactId
    ? slot.artifactType === 'visual'
      ? visuals.find((v) => v.id === slot.artifactId)
      : reports.find((r) => r.id === slot.artifactId)
    : null

  const title = artifact?.title ?? 'Unknown'

  return (
    <div style={{ width }} className="min-w-0 flex-shrink-0">
      <div className="h-full border-2 border-dashed border-gray-700 rounded-lg m-1 flex flex-col items-center justify-center min-h-[120px] relative group transition-colors hover:border-gray-600">
        {slot.artifactId ? (
          <div className="w-full h-full p-3 flex flex-col gap-2">
            <div className="flex items-start gap-2">
              {slot.artifactType === 'visual'
                ? <BarChart3 className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                : <FileText className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
              }
              <span className="flex-1 text-xs text-gray-200 font-medium leading-snug">{title}</span>
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all shrink-0">
                <button
                  onClick={() => { if (window.confirm('Change slot type? The linked artifact will be removed.')) { onClear(); setShowPicker(true) } }}
                  className="p-0.5 text-gray-600 hover:text-blue-400" title="Change slot type">
                  <Replace className="h-3.5 w-3.5" />
                </button>
                <button onClick={onClear} className="p-0.5 text-gray-600 hover:text-red-400" title="Clear slot">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-auto flex-wrap">
              <span className="text-xs text-gray-600 capitalize">{slot.artifactType}</span>
              {onSlotBgChange && (
                <div className="flex items-center gap-1 ml-auto shrink-0">
                  <input type="color" value={slot.slotBackground ?? '#ffffff'}
                    onChange={(e) => onSlotBgChange(e.target.value, slot.slotBackground != null ? (slot.slotOpacity ?? 0) : 1)}
                    className="w-4 h-4 rounded cursor-pointer border border-gray-700 bg-transparent p-0" title="Background colour" />
                  <input type="range" min={0} max={100} step={1}
                    value={Math.round((slot.slotOpacity ?? 0) * 100)}
                    onChange={(e) => onSlotBgChange(slot.slotBackground ?? '#ffffff', Number(e.target.value) / 100)}
                    className="w-14 accent-blue-500" title={`Opacity: ${Math.round((slot.slotOpacity ?? 0) * 100)}%`} />
                </div>
              )}
            </div>
            {onLabelChange && (
              <input
                type="text"
                value={slot.label ?? ''}
                onChange={(e) => onLabelChange(e.target.value)}
                placeholder="Label for TOC"
                className="mt-1 text-[10px] bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-gray-400 focus:outline-none focus:border-blue-500"
              />
            )}
          </div>
        ) : (
          <button onClick={() => setShowPicker(true)}
            className="flex flex-col items-center gap-2 text-gray-700 hover:text-gray-400 transition-colors p-4">
            <Plus className="h-6 w-6" />
            <span className="text-xs">Add</span>
          </button>
        )}
      </div>

      {showPicker && (
        <TypePicker
          reports={reports} visuals={visuals} images={images}
          onPick={(type, id, extra) => { onPlace(type, id, extra); setShowPicker(false) }}
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
  visuals: PickerVisual[]
  images: ImageItem[]
  onChange: (s: PackSection) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onMoveToPrevPage?: () => void
  onMoveToNextPage?: () => void
  onDelete: () => void
}

function SectionCard({
  section, index, total, pageIndex, totalPages,
  reports, visuals, images,
  onChange, onMoveUp, onMoveDown, onMoveToPrevPage, onMoveToNextPage, onDelete,
}: SectionCardProps) {
  const widths = presetWidths(section.preset)

  const changePreset = (preset: SectionPreset) => {
    if (isMultiRowPreset(preset)) {
      const { slotsPerRow } = parseMultiRow(preset)
      const ROW_PRESET_MAP = ['', 'full', 'half', 'thirds', 'quarters']
      const rows: PackSectionRow[] = slotsPerRow.map((count: number, ri: number) => ({
        id: uuid(),
        preset: ROW_PRESET_MAP[count] as RowPreset,
        slots: Array.from({ length: count }, (_, si) => section.rows?.[ri]?.slots[si] ?? emptySlot())
      }))
      onChange({ ...section, preset, slots: [], rows })
    } else {
      const count = presetSlotCount(preset)
      const slots = Array.from({ length: count }, (_, i) => section.slots[i] ?? emptySlot())
      onChange({ ...section, preset, slots, rows: undefined })
    }
  }

  const isMultiRow = isMultiRowPreset(section.preset)

  const updateSlot = (i: number, type: SlotType, id?: string, extra?: string) => {
    const slots = section.slots.map((s, si) => {
      if (si !== i) return s
      if (type === 'text') return { ...emptySlot(), artifactType: 'text' as const, textContent: '' }
      if (type === 'toc') return { ...emptySlot(), artifactType: 'toc' as const }
      if (type === 'html') return { ...emptySlot(), artifactType: 'html' as const, htmlContent: '' }
      if (type === 'image') return { ...emptySlot(), artifactType: 'image' as const, imageFilename: extra ?? null }
      return { ...emptySlot(), artifactType: type as 'report' | 'visual', artifactId: id ?? null }
    })
    onChange({ ...section, slots })
  }

  const updateTextContent = (i: number, html: string) => {
    const slots = section.slots.map((s, si) => si === i ? { ...s, textContent: html } : s)
    onChange({ ...section, slots })
  }

  const updateHtmlContent = (i: number, html: string) => {
    const slots = section.slots.map((s, si) => si === i ? { ...s, htmlContent: html } : s)
    onChange({ ...section, slots })
  }

  const clearSlot = (i: number) => {
    const slots = section.slots.map((s, si) => si === i ? emptySlot() : s)
    onChange({ ...section, slots })
  }

  const sectionLabel = PRESETS.find(p => p.id === section.preset)?.label ?? section.preset

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl mb-4">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800">
        <LayoutTemplate className="h-3.5 w-3.5 text-gray-600 shrink-0" />
        <span className="text-xs text-gray-500 shrink-0">{sectionLabel}</span>
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

      {isMultiRow && section.rows ? (
        <div className="flex flex-col p-1 gap-1">
          {section.rows.map((row, ri) => {
            const rowWidths = ROW_PRESETS.find(r => r.id === row.preset)?.widths ?? ['100%']
            return (
              <div key={row.id} className="flex gap-1">
                {row.slots.map((slot, si) => (
                  <SlotCard
                    key={`${row.id}-${si}`}
                    slot={slot}
                    width={rowWidths[si]}
                    reports={reports} visuals={visuals} images={images}
                    onPlace={(type, id, extra) => {
                      const newRows = section.rows!.map((r, ri2) => {
                        if (ri2 !== ri) return r
                        return {
                          ...r,
                          slots: r.slots.map((s, si2) => {
                            if (si2 !== si) return s
                            if (type === 'text') return { ...emptySlot(), artifactType: 'text' as const, textContent: '' }
                            if (type === 'toc') return { ...emptySlot(), artifactType: 'toc' as const }
                            if (type === 'html') return { ...emptySlot(), artifactType: 'html' as const, htmlContent: '' }
                            if (type === 'image') return { ...emptySlot(), artifactType: 'image' as const, imageFilename: extra ?? null }
                            return { ...emptySlot(), artifactType: type as 'report' | 'visual', artifactId: id ?? null }
                          })
                        }
                      })
                      onChange({ ...section, rows: newRows })
                    }}
                    onClear={() => {
                      const newRows = section.rows!.map((r, ri2) => {
                        if (ri2 !== ri) return r
                        return { ...r, slots: r.slots.map((s, si2) => si2 !== si ? s : emptySlot()) }
                      })
                      onChange({ ...section, rows: newRows })
                    }}
                    onTextChange={(html) => {
                      const newRows = section.rows!.map((r, ri2) => {
                        if (ri2 !== ri) return r
                        return { ...r, slots: r.slots.map((s, si2) => si2 !== si ? s : { ...s, textContent: html }) }
                      })
                      onChange({ ...section, rows: newRows })
                    }}
                    onHtmlChange={(html) => {
                      const newRows = section.rows!.map((r, ri2) => {
                        if (ri2 !== ri) return r
                        return { ...r, slots: r.slots.map((s, si2) => si2 !== si ? s : { ...s, htmlContent: html }) }
                      })
                      onChange({ ...section, rows: newRows })
                    }}
                    onNoteLabelChange={(label) => {
                      const newRows = section.rows!.map((r, ri2) => {
                        if (ri2 !== ri) return r
                        return { ...r, slots: r.slots.map((s, si2) => si2 !== si ? s : { ...s, noteLabel: label || null }) }
                      })
                      onChange({ ...section, rows: newRows })
                    }}
                    onDescriptionChange={(desc) => {
                      const newRows = section.rows!.map((r, ri2) => {
                        if (ri2 !== ri) return r
                        return { ...r, slots: r.slots.map((s, si2) => si2 !== si ? s : { ...s, description: desc || null }) }
                      })
                      onChange({ ...section, rows: newRows })
                    }}
                    onLabelChange={(label) => {
                      const newRows = section.rows!.map((r, ri2) => {
                        if (ri2 !== ri) return r
                        return { ...r, slots: r.slots.map((s, si2) => si2 !== si ? s : { ...s, label: label || null }) }
                      })
                      onChange({ ...section, rows: newRows })
                    }}
                    onExcludeFromTocChange={(exclude) => {
                      const newRows = section.rows!.map((r, ri2) => {
                        if (ri2 !== ri) return r
                        return { ...r, slots: r.slots.map((s, si2) => si2 !== si ? s : { ...s, excludeFromToc: exclude || null }) }
                      })
                      onChange({ ...section, rows: newRows })
                    }}
                    onSlotBgChange={(colour, opacity) => {
                      const newRows = section.rows!.map((r, ri2) => {
                        if (ri2 !== ri) return r
                        return { ...r, slots: r.slots.map((s, si2) => si2 !== si ? s : { ...s, slotBackground: colour, slotOpacity: opacity }) }
                      })
                      onChange({ ...section, rows: newRows })
                    }}
                  />
                ))}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex p-1">
          {section.slots.map((slot, i) => (
            <SlotCard
              key={i}
              slot={slot}
              width={widths[i]}
              reports={reports} visuals={visuals} images={images}
              onPlace={(type, id, extra) => updateSlot(i, type, id, extra)}
              onClear={() => clearSlot(i)}
              onTextChange={(html) => updateTextContent(i, html)}
              onHtmlChange={(html) => updateHtmlContent(i, html)}
              onNoteLabelChange={(label) => {
                const slots = section.slots.map((s, si) => si === i ? { ...s, noteLabel: label || null } : s)
                onChange({ ...section, slots })
              }}
              onLabelChange={(label) => {
                const slots = section.slots.map((s, si) => si === i ? { ...s, label: label || null } : s)
                onChange({ ...section, slots })
              }}
              onExcludeFromTocChange={(exclude) => {
                const slots = section.slots.map((s, si) => si === i ? { ...s, excludeFromToc: exclude || null } : s)
                onChange({ ...section, slots })
              }}
              onDescriptionChange={(desc) => {
                const slots = section.slots.map((s, si) => si === i ? { ...s, description: desc || null } : s)
                onChange({ ...section, slots })
              }}
              onSlotBgChange={(colour, opacity) => {
                const slots = section.slots.map((s, si) => si === i ? { ...s, slotBackground: colour, slotOpacity: opacity } : s)
                onChange({ ...section, slots })
              }}
            />
          ))}
        </div>
      )}

      {/* Gap-after control */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-t border-gray-800">
        <span className="text-xs text-gray-600 shrink-0">Gap below</span>
        {(['none', 'tight', 'normal', 'wide'] as const).map((g) => {
          const active = (section.gapAfter ?? 'normal') === g
          return (
            <button key={g} onClick={() => onChange({ ...section, gapAfter: g })}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${active ? 'bg-blue-500 text-white' : 'text-gray-600 hover:text-gray-300 hover:bg-gray-800'}`}>
              {g === 'none' ? 'None' : g === 'tight' ? 'Tight' : g === 'normal' ? 'Normal' : 'Wide'}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Hidden Page Renderer (overflow detection) ────────────────────────────────

interface CachedSlot {
  definition?: ReportDefinition
  dataset?: RawDataset
  visualDefinition?: VisualDefinition
  visualDataset?: RawDataset
  ready: boolean
}

// Reference A4 landscape dimensions (matches viewer proportions)
const A4_W = 1100
const A4_H = Math.round(A4_W / 1.414)   // ~778px
const A4_PAD = 32                         // p-8 in viewer
const A4_GAP = 24                         // space-y-6 in viewer
const A4_FOOTER = 28                      // footer bar in viewer
const A4_CONTENT_H = A4_H - A4_PAD * 2 - A4_FOOTER

function HiddenPageRenderer({
  page,
  onOverflowChange,
}: {
  page: PackPage
  onOverflowChange: (pageId: string, overflows: boolean) => void
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [cache, setCache] = useState<Record<string, CachedSlot>>({})

  // Fetch data for all report/visual slots on this page
  useEffect(() => {
    const slots = page.sections.flatMap((s) => s.slots)
    slots.forEach(async (slot) => {
      if (!slot.artifactId || !slot.artifactType) return
      if (slot.artifactType === 'text' || slot.artifactType === 'image') return
      if (cache[slot.artifactId]?.ready) return

      try {
        if (slot.artifactType === 'visual') {
          const v = await api.getVisual(slot.artifactId, true)
          const def = { ...v.definition, id: v.id, title: v.title, visualType: v.visualType } as VisualDefinition
          setCache((p) => ({ ...p, [slot.artifactId!]: { visualDefinition: def, ready: false } }))
          if (def.cube && def.view) {
            const ds = await api.getDataset(def.cube, def.view, {})
            setCache((p) => ({ ...p, [slot.artifactId!]: { ...p[slot.artifactId!], visualDataset: ds, ready: true } }))
          } else {
            setCache((p) => ({ ...p, [slot.artifactId!]: { ...p[slot.artifactId!], ready: true } }))
          }
        } else {
          const resp = await api.getDefinition(slot.artifactId)
          const def = resp.definition as unknown as ReportDefinition
          setCache((p) => ({ ...p, [slot.artifactId!]: { definition: def, ready: false } }))
          if (def.cube && def.view) {
            const ds = await api.getDataset(def.cube, def.view, {})
            setCache((p) => ({ ...p, [slot.artifactId!]: { ...p[slot.artifactId!], dataset: ds, ready: true } }))
          } else {
            setCache((p) => ({ ...p, [slot.artifactId!]: { ...p[slot.artifactId!], ready: true } }))
          }
        }
      } catch {
        setCache((p) => ({ ...p, [slot.artifactId!]: { ready: true } }))
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id, JSON.stringify(page.sections.flatMap((s) => s.slots.map((sl) => sl.artifactId)))])

  // Measure overflow after every render
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const overflows = el.scrollHeight > el.clientHeight + 2   // +2px tolerance
    onOverflowChange(page.id, overflows)
  })

  return (
    <div style={{
      position: 'fixed',
      left: -A4_W - 100,
      top: 0,
      width: A4_W,
      height: A4_H,
      visibility: 'hidden',
      pointerEvents: 'none',
      zIndex: -1,
      overflow: 'hidden',
    }}>
      <div
        ref={contentRef}
        style={{
          padding: A4_PAD,
          paddingBottom: A4_FOOTER,
          height: A4_CONTENT_H + A4_PAD,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: A4_GAP,
        }}
      >
        {page.sections.map((section) => {
          const widths = presetWidths(section.preset)
          return (
            <div key={section.id} style={{ display: 'flex', gap: A4_GAP, alignItems: 'flex-start', flexShrink: 0 }}>
              {section.slots.map((slot, i) => {
                const w = widths[i] ?? '100%'

                if (slot.artifactType === 'text') {
                  const bgStyle = slot.slotBackground && slot.slotOpacity
                    ? slotBgStyle(slot.slotBackground, slot.slotOpacity)
                    : {}
                  return (
                    <div key={i} style={{ width: w, flexShrink: 0, fontSize: 14, ...bgStyle }}
                      dangerouslySetInnerHTML={{ __html: slot.textContent ?? '' }} />
                  )
                }
                if (slot.artifactType === 'toc') {
                  const tocBgStyle = slotBgStyle(slot.slotBackground, slot.slotOpacity)
                  return (
                    <div key={i} style={{ width: w, flexShrink: 0, fontSize: 11, padding: 8, border: '1px solid #78350f44', borderRadius: 4, color: '#92400e', ...tocBgStyle }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Contents</div>
                      <div style={{ color: '#a16207', fontStyle: 'italic' }}>Auto-generated</div>
                    </div>
                  )
                }
                if (slot.artifactType === 'image' && slot.imageFilename) {
                  return (
                    <div key={i} style={{ width: w, flexShrink: 0 }}>
                      <img src={`http://${window.location.hostname}:8080/images/${slot.imageFilename}`}
                        style={{ maxWidth: '100%' }} alt="" />
                    </div>
                  )
                }
                if (slot.artifactType === 'visual' && slot.artifactId) {
                  const d = cache[slot.artifactId]
                  return (
                    <div key={i} style={{ width: w, flexShrink: 0 }}>
                      {d?.visualDefinition && (
                        <VisualRenderer definition={d.visualDefinition} dataset={d.visualDataset ?? null} />
                      )}
                    </div>
                  )
                }
                if (slot.artifactType === 'report' && slot.artifactId) {
                  const d = cache[slot.artifactId]
                  return (
                    <div key={i} style={{ width: w, flexShrink: 0 }}>
                      {d?.definition && d?.dataset && (
                        <ReportRenderer definition={d.definition} dataset={d.dataset} />
                      )}
                    </div>
                  )
                }
                return <div key={i} style={{ width: w, flexShrink: 0 }} />
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Page Preview Thumbnail ───────────────────────────────────────────────────

const SLOT_BLOCK_COLORS: Record<string, string> = {
  report: '#93c5fd',   // blue-300
  visual: '#60a5fa',   // blue-400
  text:   '#c4b5fd',   // purple-300
  image:  '#6ee7b7',   // emerald-300
}

function PagePreview({ page, overflows }: { page: PackPage; overflows: boolean | null }) {
  const FRAME_W = 160
  const FRAME_H = Math.round(FRAME_W / 1.414)   // ~113px — landscape A4
  const PAD = 6
  const FOOTER_H = 12
  const CONTENT_H = FRAME_H - PAD * 2 - FOOTER_H
  const SECTION_H = 22                           // fixed px per section block
  const GAP = 3
  const MAX_FIT = Math.floor(CONTENT_H / (SECTION_H + GAP))

  const sections = page.sections
  const isOverflow = overflows === true
  const overflowY = PAD + MAX_FIT * (SECTION_H + GAP)

  const bgColour = page.backgroundColour ?? '#111827'
  const bgImageUrl = page.backgroundImage
    ? `http://${window.location.hostname}:8080/images/${page.backgroundImage}`
    : undefined

  return (
    <div
      className="shrink-0 rounded border border-gray-600 overflow-hidden relative select-none"
      style={{
        width: FRAME_W,
        height: FRAME_H,
        backgroundColor: bgColour,
        backgroundImage: bgImageUrl ? `url(${bgImageUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      title={isOverflow
        ? `⚠ Content overflows the page — move sections to another page`
        : overflows === null
          ? 'Measuring…'
          : `${sections.length} section${sections.length !== 1 ? 's' : ''} — fits on page`}
    >
      {/* Section blocks */}
      <div className="absolute flex flex-col" style={{ top: PAD, left: PAD, right: PAD }}>
        {sections.map((section, i) => {
          const widths = presetWidths(section.preset)
          const isOver = i >= MAX_FIT
          return (
            <div key={section.id}
              style={{ height: SECTION_H, marginBottom: GAP, opacity: isOver ? 0.35 : 1, flexShrink: 0 }}
              className="flex gap-0.5 rounded-sm overflow-hidden"
            >
              {section.slots.map((slot, si) => {
                const colour = slot.artifactType
                  ? (SLOT_BLOCK_COLORS[slot.artifactType] ?? '#6b7280')
                  : '#374151'
                return (
                  <div key={si}
                    style={{ width: widths[si] ?? '100%', backgroundColor: colour, flexShrink: 0 }}
                    className="rounded-sm"
                  />
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Overflow line */}
      {isOverflow && (
        <div className="absolute inset-x-0 border-t-2 border-red-400"
          style={{ top: overflowY, borderStyle: 'dashed' }} />
      )}

      {/* Footer bar */}
      <div className="absolute bottom-0 inset-x-0 border-t border-gray-700 flex items-center justify-center"
        style={{ height: FOOTER_H, backgroundColor: 'rgba(0,0,0,0.4)' }}>
        {isOverflow
          ? <span style={{ fontSize: 8, color: '#f87171' }}>⚠ overflow — move sections to next page</span>
          : overflows === null
            ? <span style={{ fontSize: 8, color: '#4b5563' }}>measuring…</span>
            : <span style={{ fontSize: 8, color: '#6b7280' }}>{sections.length} section{sections.length !== 1 ? 's' : ''} — fits</span>
        }
      </div>
    </div>
  )
}

// ─── Page Background Panel ────────────────────────────────────────────────────

// ─── Pack Settings Panel (header / footer defaults) ──────────────────────────

const HEADER_FONTS = [
  { label: 'Default', value: '' },
  { label: 'Georgia (Serif)', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Helvetica Neue', value: '"Helvetica Neue", Helvetica, sans-serif' },
  { label: 'Garamond', value: 'Garamond, serif' },
]

interface PackSettingsPanelProps {
  defaults: PackDefaults
  onChange: (updates: Partial<PackDefaults>) => void
  onClose: () => void
}

function PackSettingsPanel({ defaults, onChange, onClose }: PackSettingsPanelProps) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 mb-6 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-300">Pack Header &amp; Footer</span>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-300"><X className="h-3.5 w-3.5" /></button>
      </div>

      {/* Header */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-gray-400">Header</p>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-gray-500 mb-1 block">Company name</label>
            <input type="text" value={defaults.headerPrefix ?? ''}
              onChange={(e) => onChange({ headerPrefix: e.target.value })}
              placeholder="e.g. Air New Zealand"
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500" />
          </div>
          <div className="flex-[2]">
            <label className="text-[10px] text-gray-500 mb-1 block">Report title <span className="text-gray-600">(bold + underline)</span></label>
            <input type="text" value={defaults.headerTitle ?? ''}
              onChange={(e) => onChange({ headerTitle: e.target.value })}
              placeholder="e.g. Annual Financial Results 2026"
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500" />
          </div>
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-[10px] text-gray-500 mb-1 block">Font</label>
            <select value={defaults.headerFont ?? ''}
              onChange={(e) => onChange({ headerFont: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-gray-500">
              {HEADER_FONTS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 mb-1 block">Colour</label>
            <input type="color" value={defaults.headerColor ?? '#374151'}
              onChange={(e) => onChange({ headerColor: e.target.value })}
              className="w-8 h-7 rounded cursor-pointer border border-gray-700 bg-transparent" />
          </div>
        </div>
        {/* Preview */}
        {(defaults.headerPrefix || defaults.headerTitle) && (
          <div className="bg-white rounded p-2 flex items-center gap-2">
            {defaults.headerPrefix && (
              <span style={{ fontFamily: defaults.headerFont || undefined, color: defaults.headerColor ?? '#374151', fontSize: 11 }}>
                {defaults.headerPrefix}
              </span>
            )}
            {defaults.headerTitle && (
              <span style={{
                fontFamily: defaults.headerFont || undefined,
                color: defaults.headerColor ?? '#374151',
                fontSize: 11,
                fontWeight: 700,
                borderBottom: `2px solid ${defaults.headerColor ?? '#374151'}`,
                paddingBottom: 1,
              }}>
                {defaults.headerTitle}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="space-y-3 border-t border-gray-700 pt-4">
        <p className="text-xs font-medium text-gray-400">Footer defaults</p>
        <div>
          <label className="text-[10px] text-gray-500 mb-1 block">Left text (e.g. statutory disclaimer)</label>
          <textarea value={defaults.footerLeft ?? ''}
            onChange={(e) => onChange({ footerLeft: e.target.value })}
            placeholder="e.g. The accompanying accounting policies support the accounts…"
            rows={2}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none" />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 mb-1 block">Right side</label>
          <div className="flex gap-2">
            {([['page_total', 'Page X / Y'], ['page_only', 'Page X'], ['none', 'None']] as const).map(([v, label]) => (
              <button key={v} onClick={() => onChange({ footerRight: v })}
                className={`px-2.5 py-1 rounded text-xs transition-colors border ${
                  (defaults.footerRight ?? 'page_total') === v
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'border-gray-700 text-gray-400 hover:border-gray-500'
                }`}>{label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

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

      {/* Orientation */}
      <div>
        <label className="text-xs text-gray-500 mb-1.5 block">Orientation</label>
        <div className="flex gap-2">
          {(['landscape', 'portrait'] as const).map((o) => (
            <button key={o}
              onClick={() => onChange({ orientation: o })}
              className={`px-3 py-1 rounded text-xs capitalize transition-colors border ${
                (page.orientation ?? 'landscape') === o
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
              }`}>
              {o}
            </button>
          ))}
        </div>
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
      <div>
        <label className="text-xs text-gray-500 mb-1.5 block">Background image</label>
        {images.length === 0 ? (
          <p className="text-xs text-gray-600 italic">No images in library — upload via the Images tab</p>
        ) : (
          <>
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
          </>
        )}
      </div>

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

      {/* Header / footer per-page overrides */}
      <div className="border-t border-gray-700 pt-4 space-y-3">
        <span className="text-xs font-semibold text-gray-300">Header &amp; Footer</span>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={page.hideHeader ?? false}
              onChange={(e) => onChange({ hideHeader: e.target.checked })}
              className="accent-blue-500" />
            <span className="text-xs text-gray-400">Hide header</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={page.hideFooter ?? false}
              onChange={(e) => onChange({ hideFooter: e.target.checked })}
              className="accent-blue-500" />
            <span className="text-xs text-gray-400">Hide footer</span>
          </label>
        </div>
        {!page.hideFooter && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Footer left text override</label>
            <input
              type="text"
              value={page.footerLeftOverride ?? ''}
              onChange={(e) => onChange({ footerLeftOverride: e.target.value })}
              placeholder="Leave empty to use pack default"
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
            <p className="text-[10px] text-gray-600 mt-0.5">Set to a space " " to show blank left side</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Pack Composer Page ───────────────────────────────────────────────────────

export default function PackComposerPage() {
  const { packId } = useParams<{ packId: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  const [name, setName] = useState('Untitled Pack')
  const [description, setDescription] = useState('')
  const [pages, setPages] = useState<PackPage[]>([])
  const [packDefaults, setPackDefaults] = useState<PackDefaults>(defaultPackDefaults())
  const [, setSelectedPage] = useState(0)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  const [reports, setReports] = useState<PickerReport[]>([])
  const [visuals, setVisuals] = useState<PickerVisual[]>([])
  const [images, setImages] = useState<ImageItem[]>([])
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [bgPanelPageId, setBgPanelPageId] = useState<string | null>(null)
  const [showPackSettings, setShowPackSettings] = useState(false)
  const [pageOverflow, setPageOverflow] = useState<Record<string, boolean | null>>({})


  const handleOverflowChange = useCallback((pageId: string, overflows: boolean) => {
    setPageOverflow((prev) => prev[pageId] === overflows ? prev : { ...prev, [pageId]: overflows })
  }, [])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }
  const markDirty = () => setIsDirty(true)

  // Warn on browser close/refresh when dirty
  useBeforeUnload(
    useCallback((e) => { if (isDirty) e.preventDefault() }, [isDirty])
  )

  // Block in-app navigation when dirty
  const blocker = useBlocker(isDirty)

  useEffect(() => {
    if (!packId) return
    api.getPack(packId).then((p) => {
      setName(p.name)
      setDescription(p.description)
      setStatus(p.status)
      setPackDefaults({ ...defaultPackDefaults(), ...(p.defaults ?? {}) })
      // Migrate old PackSection[] format to PackPage[]
      setPages(migrateLayout(p.layout ?? []))
      setIsDirty(false)
    }).catch(() => showToast('Failed to load pack'))

    api.pickerReports().then((d) => { console.log('pickerReports:', d.reports); setReports(d.reports) }).catch(() => {})
    api.pickerVisuals().then((d) => { console.log('pickerVisuals:', d.visuals); setVisuals(d.visuals) }).catch(() => {})
    api.listImages().then((d) => setImages(d.images)).catch(() => {})
  }, [packId])

  // Scroll to section when arriving via #section-<id> hash link
  useEffect(() => {
    const hash = location.hash
    if (!hash) return
    const id = hash.slice(1)
    // Retry until element is rendered (pages load async)
    let attempts = 0
    const interval = setInterval(() => {
      const el = document.getElementById(id)
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); clearInterval(interval) }
      if (++attempts > 20) clearInterval(interval)
    }, 150)
    return () => clearInterval(interval)
  }, [location.hash])

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

  const updatePageNote = useCallback((pageId: string, note: string) => {
    setPages(prev => prev.map(p => p.id === pageId ? { ...p, pageNote: note || undefined } : p))
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

  const movePage = (pageIdx: number, dir: -1 | 1) => {
    const toIdx = pageIdx + dir
    if (toIdx < 0 || toIdx >= pages.length) return
    setPages((prev) => {
      const newPages = [...prev]
      const [moved] = newPages.splice(pageIdx, 1)
      newPages.splice(toIdx, 0, moved)
      return newPages
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
    defaults: packDefaults,
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
  const placedVisuals = allSlots.filter((sl) => sl.artifactType === 'visual')
    .map((sl) => visuals.find((v) => v.id === sl.artifactId)).filter(Boolean) as PickerVisual[]

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      {/* Top bar */}
      <header className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-3 shrink-0">
        <div className="flex items-center gap-2 text-blue-400 shrink-0">
          <Feather className="h-4 w-4" />
          <span className="text-sm font-semibold">Composer</span>
        </div>
        <div className="w-px h-5 bg-gray-700 shrink-0" />
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); markDirty() }}
          className="bg-transparent text-sm font-medium text-gray-100 focus:outline-none placeholder-gray-600 min-w-0 flex-1 max-w-xs"
          placeholder="Pack name…"
        />
        {isDirty && <span className="text-yellow-400 text-xs font-medium px-1.5 py-0.5 bg-yellow-400/10 rounded">Unsaved changes</span>}
        {status === 'published' && !isDirty && (
          <span className="text-xs text-emerald-400">Published</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => navigate(`/builder?tab=packs&pack=${packId}`)}
            title="Back to Builder"
            className="p-2 text-gray-400 hover:text-gray-200 transition-colors">
            <Layers className="h-4 w-4" />
          </button>
          <button onClick={() => navigate(`/viewer/${packId}`)}
            title="View in Viewer"
            className="p-2 text-gray-400 hover:text-gray-200 transition-colors">
            <Eye className="h-4 w-4" />
          </button>
          <button onClick={handleSaveDraft} disabled={saving}
            title="Save Draft"
            className="p-2 text-gray-400 hover:text-gray-200 disabled:opacity-40 transition-colors">
            <Save className="h-4 w-4" />
          </button>
          <button onClick={handlePublish} disabled={saving}
            title="Publish"
            className="p-2 text-emerald-400 hover:text-emerald-300 disabled:opacity-40 transition-colors">
            <Upload className="h-4 w-4" />
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
            {/* Page / Section / Slot tree */}
            {pages.length > 0 && (
              <div className="mt-1">
                <p className="px-3 py-1.5 text-xs text-gray-600 font-medium uppercase tracking-wide">Pages</p>
                {pages.map((pg, i) => (
                  <div key={pg.id}>
                    <div className="flex items-center gap-2 px-3 py-1 group">
                      {i > 0 && (
                        <button onClick={() => movePage(i, -1)} className="p-0.5 text-gray-600 hover:text-blue-400 opacity-0 group-hover:opacity-100" title="Move page up">
                          <ChevronUp className="h-3 w-3" />
                        </button>
                      )}
                      {i < pages.length - 1 && (
                        <button onClick={() => movePage(i, 1)} className="p-0.5 text-gray-600 hover:text-blue-400 opacity-0 group-hover:opacity-100" title="Move page down">
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      )}
                      <button onClick={() => setSelectedPage(i)} className="flex items-center gap-1.5 flex-1 text-left">
                        {pg.backgroundImage
                          ? <ImageIcon className="h-3 w-3 shrink-0 text-blue-400" />
                          : pg.backgroundColour
                            ? <span className="w-3 h-3 rounded-full shrink-0 border border-gray-600" style={{ backgroundColor: pg.backgroundColour }} />
                            : <span className="w-3 h-3 rounded-full shrink-0 border border-gray-700 bg-gray-800" />
                        }
                        <span className="text-xs text-gray-500">Page {i + 1}</span>
                        {pg.pageNotePriority && !pg.pageNoteResolved && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" title="Has priority note" />
                        )}
                      </button>
                    </div>
                    {pg.sections.map((section, si) => (
                      <div key={`${section.id}-${si}`} className="pl-6">
                          <button onClick={() => setSelectedPage(i)} className="flex items-center gap-1.5 px-2 py-0.5 w-full text-left hover:bg-gray-800 rounded">
                            <LayoutGrid className="h-2.5 w-2.5 text-gray-600" />
                            <span className="text-[10px] text-gray-500">Section {si + 1}</span>
                          </button>
                          <div className="pl-5">
                            {section.slots.map((slot, sli) => (
                              <button
                                key={sli}
                                title={slot.artifactType === 'text' ? (slot.description ?? undefined) : undefined}
                                onClick={() => document.getElementById(`section-${section.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                className="flex items-center gap-1.5 px-2 py-0.5 w-full text-left hover:bg-gray-800 rounded"
                              >
                                {slot.artifactType === 'text' && <FileText className="h-2.5 w-2.5 text-gray-600" />}
                                {slot.artifactType === 'image' && <ImageIcon className="h-2.5 w-2.5 text-gray-600" />}
                                {slot.artifactType === 'toc' && <List className="h-2.5 w-2.5 text-gray-600" />}
                                {slot.artifactType === 'visual' && (() => {
                                  const hasDraft = visuals.find(v => v.id === slot.artifactId)?.hasDraft
                                  return <BarChart3 className={`h-2.5 w-2.5 ${hasDraft ? 'text-yellow-400' : 'text-emerald-400'}`} />
                                })()}
                                {slot.artifactType === 'report' && (() => {
                                  const hasDraft = reports.find(r => r.id === slot.artifactId)?.hasDraft
                                  return <FileText className={`h-2.5 w-2.5 ${hasDraft ? 'text-yellow-400' : 'text-emerald-400'}`} />
                                })()}
                                <span className="text-[10px] text-gray-400 truncate">
                                  {slot.artifactType === 'text'
                                    ? (slot.label || slot.noteLabel || 'Text')
                                    : slot.artifactType === 'report'
                                      ? (slot.label || (placedReports.find(r => r.id === slot.artifactId)?.title ?? 'Report'))
                                      : slot.artifactType === 'visual'
                                        ? (slot.label || (placedVisuals.find(v => v.id === slot.artifactId)?.title ?? 'Visual'))
                                        : slot.artifactType === 'toc'
                                          ? (slot.label || 'Contents')
                                          : slot.artifactType === 'html'
                                            ? (slot.label || 'HTML')
                                            : (slot.label || slot.imageFilename || 'Image')}
                                </span>
                              </button>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Main canvas */}
        <main className="flex-1 overflow-y-auto bg-gray-950 p-6">
          <div className="max-w-4xl mx-auto">
            {/* Pack-level settings */}
            <div className="mb-4">
              <button
                onClick={() => setShowPackSettings((v) => !v)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
                  showPackSettings
                    ? 'border-blue-500 text-blue-400 bg-blue-900/20'
                    : 'border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
                }`}
              >
                <Settings className="h-3.5 w-3.5" />
                Header &amp; Footer
                {(packDefaults.headerTitle || packDefaults.footerLeft) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 ml-0.5" />
                )}
              </button>
              {showPackSettings && (
                <div className="mt-3">
                  <PackSettingsPanel
                    defaults={packDefaults}
                    onChange={(updates) => { setPackDefaults((prev) => ({ ...prev, ...updates })); markDirty() }}
                    onClose={() => setShowPackSettings(false)}
                  />
                </div>
              )}
            </div>

            {pages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-700">
                <LayoutTemplate className="h-12 w-12 mb-4" />
                <p className="text-sm mb-1">No pages yet</p>
                <p className="text-xs">Click "Add Page" to start building</p>
              </div>
            )}

            {pages.map((page, pageIdx) => (
              <div key={page.id} id={`page-${page.id}`} ref={(el) => { pageRefs.current[pageIdx] = el }}>
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

                {/* Sections + live page preview */}
                <div className="flex gap-4 items-start">
                  <div className="flex-1 min-w-0">
                    {page.sections.length === 0 && (
                      <p className="text-xs text-gray-700 text-center py-4">No sections on this page — add one below</p>
                    )}
                    {page.sections.map((section, sIdx) => (
                      <div key={section.id} id={`section-${section.id}`}>
                      <SectionCard
                        section={section}
                        index={sIdx}
                        total={page.sections.length}
                        pageIndex={pageIdx}
                        totalPages={pages.length}
                        reports={reports} visuals={visuals} images={images}
                        onChange={(updated) => updateSectionInPage(page.id, updated)}
                        onMoveUp={() => moveSectionInPage(page.id, sIdx, -1)}
                        onMoveDown={() => moveSectionInPage(page.id, sIdx, 1)}
                        onMoveToPrevPage={pageIdx > 0 ? () => moveSectionToPage(page.id, section.id, -1) : undefined}
                        onMoveToNextPage={pageIdx < pages.length - 1 ? () => moveSectionToPage(page.id, section.id, 1) : undefined}
                        onDelete={() => deleteSectionFromPage(page.id, section.id)}
                      />
                      </div>
                    ))}
                  </div>
                  <div className="sticky top-4 flex flex-col gap-2" style={{ width: 164 }}>
                    <PagePreview page={page} overflows={pageOverflow[page.id] ?? null} />
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] text-gray-500">Page note</p>
                        <div className="flex items-center gap-1">
                          {page.pageNotePriority && !page.pageNoteResolved && (
                            <button
                              onClick={() => { setPages(prev => prev.map(p => p.id === page.id ? { ...p, pageNoteResolved: true } : p)); markDirty() }}
                              className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/70 transition-colors"
                              title="Mark as resolved"
                            >
                              <CheckCheck className="h-2.5 w-2.5" />
                              Resolve
                            </button>
                          )}
                          {page.pageNoteResolved && (
                            <button
                              onClick={() => { setPages(prev => prev.map(p => p.id === page.id ? { ...p, pageNoteResolved: false, pageNotePriority: true } : p)); markDirty() }}
                              className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] bg-gray-800 text-gray-500 hover:text-red-400 transition-colors"
                              title="Reopen"
                            >
                              <Flag className="h-2.5 w-2.5" />
                              Reopen
                            </button>
                          )}
                          {!page.pageNotePriority && (
                            <button
                              onClick={() => { setPages(prev => prev.map(p => p.id === page.id ? { ...p, pageNotePriority: true, pageNoteResolved: false } : p)); markDirty() }}
                              className="p-0.5 text-gray-600 hover:text-red-400 transition-colors"
                              title="Flag as priority"
                            >
                              <Flag className="h-3 w-3" />
                            </button>
                          )}
                          {page.pageNotePriority && !page.pageNoteResolved && (
                            <button
                              onClick={() => { setPages(prev => prev.map(p => p.id === page.id ? { ...p, pageNotePriority: false } : p)); markDirty() }}
                              className="p-0.5 text-red-400 hover:text-gray-600 transition-colors"
                              title="Remove priority flag"
                            >
                              <Flag className="h-3 w-3 fill-current" />
                            </button>
                          )}
                        </div>
                      </div>
                      <textarea
                        value={page.pageNote ?? ''}
                        onChange={(e) => updatePageNote(page.id, e.target.value)}
                        placeholder={page.pageNotePriority && !page.pageNoteResolved ? 'Describe what needs fixing…' : 'Add a reviewer note for this page…'}
                        className={`w-full h-20 text-xs rounded p-1.5 placeholder-gray-600 focus:outline-none resize-none transition-colors ${
                          page.pageNotePriority && !page.pageNoteResolved
                            ? 'bg-red-950/40 border border-red-700 text-red-200 focus:border-red-500'
                            : page.pageNoteResolved
                              ? 'bg-emerald-950/30 border border-emerald-900 text-gray-400 focus:border-emerald-700'
                              : 'bg-gray-900 border border-gray-700 text-gray-300 focus:border-blue-500'
                        }`}
                      />
                      {page.pageNoteResolved && (
                        <p className="text-[10px] text-emerald-600 mt-0.5">✓ Resolved</p>
                      )}
                    </div>
                  </div>
                </div>

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
        {/* Hidden renderers for overflow detection — off-screen, one per page */}
        {pages.map((page) => (
          <HiddenPageRenderer key={page.id} page={page} onOverflowChange={handleOverflowChange} />
        ))}
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 text-gray-100
                        text-xs px-4 py-2 rounded-lg shadow-lg border border-gray-700 z-50">
          {toast}
        </div>
      )}

      {/* Unsaved changes navigation blocker */}
      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-sm font-semibold text-gray-100 mb-2">Unsaved changes</h3>
            <p className="text-xs text-gray-400 mb-5">
              You have unsaved changes in this pack. If you leave now they will be lost.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => blocker.reset()}
                className="px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white transition-colors"
              >
                Stay
              </button>
              <button
                onClick={() => blocker.proceed()}
                className="px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors"
              >
                Leave without saving
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
