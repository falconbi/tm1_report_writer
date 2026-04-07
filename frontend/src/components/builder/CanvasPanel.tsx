import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { useReportStore } from '../../store/useReportStore'
import { api } from '../../lib/api'
import ReportRenderer from '../shared/ReportRenderer'
import SelectorBar from '../shared/SelectorBar'

interface Props {
  focusMode?: boolean
}

function fmt(date: Date) {
  return date.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export default function CanvasPanel({ focusMode = false }: Props) {
  const { definition, dataset, setDataset, reportList } = useReportStore()
  const reportMeta = reportList.find((r) => r.id === definition.id)
  const isConfirmed = reportMeta?.isConfirmed ?? false
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
      .then((ds) => { setDataset(ds); setFetchedAt(new Date()) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [cube, view])

  // Reset overrides when source changes
  useEffect(() => {
    setOverrides({})
    setFetchedAt(null)
  }, [cube, view])

  // Fetch dataset when source or overrides change
  useEffect(() => {
    fetchData(overrides)
  }, [cube, view, overrides])

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

  if (!cube || !view) {
    return (
      <main className="flex-1 overflow-auto bg-gray-950 flex items-center justify-center text-gray-600">
        <p className="text-sm">Select a cube and SYS view to begin</p>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="flex-1 overflow-auto bg-gray-950 flex items-center justify-center text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Loading data…</span>
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex-1 overflow-auto bg-gray-950 flex items-center justify-center">
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      </main>
    )
  }

  if (!dataset) return null

  const bgClass = focusMode ? 'bg-gray-200' : 'bg-gray-950'

  // Fetch timestamp bar — shown in builder mode above the report
  const FetchBar = () => (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 border-b border-gray-800 text-xs shrink-0">
      {loading ? (
        <><Loader2 className="h-3 w-3 animate-spin text-blue-400" /><span className="text-gray-500">Fetching from TM1…</span></>
      ) : fetchedAt ? (
        <>
          <span className="text-gray-600">TM1 data fetched:</span>
          <span className="text-gray-300 font-medium tabular-nums">{fmt(fetchedAt)}</span>
          {isConfirmed
            ? <span className="text-emerald-500 ml-1">— confirmed ✓</span>
            : <span className="text-yellow-600 ml-1">— unconfirmed</span>
          }
        </>
      ) : null}
      <button
        onClick={handleRefresh}
        disabled={loading}
        title="Re-fetch data from TM1"
        className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded text-gray-500
                   hover:text-gray-200 hover:bg-gray-800 disabled:opacity-30 transition-colors"
      >
        <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        Refresh
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
                {dataset.axes[2] && (
                  <SelectorBar
                    dataset={dataset}
                    selectors={definition.selectors}
                    overrides={overrides}
                    onChange={setOverrides}
                  />
                )}
                <ReportRenderer definition={definition} dataset={dataset} />
              </div>
            </div>
          </div>
        ) : (
          // Builder mode — fills canvas panel width
          <div className="w-full p-8">
            <div className="bg-white rounded shadow-lg overflow-hidden w-full">
              {dataset.axes[2] && (
                <SelectorBar
                  dataset={dataset}
                  selectors={definition.selectors}
                  overrides={overrides}
                  onChange={setOverrides}
                />
              )}
              <ReportRenderer definition={definition} dataset={dataset} />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
