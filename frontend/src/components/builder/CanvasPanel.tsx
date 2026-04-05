import { useState, useEffect } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { useReportStore } from '../../store/useReportStore'
import { api, RawDataset } from '../../lib/api'

export default function CanvasPanel() {
  const { definition } = useReportStore()
  const { cube, view } = definition

  const [dataset, setDataset] = useState<RawDataset | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!cube || !view) { setDataset(null); setError(''); return }

    setLoading(true)
    setError('')
    setDataset(null)

    api.getDataset(cube, view)
      .then(setDataset)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [cube, view])

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

  const colTuples = dataset.axes[0]?.tuples ?? []
  const rowTuples = dataset.axes[1]?.tuples ?? []
  const colHeaders = colTuples.map((t) => t.members.join(' / '))
  const rowHeaders = rowTuples.map((t) => t.members.join(' / '))

  return (
    <main className="flex-1 overflow-auto bg-gray-950 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Context bar */}
        {dataset.context && (
          <p className="text-xs text-gray-500 mb-4">{dataset.context}</p>
        )}

        {/* Raw data table */}
        <div className="bg-white rounded shadow-lg overflow-auto">
          <table className="text-sm w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-gray-500 font-medium text-xs border-r border-gray-200 whitespace-nowrap">
                  {dataset.axes[1]?.hierarchies.join(' / ') || 'Row'}
                </th>
                {colHeaders.map((h, i) => (
                  <th key={i} className="px-4 py-3 text-right text-gray-700 font-medium text-xs whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowHeaders.map((row, ri) => (
                <tr key={ri} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-700 font-medium text-xs border-r border-gray-200 whitespace-nowrap">
                    {row}
                  </td>
                  {(dataset.cells[ri] ?? []).map((val, ci) => (
                    <td key={ci} className="px-4 py-2.5 text-right text-gray-900 text-xs tabular-nums">
                      {val === null ? '—' : val.toLocaleString()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-600 mt-3">
          {rowHeaders.length} rows · {colHeaders.length} columns · raw TM1 data
        </p>
      </div>
    </main>
  )
}
