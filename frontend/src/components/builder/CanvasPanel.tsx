import { useState, useEffect } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { useReportStore } from '../../store/useReportStore'
import { api } from '../../lib/api'
import ReportRenderer from '../shared/ReportRenderer'
import SelectorBar from '../shared/SelectorBar'

export default function CanvasPanel() {
  const { definition, dataset, setDataset } = useReportStore()
  const { cube, view } = definition

  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  return (
    <main className="flex-1 overflow-auto bg-gray-950">
      <div className="max-w-5xl mx-auto p-8">
        <div className="bg-white rounded shadow-lg overflow-hidden">
          {/* Selectors sit inside the report card, above the content */}
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
    </main>
  )
}
