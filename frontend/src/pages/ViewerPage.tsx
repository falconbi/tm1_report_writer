import { useEffect, useState, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BarChart3, ExternalLink, ChevronRight, ChevronDown,
  FileText, NotebookPen, Loader2, ShieldAlert, Layers, LayoutTemplate,
} from 'lucide-react'
import { api, RawDataset, PackListItem } from '../lib/api'
import { ReportDefinition, VisualDefinition, PackSection, SectionPreset, migrateLayout, PackPage, parseNoteContent } from '../types/report'
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
}

// ─── Slot state ───────────────────────────────────────────────────────────────

interface ArtifactSlot {
  artifactId: string
  artifactType: 'report' | 'note' | 'visual'
  // report
  definition: ReportDefinition | null
  dataset: RawDataset | null
  overrides: Record<string, string>
  // note
  noteTitle: string
  noteContent: string
  // visual
  visualDefinition: VisualDefinition | null
  visualDataset: RawDataset | null
  // state
  loading: boolean
  error: string
}

interface ViewerSection {
  sectionId: string
  preset: SectionPreset
  slots: ArtifactSlot[]
}

interface ViewerPageGroup {
  pageId: string
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
  sections, onOverrideChange, onNoteRefClick, artifactRefs,
}: {
  page: ViewerPageGroup
  pageNumber: number
  totalPages: number
  packName: string
  confirmedDate?: string
  sections: ViewerSection[]
  onOverrideChange: (id: string, overrides: Record<string, string>) => void
  onNoteRefClick: (ref: string) => void
  artifactRefs: React.MutableRefObject<Map<string, HTMLDivElement>>
}) {
  const bgStyle: React.CSSProperties = {}

  if (page.backgroundImage) {
    bgStyle.backgroundImage = `url(${BASE_URL}/images/${page.backgroundImage})`
    bgStyle.backgroundSize = 'cover'
    bgStyle.backgroundPosition = 'center'
  } else if (page.backgroundColour) {
    bgStyle.backgroundColor = page.backgroundColour
  }

  const hasOverlay = page.overlayOpacity && page.overlayOpacity > 0

  const confirmedLabel = confirmedDate
    ? new Date(confirmedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : ''

  return (
    // A4 landscape proportions: 297 × 210mm → ratio 1.414:1
    <div className="relative w-full shadow-2xl mb-10 overflow-hidden rounded-sm"
      style={{ ...bgStyle, aspectRatio: '1.414 / 1', minHeight: '400px' }}>

      {/* Overlay */}
      {hasOverlay && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: page.overlayColour ?? '#ffffff', opacity: page.overlayOpacity }} />
      )}

      {/* Content */}
      <div className="absolute inset-0 flex flex-col">
        <div className="flex-1 overflow-hidden p-8 space-y-6">
          {sections.map((section) => (
            <SectionView
              key={section.sectionId}
              section={section}
              onOverrideChange={onOverrideChange}
              onNoteRefClick={onNoteRefClick}
              artifactRefs={artifactRefs}
            />
          ))}
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
  const artifacts = sections.flatMap((s) => s.slots)

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
          {slot.artifactType === 'note'
            ? <NotebookPen className="h-3 w-3 shrink-0 text-purple-400" />
            : slot.artifactType === 'visual'
              ? <BarChart3 className="h-3 w-3 shrink-0 text-blue-400" />
              : <FileText className="h-3 w-3 shrink-0 text-gray-400" />
          }
          <span className="flex-1 truncate text-xs">
            {slot.artifactType === 'note'
              ? slot.noteTitle || 'Note'
              : slot.artifactType === 'visual'
                ? slot.visualDefinition?.title || '…'
                : slot.definition?.title || '…'
            }
          </span>
        </button>
      ))}
    </div>
  )
}

// ─── Note renderer ────────────────────────────────────────────────────────────

const NOTE_BASE = `http://${window.location.hostname}:8080`

const NOTE_PRESET_WIDTHS: Record<string, string[]> = {
  'full':             ['100%'],
  'half':             ['50%','50%'],
  'two-thirds':       ['66.67%','33.33%'],
  'third-two-thirds': ['33.33%','66.67%'],
  'thirds':           ['33.33%','33.33%','33.33%'],
}

