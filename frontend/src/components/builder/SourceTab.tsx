import { useState, useEffect } from 'react'
import { Loader2, AlertCircle, Lock, Unlock } from 'lucide-react'
import { useReportStore } from '../../store/useReportStore'
import { api } from '../../lib/api'
import { Selector } from '../../types/report'

export default function SourceTab() {
  const { definition, setTitle, setSource, setSelectors, dataset } = useReportStore()

  const [cubes, setCubes] = useState<string[]>([])
  const [views, setViews] = useState<string[]>([])
  const [loadingCubes, setLoadingCubes] = useState(false)
  const [loadingViews, setLoadingViews] = useState(false)
  const [error, setError] = useState('')

  // Load cubes on mount
  useEffect(() => {
    setLoadingCubes(true)
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

  // Populate selectors from dataset axis 2 when dataset loads
  useEffect(() => {
    if (!dataset?.axes[2]) return
    const axis2 = dataset.axes[2]
    if (!axis2.tuples.length) return

    const defaults = axis2.tuples[0].members
    const existing = new Map(definition.selectors.map((s) => [s.dimension, s]))

    const selectors: Selector[] = axis2.hierarchies.map((dim, i) => {
      const prev = existing.get(dim)
      return {
        dimension: dim,
        label: prev?.label ?? dim,
        selected: prev?.selected ?? defaults[i],
        elements: [],
        locked: prev?.locked ?? true,  // default to locked
      }
    })
    setSelectors(selectors)
  }, [dataset])

  const handleCubeChange = (cube: string) => setSource(cube, '')
  const handleViewChange = (view: string) => setSource(definition.cube, view)

  const toggleLocked = (dimension: string) => {
    const sel = definition.selectors.find((s) => s.dimension === dimension)
    if (!sel) return
    setSelectors(definition.selectors.map((s) =>
      s.dimension === dimension ? { ...s, locked: !s.locked } : s
    ))
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
          {cubes.map((c) => <option key={c} value={c}>{c}</option>)}
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
          {views.map((v) => <option key={v} value={v}>{v}</option>)}
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

      {/* Selectors */}
      {definition.selectors.length > 0 && (
        <div>
          <div className="border-t border-gray-800 mb-4" />
          <p className="text-xs text-gray-400 mb-1">Context dimensions</p>
          <p className="text-xs text-gray-600 mb-3">
            Unlocked dims are user-selectable in the Viewer.
          </p>
          <div className="space-y-2">
            {definition.selectors.map((sel) => (
              <div key={sel.dimension} className="bg-gray-800 rounded-md p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-300 flex-1 truncate">{sel.dimension}</span>
                  <button
                    onClick={() => toggleLocked(sel.dimension)}
                    title={sel.locked ? 'Locked — click to allow viewer to change' : 'Unlocked — click to lock'}
                    className={`p-1 rounded transition-colors ${
                      sel.locked
                        ? 'text-gray-500 hover:text-yellow-400'
                        : 'text-blue-400 hover:text-blue-300'
                    }`}
                  >
                    {sel.locked
                      ? <Lock className="h-3.5 w-3.5" />
                      : <Unlock className="h-3.5 w-3.5" />
                    }
                  </button>
                </div>

                {/* Label override */}
                <input
                  type="text"
                  value={sel.label}
                  onChange={(e) => setSelectors(
                    definition.selectors.map((s) =>
                      s.dimension === sel.dimension ? { ...s, label: e.target.value } : s
                    )
                  )}
                  placeholder={sel.dimension}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs
                             text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />

                <div className="flex items-center gap-1.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    sel.locked ? 'bg-gray-700 text-gray-500' : 'bg-blue-900 text-blue-300'
                  }`}>
                    {sel.locked ? 'Locked' : 'Viewer can change'}
                  </span>
                  <span className="text-xs text-gray-600">default: {sel.selected}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
