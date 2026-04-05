import { useState, useEffect, useRef } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { useReportStore } from '../../store/useReportStore'
import { api } from '../../lib/api'
import ReportRenderer from '../shared/ReportRenderer'
import SelectorBar from '../shared/SelectorBar'

interface Props {
  focusMode?: boolean
}

export default function CanvasPanel({ focusMode = false }: Props) {
  const { definition, dataset, setDataset } = useReportStore()
  const { cube, view } = definition

  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scale, setScale] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)

  // Reset overrides when source changes
  useEffect(() => {
    setOverrides({})
  }, [cube, view])

  // Fetch dataset when source or overrides change
  useEffect(() => {
    if (!cube || !view) { setDataset(null); setError(''); return }
    setLoading(true)
    setError('')
    api.getDataset(cube, view, overrides)
      .then(setDataset)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [cube, view, overrides])

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
      const available = containerRef.current.clientWidth - 64  // 32px padding each side
      setScale(Math.max(available / pageWidth, 0.3))           // fill width, min 30%
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

  return (
    <main ref={containerRef} className={`flex-1 overflow-auto ${bgClass} transition-colors`}>
      {focusMode ? (
        // Focus mode — scale to fit, centred, light background
        <div className="flex justify-center py-8 px-8">
          <div
            style={{
              width: pageWidth,
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
              marginBottom: `${(scale - 1) * 100}%`,  // compensate for scale
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
        // Builder mode — centred page, full-width panel background
        <div className="w-full h-full flex justify-center p-8">
          <div className="bg-white rounded shadow-lg overflow-hidden self-start" style={{ width: pageWidth }}>
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
    </main>
  )
}
