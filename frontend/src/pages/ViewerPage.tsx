import { useEffect, useState, useCallback, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  BarChart3, BookOpen, ChevronRight, ChevronDown,
  FileText, Loader2, ShieldAlert, Layers, Feather,
  LayoutGrid, List, Maximize2,
} from 'lucide-react'
import { api, RawDataset, PackListItem, FolderListItem } from '../lib/api'
import { ReportDefinition, VisualDefinition, PackSection, SectionPreset, migrateLayout, PackPage } from '../types/report'
import ReportRenderer from '../components/shared/ReportRenderer'
import VisualRenderer from '../components/shared/VisualRenderer'
import SelectorBar from '../components/shared/SelectorBar'

// ─── Preset widths ────────────────────────────────────────────────────────────

const PRESET_WIDTHS: Record<SectionPreset, string[]> = {
  'full':                   ['100%'],
  'half':                   ['50%', '50%'],
  'two-thirds':             ['66.67%', '33.33%'],
  'third-two-thirds':       ['33.33%', '66.67%'],
  'thirds':                 ['33.33%', '33.33%', '33.33%'],
  'quarter-three-quarters': ['25%', '75%'],
  'three-quarters-quarter': ['75%', '25%'],
  'quarter-half-quarter':   ['25%', '50%', '25%'],
  'half-quarter-quarter':   ['50%', '25%', '25%'],
  'quarters':               ['25%', '25%', '25%', '25%'],
  // Multi-row presets
  'full-3':                 ['100%', '33.33%', '33.33%', '33.33%'],
  '3-full':                 ['33.33%', '33.33%', '33.33%', '100%'],
  'full-2':                 ['100%', '50%', '50%'],
  '2-full':                 ['50%', '50%', '100%'],
  'full-half':               ['100%', '50%', '50%'],
  'half-full':              ['50%', '50%', '100%'],
  'half-half':               ['50%', '50%', '50%', '50%'],
  'full-half-half':         ['100%', '50%', '50%', '50%', '50%'],
  'half-half-full':        ['50%', '50%', '50%', '50%', '100%'],
}

// ─── Slot state ───────────────────────────────────────────────────────────────

interface ArtifactSlot {
  artifactId: string
  artifactType: 'report' | 'visual' | 'text' | 'image' | 'toc'
  definition: ReportDefinition | null
  dataset: RawDataset | null
  overrides: Record<string, string>
  visualDefinition: VisualDefinition | null
  visualDataset: RawDataset | null
  loading: boolean
  error: string
  // inline content for text/image slots
  textContent?: string | null
  imageFilename?: string | null
  label?: string | null
  noteLabel?: string | null
  dataAsOf?: string | null
  slotBackground?: string | null
  slotOpacity?: number | null
}

interface ViewerSection {
  sectionId: string
  preset: SectionPreset
  slots: ArtifactSlot[]
  rows?: { id: string; preset: string; slots: ArtifactSlot[] }[]
  gapAfter?: 'none' | 'tight' | 'normal' | 'wide'
}

interface ViewerPageGroup {
  pageId: string
  orientation?: 'landscape' | 'portrait'
  backgroundColour?: string
  backgroundImage?: string
  overlayColour?: string
  overlayOpacity?: number
  sectionIds: string[]   // ordered list of sectionIds in this page
}

// ─── Page sheet renderer ──────────────────────────────────────────────────────

const BASE_URL = `http://${window.location.hostname}:8080`