function NoteCard({ slot, cardRef }: {
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
    return <div ref={cardRef} className="bg-white rounded-xl p-6 text-sm text-red-500 shadow">{slot.error}</div>
  }

  const def = parseNoteContent(slot.noteContent)

  return (
    <div ref={cardRef}
      className="rounded-xl shadow-lg overflow-hidden scroll-mt-4"
      style={{ backgroundColor: def.cardBackground ?? '#ffffff' }}>
      <div className="p-6 space-y-4">
        {slot.noteTitle && (
          <h2 className="text-base font-semibold text-gray-800">{slot.noteTitle}</h2>
        )}
        {def.sections.map((section) => {
          const widths = NOTE_PRESET_WIDTHS[section.preset] ?? ['100%']
          return (
            <div key={section.id} className="flex gap-4">
              {section.slots.map((sl, i) => (
                <div key={sl.id} style={{ width: widths[i] }} className="min-w-0 flex-shrink-0">
                  {sl.type === 'text' && sl.html && (
                    <div className="prose prose-sm max-w-none text-gray-800"
                      dangerouslySetInnerHTML={{ __html: sl.html }} />
                  )}
                  {sl.type === 'image' && sl.imageFilename && (
                    <img src={`${NOTE_BASE}/images/${sl.imageFilename}`} alt={sl.imageName ?? ''}
                      className="w-full rounded-lg object-cover" />
                  )}
                  {sl.type === 'visual' && (
                    <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                      <BarChart3 className="h-4 w-4 shrink-0" />
                      {sl.visualTitle ?? 'Visual'}
                    </div>
                  )}
                  {sl.type === 'report' && (
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
                      <FileText className="h-4 w-4 shrink-0" />
                      {sl.reportTitle ?? 'Report'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>
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
  onNoteRefClick?: (ref: string) => void
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
    </div>
  )
}

// ─── Section renderer ─────────────────────────────────────────────────────────

function SectionView({ section, onOverrideChange, onNoteRefClick, artifactRefs }: {
  section: ViewerSection
  onOverrideChange: (id: string, overrides: Record<string, string>) => void
  onNoteRefClick: (ref: string) => void
  artifactRefs: React.MutableRefObject<Map<string, HTMLDivElement>>
}) {
  const widths = PRESET_WIDTHS[section.preset] ?? ['100%']

  return (
    <div className="flex gap-6 items-start">
      {section.slots.map((slot, i) => (
        <div key={slot.artifactId} style={{ width: widths[i] }} className="min-w-0 flex-shrink-0">
          {slot.artifactType === 'note' ? (
            <NoteCard
              slot={slot}
              cardRef={(el) => {
                if (el) artifactRefs.current.set(slot.artifactId, el)
                else artifactRefs.current.delete(slot.artifactId)
              }}
            />
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
  const [packs, setPacks] = useState<PackListItem[]>([])
  const [activePack, setActivePack] = useState<PackListItem | null>(null)
  const [viewerSections, setViewerSections] = useState<ViewerSection[]>([])
  const [viewerPageGroups, setViewerPageGroups] = useState<ViewerPageGroup[]>([])
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null)
  const artifactRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    api.listPacks().then((d) => setPacks(d.packs)).catch(() => {})
  }, [])

  const updateSlot = useCallback((artifactId: string, patch: Partial<ArtifactSlot>) => {
    setViewerSections((prev) => prev.map((section) => ({
      ...section,
      slots: section.slots.map((slot) =>
        slot.artifactId === artifactId ? { ...slot, ...patch } : slot
      ),
    })))
  }, [])

  const handleSelectPack = useCallback(async (stale: PackListItem) => {
    setActivePack(stale)
    setActiveArtifactId(null)
    setViewerPageGroups([])
    artifactRefs.current.clear()

    // Always re-fetch so we get the latest statements/layout, not stale list data
    const pack = await api.getPack(stale.id).catch(() => stale)
    setActivePack(pack)

    const makeSlot = (artifactId: string, artifactType: 'report' | 'note' | 'visual'): ArtifactSlot => ({
      artifactId, artifactType,
      definition: null, dataset: null, overrides: {},
      noteTitle: '', noteContent: '',
      visualDefinition: null, visualDataset: null,
      loading: true, error: '',
    })

    let sections: ViewerSection[]

    // Migrate old PackSection[] format to PackPage[] transparently
    const pages = migrateLayout(pack.layout ?? [])

    // Resolve artifact types from picker APIs (needed for statements not in layout slots)
    const [rRes, nRes, vRes] = await Promise.allSettled([
      api.pickerReports().then((d) => d.reports),
      api.pickerNotes().then((d) => d.notes),
      api.pickerVisuals().then((d) => d.visuals),
    ])
    const rIds = new Set(rRes.status === 'fulfilled' ? rRes.value.map((r) => r.id) : [])
    const nIds = new Set(nRes.status === 'fulfilled' ? nRes.value.map((n) => n.id) : [])
    const vIds = new Set(vRes.status === 'fulfilled' ? vRes.value.map((v) => v.id) : [])
    const getType = (id: string): 'report' | 'note' | 'visual' =>
      rIds.has(id) ? 'report' : nIds.has(id) ? 'note' : vIds.has(id) ? 'visual' : 'report'

    const flatSections: PackSection[] = pages.flatMap((pg) => pg.sections)

    if (flatSections.length > 0) {
      // Composer layout — build sections and page groups in parallel
      const sectionMap = new Map<string, ViewerSection>()
      flatSections.forEach((section) => {
        const vs: ViewerSection = {
          sectionId: section.id,
          preset: section.preset,
          slots: section.slots
            .filter((sl) => sl.artifactId && sl.artifactType)
            .map((sl) => makeSlot(sl.artifactId!, sl.artifactType as 'report' | 'note' | 'visual')),
        }
        if (vs.slots.length > 0) sectionMap.set(section.id, vs)
      })

      // Build page groups — sections that have content only
      const pageGroups: ViewerPageGroup[] = pages.map((pg: PackPage) => ({
        pageId: pg.id,
        backgroundColour: pg.backgroundColour,
        backgroundImage: pg.backgroundImage,
        overlayColour: pg.overlayColour,
        overlayOpacity: pg.overlayOpacity,
        sectionIds: pg.sections.map((s) => s.id).filter((id) => sectionMap.has(id)),
      })).filter((pg) => pg.sectionIds.length > 0)

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
      section.slots.forEach(async (slot) => {
        try {
          if (slot.artifactType === 'note') {
            const note = await api.getNote(slot.artifactId, true)
            updateSlot(slot.artifactId, {
              noteTitle: note.title,
              noteContent: note.content,
              loading: false,
            })
          } else if (slot.artifactType === 'visual') {
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
            const def = await api.getDefinition(slot.artifactId) as unknown as ReportDefinition
            updateSlot(slot.artifactId, { definition: def })
            if (def.cube && def.view) {
              const ds = await api.getDataset(def.cube, def.view, {})
              updateSlot(slot.artifactId, { dataset: ds, loading: false })
            } else {
              updateSlot(slot.artifactId, { loading: false })
            }
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

  // Map noteRef string → artifactId from the pack layout slots
  const noteRefMap = useCallback((): Map<string, string> => {
    const map = new Map<string, string>()
    if (!activePack?.layout) return map
    const allSections = migrateLayout(activePack.layout ?? []).flatMap((pg) => pg.sections)
    for (const section of allSections) {
      for (const slot of section.slots) {
        if (slot.noteRef && slot.artifactId) map.set(slot.noteRef, slot.artifactId)
      }
    }
    return map
  }, [activePack])

  const handleNoteRefClick = useCallback((ref: string) => {
    const artifactId = noteRefMap().get(ref)
    if (artifactId) handleScrollTo(artifactId)
  }, [noteRefMap, handleScrollTo])

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

  return (
    <div className="h-screen flex overflow-hidden bg-white text-gray-900">

      {/* Sidebar */}
      <aside className="w-60 shrink-0 h-full bg-gray-50 border-r border-gray-200 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-400 shrink-0" />
          <span className="text-sm font-semibold text-gray-800">Report Packs</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {publishedPacks.length === 0 ? (
            <p className="px-4 py-6 text-xs text-gray-400 text-center">No published packs yet</p>
          ) : (
            publishedPacks.map((pack) => (
              <PackGroup
                key={pack.id}
                pack={pack}
                sections={activePack?.id === pack.id ? viewerSections : []}
                activeId={activeArtifactId}
                isActive={activePack?.id === pack.id}
                onSelectPack={() => handleSelectPack(pack)}
                onScrollTo={handleScrollTo}
              />
            ))
          )}
        </nav>

        <div className="px-3 py-3 border-t border-gray-200 shrink-0 space-y-1">
          <Link to="/builder"
            className="flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium
                       text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors">
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            Open Builder
          </Link>
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
              <button
                onClick={() => navigate(`/builder/packs/${activePack.id}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                           bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors shrink-0"
              >
                <LayoutTemplate className="h-3.5 w-3.5" />
                Composer
              </button>
            </div>

            {/* Pages */}
            <div className="flex-1 overflow-auto bg-gray-200 p-8">
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
                        onOverrideChange={handleOverrideChange}
                        onNoteRefClick={handleNoteRefClick}
                        artifactRefs={artifactRefs}
                      />
                    )
                  })
                ) : (
                  // Fallback — no page groups yet (loading)
                  <div className="space-y-4">
                    {viewerSections.map((section) => (
                      <SectionView
                        key={section.sectionId}
                        section={section}
                        onOverrideChange={handleOverrideChange}
                        onNoteRefClick={handleNoteRefClick}
                        artifactRefs={artifactRefs}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
