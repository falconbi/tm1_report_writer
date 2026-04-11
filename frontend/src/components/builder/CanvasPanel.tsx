import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { useReportStore } from '../../store/useReportStore'
import { useVisualStore } from '../../store/useVisualStore'
import { api } from '../../lib/api'
import ReportRenderer from '../shared/ReportRenderer'
import SelectorBar from '../shared/SelectorBar'

interface Props {
  focusMode?: boolean
  activeTab?: 'reports' | 'notes' | 'visuals' | 'packs' | 'images'
  selectedImage?: { url: string; name: string } | null
  setSelectedImage?: (img: { url: string; name: string } | null) => void
}

function fmt(date: Date) {
  return date.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export default function CanvasPanel({ focusMode = false, activeTab, selectedImage: propSelectedImage, setSelectedImage: propSetSelectedImage }: Props) {
  const { definition, dataset, setDataset, reportList } = useReportStore()
  const { definition: visualDef } = useVisualStore()
  const reportMeta = reportList.find((r) => r.id === definition.id)
  const isConfirmed = reportMeta?.isConfirmed ?? false
  const { cube, view } = definition

  const [internalSelectedImage, setInternalSelectedImage] = useState<{ url: string; name: string } | null>(null)
  const selectedImage = propSelectedImage ?? internalSelectedImage
  const setSelectedImage = propSetSelectedImage ?? setInternalSelectedImage
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
      .then((ds) => { setDataset(ds); setFetchedAt(new Date()) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [cube, view])

  // Reset overrides when source changes
  useEffect(() => {
    setOverrides({})
    setFetchedAt(null)
  }, [cube, view])

  // Auto-fetch when report is selected and has cube/view
  useEffect(() => {
    if (cube && view && definition.id) {
      fetchData(overrides)
    }
  }, [cube, view, definition.id, fetchData])

  // Reset selected image when switching tabs
  useEffect(() => {
    setSelectedImage(null)
  }, [activeTab])

  const handleRefresh = () => {
    // Re-fetching invalidates confirmation — update list to reflect reset state
    fetchData(overrides)
    if (isConfirmed && definition.id) {
      // Optimistically clear confirmed state in the store until next listReports
      const list = useReportStore.getState().reportList.map((r) =>
        r.id === definition.id ? { ...r, isConfirmed: false, confirmedAt: undefined } : r
      )
      useReportStore.getState().setReportList(list)
    }
  }

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

  if (activeTab === 'reports' && (!cube || !view)) {
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

  if (activeTab !== 'reports' && activeTab !== 'visuals' && activeTab !== 'images') {
    return (
      <main className="flex-1 overflow-auto bg-gray-950 flex items-center justify-center text-gray-600">
        <p className="text-sm">Select an item to preview</p>
      </main>
    )
  }

  // Images preview
  if (activeTab === 'images') {
    return (
      <main className="flex-1 overflow-auto bg-gray-950 flex flex-col">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 border-b border-gray-800 text-xs shrink-0">
          <span className="text-gray-600">Image Library</span>
        </div>
        {selectedImage ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-full max-h-full">
              <img src={selectedImage.url} alt={selectedImage.name} className="max-w-full max-h-[calc(100vh-120px)] object-contain rounded-lg shadow-xl" />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-600">
            <p className="text-sm">Click an image in the sidebar to preview</p>
          </div>
        )}
      </main>
    )
  }

  if (activeTab === 'reports' && loading) {
    return (
      <main className="flex-1 overflow-auto bg-gray-950 flex items-center justify-center text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Loading data…</span>
      </main>
    )
  }

  if (activeTab === 'reports' && error) {
    return (
      <main className="flex-1 overflow-auto bg-gray-950 flex items-center justify-center">
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      </main>
    )
  }

  // Show loading placeholder while fetching data
  if (activeTab === 'reports' && loading) {
    return (
      <main className="flex-1 overflow-auto bg-gray-950 flex flex-col">
        {!focusMode && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 border-b border-gray-800 text-xs shrink-0">
            <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
            <span className="text-gray-500">Fetching data…</span>
          </div>
        )}
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
        </div>
      </main>
    )
  }

  // No report selected yet
  if (activeTab === 'reports' && !dataset && !definition.id) {
    return (
      <main className="flex-1 overflow-auto bg-gray-950 flex items-center justify-center text-gray-600">
        <p className="text-sm">Select a cube and SYS view to begin</p>
      </main>
    )
  }

  // Selected report but no data yet (waiting for fetch)
  if (activeTab === 'reports' && !dataset) {
    return (
      <main className="flex-1 overflow-auto bg-gray-950 flex items-center justify-center text-gray-600">
        <p className="text-sm">Loading data...</p>
      </main>
    )
  }

  // Dataset loaded - render the report
  const ds = dataset!
  const bgClass = focusMode ? 'bg-gray-200' : 'bg-gray-950'
  const FetchBar = () => (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 border-b border-gray-800 text-xs shrink-0">
      {loading ? (
        <><Loader2 className="h-3 w-3 animate-spin text-blue-400" /><span className="text-gray-500">Fetching data…</span></>
      ) : (
        <>
          {fetchedAt && (
            <>
              {isConfirmed ? (
                <span className="text-emerald-500">Confirmed snapshot · {fmt(fetchedAt)}</span>
              ) : (
                <>
                  <span className="text-gray-600">Data fetched:</span>
                  <span className="text-gray-500 tabular-nums">{fmt(fetchedAt)}</span>
                  <span className="text-yellow-600 ml-1">— unconfirmed</span>
                </>
              )}
            </>
          )}
        </>
      )}
      <button
        onClick={handleRefresh}
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
      {!focusMode && <FetchBar />}

      <div className="flex-1 overflow-auto">
        {focusMode ? (
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