function PageSheet({
  page, pageNumber, totalPages, packName, confirmedDate,
  sections, allSections, onOverrideChange, onNoteRefClick, artifactRefs,
  compact = false,
}: {
  page: ViewerPageGroup
  pageNumber: number
  totalPages: number
  packName: string
  confirmedDate?: string
  sections: ViewerSection[]
  allSections: ViewerSection[]
  onOverrideChange: (id: string, overrides: Record<string, string>) => void
  onNoteRefClick: (ref: string) => void
  artifactRefs: React.RefObject<Map<string, HTMLDivElement>>
  compact?: boolean
}) {
  const isPortrait = page.orientation === 'portrait'
  // A4 landscape 297×210mm → 1.414:1 | A4 portrait 210×297mm → 1:1.414
  const aspectRatio = isPortrait ? '1 / 1.414' : '1.414 / 1'

  const bgStyle: React.CSSProperties = {
    backgroundColor: page.backgroundColour ?? '#ffffff',
  }

  if (page.backgroundImage) {
    bgStyle.backgroundImage = `url(${BASE_URL}/images/${page.backgroundImage})`
    bgStyle.backgroundSize = 'cover'
    bgStyle.backgroundPosition = 'center'
  }

  const hasOverlay = page.overlayOpacity && page.overlayOpacity > 0

  const confirmedLabel = confirmedDate
    ? new Date(confirmedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : ''

  // Landscape: wide sheet ~1100px. Portrait: narrower but still readable ~700px.
  // aspectRatio controls height automatically from the chosen width.
  // In compact mode (grid view), reduce maxWidth
  const maxWidth = isPortrait ? (compact ? '300px' : '700px') : (compact ? '420px' : '1100px')
  const padding = compact ? 'p-3' : 'p-8'
  const margin = compact ? 'mb-4' : 'mb-10'
  const titleSize = compact ? 'text-[10px]' : 'text-xs'

  return (
    <div id={`page-${page.pageId}`} className={`flex justify-center ${margin}`}>
    <div className="relative shadow-2xl overflow-hidden rounded-sm w-full group"
      style={{ ...bgStyle, aspectRatio, maxWidth }}>

      {/* Page header - shows on hover (always show in compact) */}
      <div className={`absolute top-0 left-0 right-0 px-3 py-1 bg-black/5 ${compact ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity flex items-center gap-2 z-10`}>
        <span className={`${titleSize} font-medium text-gray-500`}>Page {pageNumber}</span>
        {page.backgroundColour && (
          <span className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: page.backgroundColour }} />
        )}
      </div>

      {/* Overlay */}
      {hasOverlay && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: page.overlayColour ?? '#ffffff', opacity: page.overlayOpacity }} />
      )}

      {/* Content */}
      <div className="absolute inset-0 flex flex-col">
        <div className={`flex-1 overflow-hidden ${padding} flex flex-col ${compact ? 'gap-2' : ''}`}>
          {sections.map((section, idx) => {
            const isLast = idx === sections.length - 1
            const gap = compact ? 0 : isLast ? 0 : ({ none: 0, tight: 8, normal: 24, wide: 48 }[section.gapAfter ?? 'normal'])
            return (
              <div key={section.sectionId} style={gap ? { marginBottom: gap } : undefined}>
                <SectionView
                  section={section}
                  allSections={allSections}
                  onOverrideChange={onOverrideChange}
                  onNoteRefClick={onNoteRefClick}
                  artifactRefs={artifactRefs}
                />
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-8 py-2 border-t border-black/10 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-gray-500 min-w-0">
            {packName && <span className="truncate font-medium">{packName}</span>}
            {confirmedLabel && (
              <>
                <span className="text-gray-300">·</span>
                <span className="truncate">Confirmed {confirmedLabel}</span>
              </>
            )}
          </div>
          <span className="text-xs text-gray-400 shrink-0 ml-4">
            {pageNumber} / {totalPages}
          </span>
        </div>
      </div>
    </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function PackGroup({
  pack, sections, activeId, isActive, onSelectPack, onScrollTo,
}: {
  pack: PackListItem
  sections: ViewerSection[]
  activeId: string | null
  isActive: boolean
  onSelectPack: () => void
  onScrollTo: (id: string) => void
}) {
  const [open, setOpen] = useState(isActive)
  const artifacts = sections.flatMap((s) => s.slots).filter((s) => s.artifactType === 'report' || s.artifactType === 'visual')

  return (
    <div>
      <div className={`flex items-center gap-1 px-2 py-2 transition-colors cursor-pointer
        ${isActive ? 'bg-blue-50' : 'hover:bg-gray-100'}`}>
        <button onClick={() => setOpen((v) => !v)} className="shrink-0 p-0.5">
          {open
            ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
        </button>
        <button onClick={() => { setOpen(true); onSelectPack() }}
          className="flex items-center gap-2 flex-1 min-w-0 text-left">
          <Layers className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-blue-400' : 'text-blue-400'}`} />
          <span className={`truncate text-sm font-semibold ${isActive ? 'text-blue-700' : 'text-gray-800'}`}>
            {pack.name}
          </span>
          <span className="ml-auto text-xs text-gray-400 shrink-0">{artifacts.length}</span>
        </button>
      </div>

      {open && artifacts.map((slot) => (
        <button key={slot.artifactId}
          onClick={() => onScrollTo(slot.artifactId)}
          className={`w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-left transition-colors
            ${activeId === slot.artifactId ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          {slot.artifactType === 'visual'
            ? <BarChart3 className="h-3 w-3 shrink-0 text-blue-400" />
            : <FileText className="h-3 w-3 shrink-0 text-gray-400" />
          }
          <span className="flex-1 truncate text-xs">
            {slot.artifactType === 'visual'
              ? slot.visualDefinition?.title || '…'
              : slot.definition?.title || '…'
            }
          </span>
        </button>
      ))}
    </div>
  )
}

// ─── Visual card ─────────────────────────────────────────────────────────────

function VisualCard({ slot, cardRef }: {
  slot: ArtifactSlot
  cardRef: (el: HTMLDivElement | null) => void
}) {
  if (slot.loading) {
    return (
      <div ref={cardRef} className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
      </div>
    )
  }
  if (slot.error) {
    return <div ref={cardRef} className="bg-white rounded-lg p-6 text-sm text-red-500">{slot.error}</div>
  }
  if (!slot.visualDefinition) return null

  return (
    <div ref={cardRef} className="bg-white overflow-hidden scroll-mt-4">
      <VisualRenderer definition={slot.visualDefinition} dataset={slot.visualDataset} />
    </div>
  )
}

// ─── Report card ──────────────────────────────────────────────────────────────

function ReportCard({ slot, onOverrideChange, onNoteRefClick, cardRef }: {
  slot: ArtifactSlot
  onOverrideChange: (id: string, overrides: Record<string, string>) => void
  onNoteRefClick: (ref: string) => void
  cardRef: (el: HTMLDivElement | null) => void
}) {
  if (slot.loading && !slot.dataset) {
    return (
      <div ref={cardRef} className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
      </div>
    )
  }
  if (slot.error) {
    return <div ref={cardRef} className="bg-white rounded-lg p-6 text-sm text-red-500">{slot.error}</div>
  }
  if (!slot.definition || !slot.dataset) return null

  return (
    <div ref={cardRef} className="bg-white overflow-hidden scroll-mt-4">
      {slot.definition.selectors?.some((s) => !s.locked) && (
        <SelectorBar
          dataset={slot.dataset}
          selectors={slot.definition.selectors}
          overrides={slot.overrides}
          onChange={(ov) => onOverrideChange(slot.artifactId, ov)}
          viewerMode
        />
      )}
      {slot.loading && (
        <div className="flex justify-center py-1">
          <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />
        </div>
      )}
      <ReportRenderer definition={slot.definition} dataset={slot.dataset} onNoteRefClick={onNoteRefClick} />
      {slot.dataAsOf && (
        <div className="px-5 py-1.5 text-xs text-gray-400 border-t border-gray-100">
          Data as of {new Date(slot.dataAsOf).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </div>
  )
}

// ─── Section renderer ─────────────────────────────────────────────────────────

function SectionView({ section, allSections, onOverrideChange, onNoteRefClick, artifactRefs }: {
  section: ViewerSection
  allSections: ViewerSection[]
  onOverrideChange: (id: string, overrides: Record<string, string>) => void
  onNoteRefClick: (ref: string) => void
  artifactRefs: React.RefObject<Map<string, HTMLDivElement>>
}) {
  const widths = PRESET_WIDTHS[section.preset] ?? ['100%']
  const typeLabel = (type: string) => {
    const labels: Record<string, string> = { report: 'Report', visual: 'Visual', text: 'Note', image: 'Image' }
    return labels[type] ?? type
  }

  const isMultiRow = section.rows && section.rows.length > 0

  if (isMultiRow && section.rows) {
    // Multi-row section rendering
    const presetWidths = PRESET_WIDTHS[section.preset] ?? ['100%']
    let widthOffset = 0
    return (
      <div className="flex flex-col gap-6">
        {section.rows.map((row) => {
          const rowSlotCount = row.slots.length
          const rawRowWidths = presetWidths.slice(widthOffset, widthOffset + rowSlotCount)
          const rowWidths = rawRowWidths.map((w) => {
            if (rowSlotCount <= 1) return w
            const pct = parseFloat(w)
            const gapDeduction = (24 * (rowSlotCount - 1) / rowSlotCount)
            return `calc(${pct}% - ${gapDeduction}px)`
          })
          widthOffset += rowSlotCount
          return (
            <div key={row.id} className="flex gap-6 items-start">
              {row.slots.map((slot, i) => {
                const width = rowWidths[i] ?? '100%'
                return (
                  <div key={slot.artifactId} style={{ width }} className="min-w-0 flex-shrink-0 group relative">
                    {slot.artifactType !== 'toc' && (
                      <button onClick={() => document.getElementById(`slot-${slot.artifactId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        className="absolute -top-3 left-2 px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-gray-200">
                        {typeLabel(slot.artifactType)}
                      </button>
                    )}
                    {slot.artifactType === 'toc' ? (
                      <div className="rounded-lg p-4 text-sm scroll-mt-4 bg-gray-50">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contents</p>
                        <ol className="space-y-1.5">
                          {allSections.flatMap((s) => s.rows ? s.rows.flatMap(r => r.slots) : s.slots).filter((sl) => {
                            if (sl.artifactType === 'toc') return false
                            if (sl.artifactType === 'text') return true
                            if (sl.artifactType === 'image') return !!sl.label
                            if (sl.artifactType === 'report') return !!sl.label
                            if (sl.artifactType === 'visual') return !!sl.label
                            return true
                          }).map((sl, idx) => {
                            const title = sl.artifactType === 'text'
                              ? (sl.noteLabel || `Note ${idx + 1}`)
                              : sl.label ?? (sl.artifactType === 'visual'
                                ? (sl.visualDefinition?.title ?? 'Visual')
                                : sl.definition?.title ?? 'Report')
                            return (
                              <li key={sl.artifactId}>
                                <button
                                  onClick={() => document.getElementById(`slot-${sl.artifactId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                  className="flex items-center gap-2 w-full text-left hover:text-blue-600 transition-colors group"
                                >
                                  <span className="text-xs text-gray-400 w-5 shrink-0">{idx + 1}</span>
                                  <span className="flex-1 text-xs text-gray-700 group-hover:text-blue-600 truncate">{title}</span>
                                </button>
                              </li>
                            )
                          })}
                        </ol>
                      </div>
                    ) : slot.artifactType === 'text' ? (
                      <div
                        ref={(el) => {
                          if (el) artifactRefs.current.set(slot.artifactId, el)
                          else artifactRefs.current.delete(slot.artifactId)
                        }}
                        className="rounded-lg p-4 text-sm overflow-auto scroll-mt-4"
                        style={slot.slotBackground && slot.slotOpacity != null
                          ? { backgroundColor: slot.slotBackground + Math.round(slot.slotOpacity * 255).toString(16).padStart(2, '0') }
                          : { backgroundColor: '#ffffff' }}
                        dangerouslySetInnerHTML={{ __html: slot.textContent ?? '' }}
                      />
                    ) : slot.artifactType === 'image' ? (
                      <div className="bg-white rounded-lg p-2 flex items-center justify-center overflow-hidden h-full">
                        {slot.imageFilename ? (
                          <img
                            src={`http://${window.location.hostname}:8080/images/${slot.imageFilename}`}
                            alt={slot.imageFilename ?? ''}
                            className="max-w-full max-h-full object-contain rounded"
                          />
                        ) : (
                          <span className="text-xs text-gray-400">No image</span>
                        )}
                      </div>
                    ) : slot.artifactType === 'visual' ? (
                      <VisualCard
                        slot={slot}
                        cardRef={(el) => {
                          if (el) artifactRefs.current.set(slot.artifactId, el)
                          else artifactRefs.current.delete(slot.artifactId)
                        }}
                      />
                    ) : (
                      <ReportCard
                        slot={slot}
                        onOverrideChange={onOverrideChange}
                        onNoteRefClick={onNoteRefClick}
                        cardRef={(el) => {
                          if (el) artifactRefs.current.set(slot.artifactId, el)
                          else artifactRefs.current.delete(slot.artifactId)
                        }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }

  // Single-row section (original)
  // gap-6 = 1.5rem = 24px. Each slot must lose (24 * numGaps / numSlots) px so totals stay at 100%.
  const numSlots = section.slots.length
  const adjustedWidths = widths.map((w) => {
    if (numSlots <= 1) return w
    const pct = parseFloat(w)
    const gapDeduction = (24 * (numSlots - 1) / numSlots)
    return `calc(${pct}% - ${gapDeduction}px)`
  })
  return (
    <div className="flex gap-6 items-start">
      {section.slots.map((slot, i) => (
        <div key={slot.artifactId} id={`slot-${slot.artifactId}`} style={{ width: adjustedWidths[i] }} className="min-w-0 flex-shrink-0 group relative">
          {slot.artifactType !== 'toc' && (
            <button onClick={() => document.getElementById(`slot-${slot.artifactId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="absolute -top-3 left-2 px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-gray-200">
              {typeLabel(slot.artifactType)}
            </button>
          )}
          {slot.artifactType === 'toc' ? (
            <div className="rounded-lg p-4 text-sm scroll-mt-4 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contents</p>
              <ol className="space-y-1.5">
                {allSections.flatMap((s) => s.rows ? s.rows.flatMap(r => r.slots) : s.slots).filter((sl) => {
                  if (sl.artifactType === 'toc') return false
                  if (sl.artifactType === 'text') return true
                  if (sl.artifactType === 'image') return !!sl.label
                  if (sl.artifactType === 'report') return !!sl.label
                  if (sl.artifactType === 'visual') return !!sl.label
                  return true
                }).map((sl, idx) => {
                  const title = sl.artifactType === 'text'
                    ? (sl.noteLabel || `Note ${idx + 1}`)
                    : sl.label ?? (sl.artifactType === 'visual'
                      ? (sl.visualDefinition?.title ?? 'Visual')
                      : sl.definition?.title ?? 'Report')
                  return (
                    <li key={sl.artifactId}>
                      <button
                        onClick={() => document.getElementById(`slot-${sl.artifactId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        className="flex items-center gap-2 w-full text-left hover:text-blue-600 transition-colors group"
                      >
                        <span className="text-xs text-gray-400 w-5 shrink-0">{idx + 1}</span>
                        <span className="flex-1 text-xs text-gray-700 group-hover:text-blue-600 truncate">{title}</span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </div>
          ) : slot.artifactType === 'text' ? (
            <div
              ref={(el) => {
                if (el) artifactRefs.current.set(slot.artifactId, el)
                else artifactRefs.current.delete(slot.artifactId)
              }}
              className="rounded-lg p-4 text-sm overflow-auto scroll-mt-4"
              style={slot.slotBackground && slot.slotOpacity != null
                ? { backgroundColor: slot.slotBackground + Math.round(slot.slotOpacity * 255).toString(16).padStart(2, '0') }
                : { backgroundColor: '#ffffff' }}
              dangerouslySetInnerHTML={{ __html: slot.textContent ?? '' }}
            />
          ) : slot.artifactType === 'image' ? (
            <div className="bg-white rounded-lg p-2 flex items-center justify-center overflow-hidden h-full">
              {slot.imageFilename ? (
                <img
                  src={`http://${window.location.hostname}:8080/images/${slot.imageFilename}`}
                  alt={slot.imageFilename ?? ''}
                  className="max-w-full max-h-full object-contain rounded"
                />
              ) : (
                <span className="text-xs text-gray-400">No image</span>
              )}
            </div>
          ) : slot.artifactType === 'visual' ? (
            <VisualCard
              slot={slot}
              cardRef={(el) => {
                if (el) artifactRefs.current.set(slot.artifactId, el)
                else artifactRefs.current.delete(slot.artifactId)
              }}
            />
          ) : (
            <ReportCard
              slot={slot}
              onOverrideChange={onOverrideChange}
              onNoteRefClick={onNoteRefClick}
              cardRef={(el) => {
                if (el) artifactRefs.current.set(slot.artifactId, el)
                else artifactRefs.current.delete(slot.artifactId)
              }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Main viewer ──────────────────────────────────────────────────────────────

export default function ViewerPage() {
  const navigate = useNavigate()
  const { packId: urlPackId } = useParams<{ packId?: string }>()
  const [packs, setPacks] = useState<PackListItem[]>([])
  const [activePack, setActivePack] = useState<PackListItem | null>(null)
  const [viewerSections, setViewerSections] = useState<ViewerSection[]>([])
  const [viewerPageGroups, setViewerPageGroups] = useState<ViewerPageGroup[]>([])
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [packFolders, setPackFolders] = useState<FolderListItem[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'single' | 'side-by-side' | 'grid'>('single')
  const artifactRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const toggleFolder = (id: string) => setExpandedFolders(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })

  useEffect(() => {
    api.listPacks().then((d) => {
      setPacks(d.packs)
      // Auto-select pack from URL param (e.g. coming from composer View button)
      if (urlPackId) {
        const target = d.packs.find((p) => p.id === urlPackId)
        if (target) handleSelectPack(target)
      }
    }).catch(() => {})
    api.listFolders('pack').then((d) => setPackFolders(d.folders)).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateSlot = useCallback((artifactId: string, patch: Partial<ArtifactSlot>) => {
    setViewerSections((prev) => prev.map((section) => {
      const isMultiRow = section.rows && section.rows.length > 0
      if (isMultiRow && section.rows) {
        return {
          ...section,
          rows: section.rows.map((row) => ({
            ...row,
            slots: row.slots.map((slot) =>
              slot.artifactId === artifactId ? { ...slot, ...patch } : slot
            )
          }))
        }
      }
      return {
        ...section,
        slots: section.slots.map((slot) =>
          slot.artifactId === artifactId ? { ...slot, ...patch } : slot
        ),
      }
    }))
  }, [])

  const handleSelectPack = useCallback(async (stale: PackListItem) => {
    setActivePack(stale)
    setActiveArtifactId(null)
    setViewerPageGroups([])
    artifactRefs.current.clear()

    // Always re-fetch so we get the latest statements/layout, not stale list data
    const pack = await api.getPack(stale.id).catch(() => stale)
    setActivePack(pack)

    const makeSlot = (artifactId: string, artifactType: 'report' | 'visual', label?: string | null): ArtifactSlot => ({
      artifactId, artifactType,
      definition: null, dataset: null, overrides: {},
      visualDefinition: null, visualDataset: null,
      loading: true, error: '', label: label ?? null,
    })

    let sections: ViewerSection[]

    // Migrate old PackSection[] format to PackPage[] transparently
    const pages = migrateLayout(pack.layout ?? [])

    // Resolve artifact types from picker APIs (needed for statements not in layout slots)
    const [_rRes, vRes] = await Promise.allSettled([
      api.pickerReports().then((d) => d.reports),
      api.pickerVisuals().then((d) => d.visuals),
    ])
    const vIds = new Set(vRes.status === 'fulfilled' ? vRes.value.map((v) => v.id) : [])
    const getType = (id: string): 'report' | 'visual' =>
      vIds.has(id) ? 'visual' : 'report'

    const flatSections: PackSection[] = pages.flatMap((pg) => pg.sections)

    if (flatSections.length > 0) {
      // Composer layout — build sections and page groups in parallel
      const sectionMap = new Map<string, ViewerSection>()
      flatSections.forEach((section) => {
        const isMultiRow = section.rows && section.rows.length > 0

        if (isMultiRow && section.rows) {
          // Multi-row section
          const vs: ViewerSection = {
            sectionId: section.id,
            preset: section.preset,
            slots: [],
            gapAfter: section.gapAfter,
            rows: section.rows.map((row) => ({
              id: row.id,
              preset: row.preset,
              slots: row.slots
                .filter((sl) => sl.artifactType === 'text' || sl.artifactType === 'image' || sl.artifactType === 'toc' || (sl.artifactId && sl.artifactType))
                .map((sl, slIdx): ArtifactSlot => {
                  if (sl.artifactType === 'text') {
                    return { artifactId: sl.artifactId ?? `${row.id}-text-${slIdx}`, artifactType: 'text', definition: null, dataset: null, overrides: {}, visualDefinition: null, visualDataset: null, loading: false, error: '', textContent: sl.textContent, noteLabel: sl.noteLabel, slotBackground: sl.slotBackground, slotOpacity: sl.slotOpacity }
                  }
                  if (sl.artifactType === 'toc') {
                    return { artifactId: `${row.id}-toc-${slIdx}`, artifactType: 'toc', definition: null, dataset: null, overrides: {}, visualDefinition: null, visualDataset: null, loading: false, error: '' }
                  }
                  if (sl.artifactType === 'image') {
                    return { artifactId: sl.artifactId ?? `${row.id}-img-${slIdx}`, artifactType: 'image', definition: null, dataset: null, overrides: {}, visualDefinition: null, visualDataset: null, loading: false, error: '', imageFilename: sl.imageFilename, label: sl.label ?? null }
                  }
                  return makeSlot(sl.artifactId!, sl.artifactType === 'visual' ? 'visual' : 'report', sl.label)
                }),
            })),
          }
          // Add rows with slots
          const hasContent = vs.rows?.some((r) => r.slots.length > 0)
          if (hasContent) sectionMap.set(section.id, vs)
        } else {
          // Single-row section (original)
          const vs: ViewerSection = {
            sectionId: section.id,
            preset: section.preset,
            gapAfter: section.gapAfter,
            slots: section.slots
              .filter((sl) => sl.artifactType === 'text' || sl.artifactType === 'image' || sl.artifactType === 'toc' || (sl.artifactId && sl.artifactType))
              .map((sl, slIdx): ArtifactSlot => {
                if (sl.artifactType === 'text') {
                  return { artifactId: sl.artifactId ?? `${section.id}-text-${slIdx}`, artifactType: 'text', definition: null, dataset: null, overrides: {}, visualDefinition: null, visualDataset: null, loading: false, error: '', textContent: sl.textContent, noteLabel: sl.noteLabel, slotBackground: sl.slotBackground, slotOpacity: sl.slotOpacity }
                }
                if (sl.artifactType === 'toc') {
                  return { artifactId: `${section.id}-toc-${slIdx}`, artifactType: 'toc', definition: null, dataset: null, overrides: {}, visualDefinition: null, visualDataset: null, loading: false, error: '' }
                }
                if (sl.artifactType === 'image') {
                  return { artifactId: sl.artifactId ?? `${section.id}-img-${slIdx}`, artifactType: 'image', definition: null, dataset: null, overrides: {}, visualDefinition: null, visualDataset: null, loading: false, error: '', imageFilename: sl.imageFilename }
                }
                return makeSlot(sl.artifactId!, sl.artifactType === 'visual' ? 'visual' : 'report', sl.label)
              }),
          }
          if (vs.slots.length > 0) sectionMap.set(section.id, vs)
        }
      })

      // Build page groups — include all pages, even empty ones (for background images)
      const pageGroups: ViewerPageGroup[] = pages.map((pg: PackPage) => ({
        pageId: pg.id,
        orientation: pg.orientation,
        backgroundColour: pg.backgroundColour,
        backgroundImage: pg.backgroundImage,
        overlayColour: pg.overlayColour,
        overlayOpacity: pg.overlayOpacity,
        sectionIds: pg.sections.map((s) => s.id).filter((id) => sectionMap.has(id)),
      }))

      sections = [...sectionMap.values()]

      // Append orphan statements (in statements but not in layout) as a final page
      // Orphans are artifact IDs not in any layout slot
      const orphanSections: ViewerSection[] = []
      const orphans = (pack.statements ?? []).filter((id) => {
        return !sections.some((s) => s.slots.some((sl) => sl.artifactId === id))
      })
      orphans.forEach((id) => {
        const vs: ViewerSection = { sectionId: id, preset: 'full', slots: [makeSlot(id, getType(id))] }
        orphanSections.push(vs)
      })
      if (orphanSections.length > 0) {
        sections = [...sections, ...orphanSections]
        pageGroups.push({
          pageId: 'orphans',
          sectionIds: orphanSections.map((s) => s.sectionId),
        })
      }

      setViewerPageGroups(pageGroups)
    } else {
      // No layout — render statements full-width, one page per statement
      sections = (pack.statements ?? []).map((id) => ({
        sectionId: id,
        preset: 'full' as SectionPreset,
        slots: [makeSlot(id, getType(id))],
      }))
      setViewerPageGroups(sections.map((s) => ({
        pageId: s.sectionId,
        sectionIds: [s.sectionId],
      })))
    }

    setViewerSections(sections)

    // First artifact becomes active for sidebar highlight
    const firstId = sections[0]?.slots[0]?.artifactId ?? null
    setActiveArtifactId(firstId)

    // Fetch all artifacts in parallel
    sections.forEach((section) => {
      const allSlots = section.rows 
        ? section.rows.flatMap(r => r.slots)
        : section.slots
      allSlots.forEach(async (slot) => {
        // Text and image slots carry their content inline — no fetch needed
        if (slot.artifactType === 'text' || slot.artifactType === 'image' || slot.artifactType === 'toc') return
        try {
          if (slot.artifactType === 'visual') {
            const v = await api.getVisual(slot.artifactId, true)
            const visualDef = { ...v.definition, id: v.id, title: v.title, visualType: v.visualType } as VisualDefinition
            updateSlot(slot.artifactId, { visualDefinition: visualDef })
            if (visualDef.cube && visualDef.view) {
              const ds = await api.getDataset(visualDef.cube, visualDef.view, {})
              updateSlot(slot.artifactId, { visualDataset: ds, loading: false })
            } else {
              updateSlot(slot.artifactId, { loading: false })
            }
          } else {
            // Use published snapshot — dataset was stored at publish time, never fetch live
            const response = await api.getPublishedReport(slot.artifactId)
            const def = response.definition as unknown as ReportDefinition
            updateSlot(slot.artifactId, { definition: def, dataset: response.dataset, dataAsOf: response.dataAsOf, loading: false })
          }
        } catch {
          updateSlot(slot.artifactId, { loading: false, error: 'Failed to load' })
        }
      })
    })
  }, [updateSlot])

  const handleScrollTo = useCallback((id: string) => {
    setActiveArtifactId(id)
    const el = artifactRefs.current.get(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // Map noteLabel → artifactId for all text slots — used by report row noteRef clicks
  const noteLabelMap = useCallback((): Record<string, string> => {
    const map: Record<string, string> = {}
    viewerSections.forEach((section) => {
      section.slots.forEach((slot) => {
        if (slot.artifactType === 'text' && slot.noteLabel) {
          map[slot.noteLabel] = slot.artifactId
        }
      })
    })
    return map
  }, [viewerSections])

  const handleNoteRefClick = useCallback((ref: string) => {
    const map = noteLabelMap()
    const artifactId = map[ref]
    if (artifactId) handleScrollTo(artifactId)
  }, [noteLabelMap, handleScrollTo])

  const handleOverrideChange = useCallback(async (artifactId: string, overrides: Record<string, string>) => {
    const section = viewerSections.find((s) => s.slots.some((sl) => sl.artifactId === artifactId))
    const slot = section?.slots.find((sl) => sl.artifactId === artifactId)
    if (!slot?.definition) return
    updateSlot(artifactId, { overrides, loading: true })
    try {
      const ds = await api.getDataset(slot.definition.cube, slot.definition.view, overrides)
      updateSlot(artifactId, { dataset: ds, loading: false })
    } catch {
      updateSlot(artifactId, { loading: false })
    }
  }, [viewerSections, updateSlot])

const publishedPacks = packs.filter((p) => p.status === 'published' && ((p.layout?.length ?? 0) > 0 || (p.statements?.length ?? 0) > 0))

  const filteredPacks = search
    ? publishedPacks.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : publishedPacks

  return (
    <div className="h-screen flex overflow-hidden bg-white text-gray-900">

{/* Sidebar */}
      <aside className="w-60 shrink-0 h-full bg-gray-50 border-r border-gray-200 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 space-y-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-400 shrink-0" />
            <span className="text-sm font-semibold text-gray-800">Report Packs</span>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search packs..."
            className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400"
          />
        </div>

        {(() => {
          const rootFolders = packFolders.filter(f => !f.parentId)
          const uncategorized = filteredPacks.filter(p => !p.folderId)
          const foldered = filteredPacks.filter(p => p.folderId)
          const byFolder: Record<string, typeof foldered> = {}
          foldered.forEach(p => { if (p.folderId) { if (!byFolder[p.folderId]) byFolder[p.folderId] = []; byFolder[p.folderId].push(p) } })

          return (
            <nav className="flex-1 overflow-y-auto py-2">
              {filteredPacks.length === 0 ? (
                <p className="px-4 py-6 text-xs text-gray-400 text-center">{search ? 'No matching packs' : 'No published packs yet'}</p>
              ) : (
                <>
                  {uncategorized.length > 0 && uncategorized.map(pack => (
                    <PackGroup key={pack.id} pack={pack} sections={activePack?.id === pack.id ? viewerSections : []} activeId={activeArtifactId} isActive={activePack?.id === pack.id} onSelectPack={() => handleSelectPack(pack)} onScrollTo={handleScrollTo} />
                  ))}
                  {rootFolders.map(folder => (
                    <div key={folder.id}>
                      <button onClick={() => toggleFolder(folder.id)} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-gray-100">
                        {expandedFolders.has(folder.id) ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
                        <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                        <span className="text-xs text-gray-700">{folder.name}</span>
                        <span className="text-xs text-gray-400 ml-auto">{byFolder[folder.id]?.length || 0}</span>
                      </button>
                      {expandedFolders.has(folder.id) && byFolder[folder.id]?.map(pack => (
                        <PackGroup key={pack.id} pack={pack} sections={activePack?.id === pack.id ? viewerSections : []} activeId={activeArtifactId} isActive={activePack?.id === pack.id} onSelectPack={() => handleSelectPack(pack)} onScrollTo={handleScrollTo} />
                      ))}
                    </div>
                  ))}
                </>
              )}
            </nav>
          )
        })()}

        <div className="px-3 py-3 border-t border-gray-200 shrink-0">
          <Link to="/admin"
            className="flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium
                       text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            Admin Portal
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {!activePack ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Layers className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Select a pack from the sidebar</p>
            </div>
          </div>
        ) : (
          <>
            {/* Pack header */}
            <div className="px-8 py-4 border-b border-gray-100 bg-white shrink-0 flex items-center gap-3">
              <Layers className="h-5 w-5 text-blue-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-semibold text-gray-900">{activePack.name}</h1>
                {activePack.description && (
                  <p className="text-xs text-gray-400 mt-0.5">{activePack.description}</p>
                )}
              </div>
              
              {/* View mode controls */}
              <div className="flex items-center gap-1 border-l border-gray-200 pl-3 ml-2">
                <button
                  onClick={() => setViewMode('single')}
                  title="Single page view"
                  className={`p-1.5 rounded transition-colors ${viewMode === 'single' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('side-by-side')}
                  title="Side by side view"
                  className={`p-1.5 rounded transition-colors ${viewMode === 'side-by-side' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  title="Grid view (all pages)"
                  className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>

              <div className="border-l border-gray-200 pl-3 ml-2 flex items-center gap-2">
                <button
                  onClick={() => navigate(`/builder/packs/${activePack.id}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                             bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                >
                  <Feather className="h-3.5 w-3.5" />
                  Composer
                </button>
                <button
                  onClick={() => navigate(`/builder?pack=${activePack.id}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                             bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                >
                  <Layers className="h-3.5 w-3.5" />
                  Builder
                </button>
              </div>
            </div>

{/* Pages */}
            <div className="flex-1 overflow-auto bg-gray-200 p-8">
              {viewMode === 'grid' ? (
                /* Grid view - all pages in a responsive grid */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {viewerPageGroups.map((pg, pgIdx) => {
                    const pageSections = pg.sectionIds
                      .map((id) => viewerSections.find((s) => s.sectionId === id))
                      .filter(Boolean) as ViewerSection[]
                    return (
                      <div key={pg.pageId} className="flex justify-center">
                        <PageSheet
                          page={pg}
                          pageNumber={pgIdx + 1}
                          totalPages={viewerPageGroups.length}
                          packName={activePack.name}
                          confirmedDate={activePack.publishedAt ?? undefined}
                          sections={pageSections}
                          allSections={viewerSections}
                          onOverrideChange={handleOverrideChange}
                          onNoteRefClick={handleNoteRefClick}
                          artifactRefs={artifactRefs}
                          compact={true}
                        />
                      </div>
                    )
                  })}
                </div>
              ) : viewMode === 'side-by-side' ? (
                /* Side-by-side - 2 pages visible at once */
                <div className="flex flex-col gap-8">
                  {viewerPageGroups.map((pg, pgIdx) => {
                    if (pgIdx % 2 === 1) return null
                    const page1Sections = pg.sectionIds
                      .map((id) => viewerSections.find((s) => s.sectionId === id))
                      .filter(Boolean) as ViewerSection[]
                    const nextPg = viewerPageGroups[pgIdx + 1]
                    const page2Sections = nextPg?.sectionIds
                      .map((id) => viewerSections.find((s) => s.sectionId === id))
                      .filter(Boolean) as ViewerSection[] ?? []
                    return (
                      <div key={pg.pageId} className="flex gap-8 justify-center">
                        <PageSheet
                          page={pg}
                          pageNumber={pgIdx + 1}
                          totalPages={viewerPageGroups.length}
                          packName={activePack.name}
                          confirmedDate={activePack.publishedAt ?? undefined}
                          sections={page1Sections}
                          allSections={viewerSections}
                          onOverrideChange={handleOverrideChange}
                          onNoteRefClick={handleNoteRefClick}
                          artifactRefs={artifactRefs}
                          compact={true}
                        />
                        {nextPg && (
                          <PageSheet
                            page={nextPg}
                            pageNumber={pgIdx + 2}
                            totalPages={viewerPageGroups.length}
                            packName={activePack.name}
                            confirmedDate={activePack.publishedAt ?? undefined}
                            sections={page2Sections}
                            allSections={viewerSections}
                            onOverrideChange={handleOverrideChange}
                            onNoteRefClick={handleNoteRefClick}
                            artifactRefs={artifactRefs}
                            compact={true}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* Single page view (default) */
                <div className="max-w-6xl mx-auto">
                  {viewerPageGroups.length > 0 ? (
                    viewerPageGroups.map((pg, pgIdx) => {
                      const pageSections = pg.sectionIds
                        .map((id) => viewerSections.find((s) => s.sectionId === id))
                        .filter(Boolean) as ViewerSection[]
                      const confirmedDate = activePack.publishedAt
                      return (
                        <PageSheet
                          key={pg.pageId}
                          page={pg}
                          pageNumber={pgIdx + 1}
                          totalPages={viewerPageGroups.length}
                          packName={activePack.name}
                          confirmedDate={confirmedDate}
                          sections={pageSections}
                          allSections={viewerSections}
                          onOverrideChange={handleOverrideChange}
                          onNoteRefClick={handleNoteRefClick}
                          artifactRefs={artifactRefs}
                        />
                      )
                    })
                  ) : (
                    <div className="space-y-4">
                      {viewerSections.map((section) => (
                        <SectionView
                          key={section.sectionId}
                          section={section}
                          allSections={viewerSections}
                          onOverrideChange={handleOverrideChange}
                          onNoteRefClick={handleNoteRefClick}
                          artifactRefs={artifactRefs}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
