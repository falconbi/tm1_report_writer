import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, AlertCircle, RefreshCw, Layers, FileText, BarChart3, CheckCircle2, Clock, Feather, Eye } from 'lucide-react'
import { useReportStore } from '../../store/useReportStore'
import { useVisualStore } from '../../store/useVisualStore'
import { api, PackListItem, PickerReport, PickerVisual } from '../../lib/api'
import { migrateLayout } from '../../types/report'
import ReportRenderer from '../shared/ReportRenderer'
import VisualRenderer from '../shared/VisualRenderer'
import SelectorBar from '../shared/SelectorBar'

interface Props {
  focusMode?: boolean
  activeTab?: 'reports' | 'notes' | 'visuals' | 'packs' | 'images'
  selectedPackId?: string | null
  onOpenComposer?: () => void
  onOpenViewer?: () => void
  fromPack?: { id: string; name: string } | null
  onBackToPack?: () => void
  onSelectArtifact?: (id: string, type: 'report' | 'visual', packName?: string) => void
}

// ─── Pack Overview ────────────────────────────────────────────────────────────

function PackOverview({ selectedPackId, onOpenComposer, onOpenViewer, onSelectArtifact }: { selectedPackId: string | null; onOpenComposer?: () => void; onOpenViewer?: () => void; onSelectArtifact?: (id: string, type: 'report' | 'visual', packName?: string) => void }) {
  const [pack, setPack] = useState<PackListItem | null>(null)
  const [reports, setReports] = useState<PickerReport[]>([])
  const [visuals, setVisuals] = useState<PickerVisual[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedPackId) { setPack(null); return }
    setLoading(true)
    Promise.all([
      api.getPack(selectedPackId),
      api.pickerReports().then((d) => d.reports),
      api.pickerVisuals().then((d) => d.visuals),
    ]).then(([p, reps, vis]) => {
      setPack(p)
      setReports(reps)
      setVisuals(vis)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [selectedPackId])

  if (!selectedPackId) {
    return (
      <main className="flex-1 overflow-auto bg-gray-950 flex items-center justify-center text-gray-600">
        <p className="text-sm">Select a pack from the sidebar</p>
      </main>
    )
  }

  if (loading || !pack) {
    return (
      <main className="flex-1 overflow-auto bg-gray-950 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
      </main>
    )
  }

  const rMap = new Map(reports.map((r) => [r.id, { title: r.title, type: 'report' as const, lastDatasetAt: r.lastDatasetAt }]))
  const vMap = new Map(visuals.map((v) => [v.id, { title: v.title, type: v.visualType as string, lastDatasetAt: undefined as string | undefined }]))
  const artifacts = (pack.statements ?? []).map((id) => {
    const a = rMap.get(id) ?? vMap.get(id)
    return a ? { id, ...a } : { id, title: id, type: 'unknown', lastDatasetAt: undefined as string | undefined }
  })

  const pageCount = pack.layout?.length ?? 0

  const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  return (
    <main className="flex-1 overflow-auto bg-gray-950 p-8">
      <div className="max-w-xl mx-auto space-y-4">

        {/* Header card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <Layers className="h-6 w-6 text-blue-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-gray-100 truncate">{pack.name}</h2>
              {pack.description && <p className="text-sm text-gray-400 mt-1">{pack.description}</p>}
              <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                <span>{pageCount} {pageCount === 1 ? 'page' : 'pages'}</span>
                <span>·</span>
                <span>{artifacts.length} {artifacts.length === 1 ? 'artifact' : 'artifacts'}</span>
                <span>·</span>
                {pack.status === 'draft'
                  ? <span className="text-yellow-500">Draft</span>
                  : pack.hasDraft
                    ? <span className="text-yellow-500">Published · unsaved changes</span>
                    : <span className="text-emerald-400">Published</span>
                }
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                {pack.updatedAt && <span>Saved {fmtDate(pack.updatedAt)}</span>}
                {pack.publishedAt && <><span>·</span><span>Published {fmtDate(pack.publishedAt)}</span></>}
              </div>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button
              onClick={onOpenComposer}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-400 hover:bg-blue-300 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              <Feather className="h-4 w-4" />
              Open Composer
            </button>
            <button
              onClick={onOpenViewer}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-100 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              <Eye className="h-4 w-4" />
              View Pack
            </button>
          </div>
        </div>

        {/* Artifact status card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Artifacts</span>
            <span className="text-xs text-gray-500">{artifacts.length} {artifacts.length === 1 ? 'artifact' : 'artifacts'}</span>
          </div>
          {artifacts.length === 0 ? (
            <p className="px-4 py-4 text-xs text-gray-600">No artifacts in this pack</p>
          ) : (
            <div className="divide-y divide-gray-800">
              {artifacts.map((a) => {
                const type = (a.type === 'kpi' || a.type === 'chart') ? 'visual' : 'report'
                return (
                  <div key={a.id}
                    onClick={() => onSelectArtifact?.(a.id, type, pack?.name)}
                    className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${onSelectArtifact ? 'cursor-pointer hover:bg-gray-800' : ''}`}>
                    {type === 'visual'
                      ? <BarChart3 className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                      : <FileText className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                    }
                    <span className="flex-1 text-xs text-gray-300 truncate">{a.title}</span>
                    {a.lastDatasetAt && (
                      <span className="text-xs text-gray-600 shrink-0 tabular-nums">
                        {new Date(a.lastDatasetAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Text slots card */}
        {(() => {
          const pages = migrateLayout(pack.layout ?? [])
          const textSlots = pages.flatMap((pg, pgIdx) =>
            pg.sections.flatMap((sec, secIdx) =>
              sec.slots
                .map((sl, slIdx) => ({ sl, pgIdx, secIdx, slIdx }))
                .filter(({ sl }) => sl.artifactType === 'text')
                .map(({ sl, pgIdx, secIdx, slIdx }) => {
                  const preview = sl.textContent
                    ? sl.textContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
                    : ''
                  return { key: `${pgIdx}-${secIdx}-${slIdx}`, noteLabel: sl.noteLabel, description: sl.description, hasContent: !!sl.textContent?.trim(), preview }
                })
            )
          )
          if (textSlots.length === 0) return null
          const emptyCount = textSlots.filter((s) => !s.hasContent).length
          return (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Text Slots</span>
                {emptyCount > 0
                  ? <span className="text-xs font-medium text-yellow-500">{emptyCount} empty</span>
                  : <span className="text-xs font-medium text-emerald-400">All filled</span>
                }
              </div>
              <div className="divide-y divide-gray-800">
                {textSlots.map((s) => (
                  <div key={s.key} className="flex items-start gap-3 px-4 py-2.5" title={s.description ?? undefined}>
                    <div className="shrink-0 mt-0.5">
                      {s.hasContent
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        : <Clock className="h-3.5 w-3.5 text-yellow-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      {s.noteLabel
                        ? <span className="text-xs font-medium text-gray-200 block">{s.noteLabel}</span>
                        : <span className="text-xs text-gray-500 italic block">Unlabelled</span>
                      }
                      {s.hasContent
                        ? <span className="text-[10px] text-gray-500 truncate block">{s.preview}{s.preview.length === 80 ? '…' : ''}</span>
                        : <span className="text-[10px] text-gray-600 italic">Empty</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

      </div>
    </main>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function fmt(date: Date) {
  return date.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export default function CanvasPanel({ focusMode = false, activeTab, selectedPackId, onOpenComposer, onOpenViewer, fromPack, onBackToPack, onSelectArtifact }: Props) {
  const { definition, dataset, setDataset, lastDatasetAt, setLastDatasetAt, reportList } = useReportStore()
  const { definition: visualDef, dataset: visualDataset, visualList, setDataset: setVisualDataset } = useVisualStore()
  const reportMeta = activeTab === 'reports' && reportList ? reportList.find((r) => r.id === definition.id) : null
  const visualMeta = activeTab === 'visuals' && visualList ? visualList.find((v) => v.id === visualDef.id) : null
  const hasDraft = activeTab === 'reports' ? (reportMeta?.hasDraft ?? false) : (visualMeta?.hasDraft ?? false)
  const currentStatus = activeTab === 'reports' ? (reportMeta?.status) ?? 'draft' : (visualMeta?.status) ?? 'draft'
  const { cube, view } = definition

  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scale, setScale] = useState(1)
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback((ov: Record<string, string>) => {
    if (!cube || !view) { setDataset(null); setError(''); setFetchedAt(null); return }
    setLoading(true)
    setError('')
    api.getDataset(cube, view, ov)
      .then((ds) => {
        const now = new Date()
        setDataset(ds)
        setFetchedAt(now)
        setLastDatasetAt(now)
        // Persist snapshot so it restores on next load
        if (definition.id) api.saveDataset(definition.id, ds).catch(() => {})
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [cube, view, definition.id])

  // Reset overrides and fetchedAt when source changes (dataset is restored from server via handleSelect)
  useEffect(() => {
    setOverrides({})
    setFetchedAt(null)
  }, [cube, view])

  const handleRefresh = () => {
    fetchData(overrides)
  }

  const handleVisualRefresh = async () => {
    if (!visualDef.cube || !visualDef.view) return
    setLoading(true)
    setError('')
    try {
      const ds = await api.getDataset(visualDef.cube, visualDef.view)
      setVisualDataset(ds)
      setFetchedAt(new Date())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  // Auto-fetch data when visual cube/view changes
  useEffect(() => {
    if (visualDef.cube && visualDef.view) {
      handleVisualRefresh()
    }
  }, [visualDef.cube, visualDef.view])

  // Auto-fetch data when source changes and no data is loaded
  useEffect(() => {
    if (!dataset && !visualDataset) {
      const hasSource = (activeTab === 'reports' && definition.cube && definition.view) || 
                        (activeTab === 'visuals' && visualDef.cube && visualDef.view)
      if (hasSource && !loading) {
        fetchData(overrides)
      }
    }
  }, [activeTab, definition.cube, definition.view, visualDef.cube, visualDef.view, dataset, visualDataset, loading])

  // Page width in px based on definition settings
  const pageWidth =
    definition.pageSize === 'letter'
      ? (definition.orientation === 'landscape' ? 1056 : 816)
      : (definition.orientation === 'landscape' ? 1123 : 794)

  // Scale to fit viewport in focus mode
  useEffect(() => {
    if (!focusMode || !containerRef.current) { setScale(1); return }

    const updateScale = () => {
      if (!containerRef.current) return
      const available = containerRef.current.clientWidth - 64
      // Scale DOWN to fit if viewport too narrow, never scale UP beyond 1.0
      setScale(Math.min(Math.max(available / pageWidth, 0.3), 1.0))
    }

    updateScale()
    const ro = new ResizeObserver(updateScale)
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [focusMode, pageWidth])

  if (activeTab === 'visuals' && !visualDef.id) {
    return (
      <main className="flex-1 overflow-auto bg-gray-950 flex items-center justify-center text-gray-600">
        <p className="text-sm">Select a visual from the list</p>
      </main>
    )
  }

// Packs preview - handle this BEFORE the reports/visuals cube/view check
  if (activeTab === 'packs') {
    return <PackOverview selectedPackId={selectedPackId ?? null} onOpenComposer={onOpenComposer} onOpenViewer={onOpenViewer} onSelectArtifact={onSelectArtifact} />
  }

  const { cube: activeCube, view: activeView } = activeTab === 'visuals' ? { cube: visualDef.cube, view: visualDef.view } : { cube, view }

  // No cube/view selected yet (for reports/visuals)
  if (!activeCube || !activeView) {
    return (
      <main className="flex-1 overflow-auto bg-gray-950 flex items-center justify-center text-gray-600">
        {focusMode ? (
          <p className="text-sm text-gray-600">Preview available in builder mode</p>
        ) : (
          <p className="text-sm">Select a cube and SYS view to begin</p>
        )}
      </main>
    )
  }

  if (activeTab !== 'reports' && activeTab !== 'visuals') {
    return (
      <main className="flex-1 overflow-auto bg-gray-950 flex items-center justify-center text-gray-600">
        <p className="text-sm">Select an item to preview</p>
      </main>
    )
  }

  const isDataTab = activeTab === 'reports' || activeTab === 'visuals'

  if (isDataTab && loading) {
    return (
      <main className="flex-1 overflow-auto bg-gray-950 flex items-center justify-center text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Loading data…</span>
      </main>
    )
  }

  if (isDataTab && error) {
    return (
      <main className="flex-1 overflow-auto bg-gray-950 flex items-center justify-center">
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      </main>
    )
  }

  if (!dataset && !visualDataset) {
    // Auto-fetch is handled in useEffect above
    return (
      <main className="flex-1 overflow-auto bg-gray-950 flex flex-col">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 border-b border-gray-800 text-xs shrink-0">
          <span className="text-gray-600">{loading ? 'Loading...' : 'No data cached — fetching from TM1...'}</span>
          <button
            onClick={handleVisualRefresh}
            disabled={loading}
            title="Fetch data from TM1"
            className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded border border-gray-700 text-gray-400 text-xs font-medium
                       hover:text-blue-400 hover:border-blue-400 hover:bg-gray-800 disabled:opacity-30 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Data
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-600">
          <p className="text-sm">No data loaded yet</p>
        </div>
      </main>
    )
  }

  // Determine active dataset based on tab
  const activeDataset = activeTab === 'visuals' ? visualDataset : dataset
  const activeLastDatasetAt = activeTab === 'visuals' ? fetchedAt : lastDatasetAt

  const ds = activeDataset!
  const bgClass = focusMode ? 'bg-gray-200' : 'bg-gray-950'
  const FetchBar = () => (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 border-b border-gray-800 text-xs shrink-0">
      {loading ? (
        <><Loader2 className="h-3 w-3 animate-spin text-blue-400" /><span className="text-gray-500">Fetching data…</span></>
      ) : (
        <>
          {hasDraft ? (
            <><span className="text-yellow-500">Editing</span>{fetchedAt && <span className="text-gray-600 ml-1">· {fmt(fetchedAt)}</span>}</>
          ) : currentStatus === 'published' ? (
            <><span className="text-emerald-500">Published</span>{activeLastDatasetAt && <span className="text-gray-600 ml-1">· {fmt(activeLastDatasetAt)}</span>}</>
          ) : (
            <span className="text-gray-500">Draft</span>
          )}
        </>
      )}
      <button
        onClick={activeTab === 'visuals' ? handleVisualRefresh : handleRefresh}
        disabled={loading}
        title="Re-fetch data from TM1"
        className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded border border-gray-700 text-gray-400 text-xs font-medium
                   hover:text-blue-400 hover:border-blue-400 hover:bg-gray-800 disabled:opacity-30 transition-colors"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        Refresh Data
      </button>
    </div>
  )

  return (
    <main ref={containerRef} className={`flex-1 overflow-auto ${bgClass} transition-colors flex flex-col`}>
      {fromPack && onBackToPack && (
        <button
          onClick={onBackToPack}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border-b border-gray-700 text-xs text-blue-400 hover:text-blue-300 hover:bg-gray-750 transition-colors shrink-0 text-left"
        >
          <span>←</span>
          <span>Back to <span className="font-medium">{fromPack.name}</span></span>
        </button>
      )}
      {!focusMode && <FetchBar />}

      <div className="flex-1 overflow-auto">
        {activeTab === 'visuals' ? (
          // Visual mode — render chart/kpi
          <div className="w-full p-8 flex items-center justify-center">
            <div className="bg-white rounded shadow-lg p-8 w-full max-w-2xl">
              <VisualRenderer definition={visualDef} dataset={visualDataset} />
            </div>
          </div>
        ) : focusMode ? (
          // Focus mode — scale to fit, centred, light background
          <div className="flex justify-center py-8 px-8">
            <div
              style={{
                width: pageWidth,
                transform: `scale(${scale})`,
                transformOrigin: 'top center',
                marginBottom: `${(scale - 1) * 100}%`,
              }}
            >
              <div className="bg-white shadow-2xl overflow-hidden">
                {ds.axes[2] && (
                  <SelectorBar
                    dataset={ds}
                    selectors={definition.selectors}
                    overrides={overrides}
                    onChange={setOverrides}
                  />
                )}
                <ReportRenderer definition={definition} dataset={ds} />
              </div>
            </div>
          </div>
        ) : (
          // Builder mode — fills canvas panel width
          <div className="w-full p-8">
            <div className="bg-white rounded shadow-lg overflow-hidden w-full">
              {ds.axes[2] && (
                <SelectorBar
                  dataset={ds}
                  selectors={definition.selectors}
                  overrides={overrides}
                  onChange={setOverrides}
                />
              )}
              <ReportRenderer definition={definition} dataset={ds} />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
