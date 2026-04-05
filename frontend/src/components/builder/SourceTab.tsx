import { useState, useEffect } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { useReportStore } from '../../store/useReportStore'
import { api } from '../../lib/api'

export default function SourceTab() {
  const { definition, setTitle, setSource } = useReportStore()

  const [cubes, setCubes] = useState<string[]>([])
  const [views, setViews] = useState<string[]>([])
  const [loadingCubes, setLoadingCubes] = useState(false)
  const [loadingViews, setLoadingViews] = useState(false)
  const [error, setError] = useState('')

  // Load cubes on mount
  useEffect(() => {
    setLoadingCubes(true)
    setError('')
    api.getCubes()
      .then((d) => setCubes(d.cubes))
      .catch(() => setError('Could not connect to TM1'))
      .finally(() => setLoadingCubes(false))
  }, [])

  // Load views when cube changes
  useEffect(() => {
    if (!definition.cube) { setViews([]); return }
    setLoadingViews(true)
    api.getViews(definition.cube)
      .then((d) => setViews(d.views.filter((v) => v.startsWith('SYS'))))
      .catch(() => setError('Failed to load views'))
      .finally(() => setLoadingViews(false))
  }, [definition.cube])

  const handleCubeChange = (cube: string) => {
    setSource(cube, '')
  }

  const handleViewChange = (view: string) => {
    setSource(definition.cube, view)
  }

  return (
    <div className="space-y-5">
      {/* Report title */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Report Title</label>
        <input
          type="text"
          value={definition.title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Profit and Loss Statement"
          className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm
                     text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Cube */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">
          Cube
          {loadingCubes && <Loader2 className="inline h-3 w-3 ml-1 animate-spin" />}
        </label>
        <select
          value={definition.cube}
          onChange={(e) => handleCubeChange(e.target.value)}
          disabled={loadingCubes}
          className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm
                     text-gray-100 focus:outline-none focus:border-blue-500 disabled:opacity-50"
        >
          <option value="">Select cube…</option>
          {cubes.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* View */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">
          SYS View
          {loadingViews && <Loader2 className="inline h-3 w-3 ml-1 animate-spin" />}
        </label>
        <select
          value={definition.view}
          onChange={(e) => handleViewChange(e.target.value)}
          disabled={!definition.cube || loadingViews}
          className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm
                     text-gray-100 focus:outline-none focus:border-blue-500 disabled:opacity-50"
        >
          <option value="">Select SYS view…</option>
          {views.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        {definition.cube && !loadingViews && views.length === 0 && (
          <p className="text-xs text-yellow-600 mt-1">No SYS views found for this cube</p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950 rounded-md px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Source summary */}
      {definition.cube && definition.view && (
        <div className="bg-gray-800 rounded-md px-3 py-2 text-xs text-gray-400 space-y-1">
          <div><span className="text-gray-600">Cube</span> {definition.cube}</div>
          <div><span className="text-gray-600">View</span> {definition.view}</div>
        </div>
      )}
    </div>
  )
}
