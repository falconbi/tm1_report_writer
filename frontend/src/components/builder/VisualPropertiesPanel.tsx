import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, BarChart3, AlertCircle } from 'lucide-react'
import { api, RawDataset } from '../../lib/api'
import { VisualDefinition, KPIConfig, ChartConfig, VisualType, ChartType } from '../../types/report'
import { useVisualStore } from '../../store/useVisualStore'

interface Props {
  visualId: string | null
  isConfirmed: boolean
  onConfirmedChange: (v: boolean) => void
}

function defaultKPIConfig(): KPIConfig {
  return { valueRow: '', valueColumn: '', trendDirection: 'up-good' }
}

function defaultChartConfig(): ChartConfig {
  return { chartType: 'bar', selectedRows: [], selectedColumns: [], showLegend: true, showGrid: true }
}

function SourcePanel({ definition, onChange, dataset, onDatasetLoad }: {
  definition: VisualDefinition
  onChange: (patch: Partial<VisualDefinition>) => void
  dataset: RawDataset | null
  onDatasetLoad: (ds: RawDataset | null) => void
}) {
  const [cubes, setCubes] = useState<string[]>([])
  const [views, setViews] = useState<string[]>([])
  const [loadingCubes, setLoadingCubes] = useState(false)
  const [loadingViews, setLoadingViews] = useState(false)
  const [loadingData, setLoadingData] = useState(false)

  useEffect(() => {
    setLoadingCubes(true)
    api.getCubes().then((d) => setCubes(d.cubes)).finally(() => setLoadingCubes(false))
  }, [])

  useEffect(() => {
    if (!definition.cube) { setViews([]); return }
    setLoadingViews(true)
    api.getViews(definition.cube)
      .then((d) => setViews(d.views.filter((v) => v.startsWith('SYS'))))
      .finally(() => setLoadingViews(false))
  }, [definition.cube])

  useEffect(() => {
    if (!definition.cube || !definition.view) { onDatasetLoad(null); return }
    setLoadingData(true)
    api.getDataset(definition.cube, definition.view)
      .then((ds) => onDatasetLoad(ds))
      .catch(() => onDatasetLoad(null))
      .finally(() => setLoadingData(false))
  }, [definition.cube, definition.view])

  const rowMembers = dataset?.axes[1]?.tuples.map((t) => t.members.join(' / ')) ?? []
  const colMembers = dataset?.axes[0]?.tuples.map((t) => t.members.join(' / ')) ?? []

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Cube {loadingCubes && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}</label>
        <select value={definition.cube} onChange={(e) => onChange({ cube: e.target.value, view: '' })}
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-blue-500">
          <option value="">Select cube…</option>
          {cubes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div>
        <label className="text-xs text-gray-400 mb-1 block">SYS View {loadingViews && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}</label>
        <select value={definition.view} onChange={(e) => onChange({ view: e.target.value })}
          disabled={!definition.cube}
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-blue-500 disabled:opacity-40">
          <option value="">Select view…</option>
          {views.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      {loadingData && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Loader2 className="h-3 w-3 animate-spin" /> Fetching data…
        </div>
      )}

      {dataset && rowMembers.length > 0 && (
        <div className="text-xs text-gray-500">
          {rowMembers.length} rows · {colMembers.length} columns loaded
        </div>
      )}
    </div>
  )
}

function KPIPanel({ config, rowMembers, colMembers, onChange }: {
  config: KPIConfig
  rowMembers: string[]
  colMembers: string[]
  onChange: (patch: Partial<KPIConfig>) => void
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Value row</label>
          <select value={config.valueRow} onChange={(e) => onChange({ valueRow: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-blue-500">
            <option value="">Select row…</option>
            {rowMembers.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Value column</label>
          <select value={config.valueColumn} onChange={(e) => onChange({ valueColumn: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-blue-500">
            <option value="">Select column…</option>
            {colMembers.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Comparison column</label>
          <select value={config.comparisonColumn ?? ''} onChange={(e) => onChange({ comparisonColumn: e.target.value || undefined })}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-blue-500">
            <option value="">None</option>
            {colMembers.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Comparison label</label>
          <input type="text" value={config.comparisonLabel ?? ''} onChange={(e) => onChange({ comparisonLabel: e.target.value || undefined })}
            placeholder="e.g. vs Budget"
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Unit</label>
          <input type="text" value={config.unit ?? ''} onChange={(e) => onChange({ unit: e.target.value || undefined })}
            placeholder="e.g. %"
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Prefix</label>
          <input type="text" value={config.prefix ?? ''} onChange={(e) => onChange({ prefix: e.target.value || undefined })}
            placeholder="e.g. $"
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Scale</label>
          <select value={config.scale ?? 'inherit'} onChange={(e) => onChange({ scale: e.target.value === 'inherit' ? undefined : e.target.value as 'units' | 'thousands' | 'millions' })}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-blue-500">
            <option value="inherit">Inherit</option>
            <option value="units">Units</option>
            <option value="thousands">Thousands</option>
            <option value="millions">Millions</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-400 mb-1 block">Trend direction (good = …)</label>
        <div className="flex gap-2">
          {(['up-good', 'down-good'] as const).map((d) => (
            <button key={d} onClick={() => onChange({ trendDirection: d })}
              className={`flex-1 py-1.5 text-xs rounded transition-colors capitalize
                ${(config.trendDirection ?? 'up-good') === d ? 'bg-blue-400 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}>
              {d === 'up-good' ? '↑ Up is good' : '↓ Down is good'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ChartPanel({ config, rowMembers, colMembers, onChange }: {
  config: ChartConfig
  rowMembers: string[]
  colMembers: string[]
  onChange: (patch: Partial<ChartConfig>) => void
}) {
  const toggleItem = (list: string[], item: string): string[] =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item]

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Chart type</label>
        <div className="flex gap-1">
          {(['bar', 'line', 'pie'] as ChartType[]).map((t) => (
            <button key={t} onClick={() => onChange({ chartType: t })}
              className={`flex-1 py-1.5 text-xs rounded capitalize transition-colors
                ${config.chartType === t ? 'bg-blue-400 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-400 mb-1 block">Rows (X axis / slices)</label>
        <div className="space-y-0.5 max-h-36 overflow-y-auto">
          {rowMembers.map((r) => (
            <label key={r} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-700 cursor-pointer">
              <input type="checkbox" checked={config.selectedRows.includes(r)}
                onChange={() => onChange({ selectedRows: toggleItem(config.selectedRows, r) })}
                className="accent-blue-500" />
              <span className="text-xs text-gray-300 truncate">{r}</span>
            </label>
          ))}
        </div>
      </div>

      {config.chartType !== 'pie' && (
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Columns (series)</label>
          <div className="space-y-0.5 max-h-28 overflow-y-auto">
            {colMembers.map((c) => (
              <label key={c} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-700 cursor-pointer">
                <input type="checkbox" checked={config.selectedColumns.includes(c)}
                  onChange={() => onChange({ selectedColumns: toggleItem(config.selectedColumns, c) })}
                  className="accent-blue-500" />
                <span className="text-xs text-gray-300 truncate">{c}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={config.showLegend ?? true}
            onChange={(e) => onChange({ showLegend: e.target.checked })} className="accent-blue-500" />
          <span className="text-xs text-gray-400">Legend</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={config.showGrid ?? true}
            onChange={(e) => onChange({ showGrid: e.target.checked })} className="accent-blue-500" />
          <span className="text-xs text-gray-400">Grid</span>
        </label>
      </div>
    </div>
  )
}

export default function VisualPropertiesPanel({ visualId, isConfirmed, onConfirmedChange }: Props) {
  const { definition, dataset, setDefinition, patchDefinition, setDataset } = useVisualStore()
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    if (!visualId) { setLoading(false); return }
    setLoading(true)
    api.getVisual(visualId)
      .then((v) => {
        const def = v.definition as Partial<VisualDefinition>
        setDefinition({
          id: visualId,
          title: v.title,
          visualType: (v.visualType as VisualType) ?? 'kpi',
          cube: '',
          view: '',
          selectors: [],
          numberFormat: { scale: 'thousands', decimals: 0, negativeStyle: 'brackets', thousandsSeparator: true },
          ...def,
        })
        onConfirmedChange(v.isConfirmed)
      })
      .finally(() => setLoading(false))
  }, [visualId])

  const rowMembers = dataset?.axes[1]?.tuples.map((t) => t.members.join(' / ')) ?? []
  const colMembers = dataset?.axes[0]?.tuples.map((t) => t.members.join(' / ')) ?? []

  const patchKPI = (patch: Partial<KPIConfig>) => {
    patchDefinition({ kpiConfig: { ...defaultKPIConfig(), ...definition.kpiConfig, ...patch } })
  }

  const patchChart = (patch: Partial<ChartConfig>) => {
    patchDefinition({ chartConfig: { ...defaultChartConfig(), ...definition.chartConfig, ...patch } })
  }

  const handleConfirm = async () => {
    if (!visualId) return
    try {
      await api.confirmVisual(visualId)
      onConfirmedChange(true)
      setShowConfirmDialog(false)
      showToast('Visual confirmed')
    } catch {
      showToast('Confirm failed')
    }
  }

  if (loading) {
    return (
      <aside className="w-80 shrink-0 bg-gray-900 border-l border-gray-800 flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-gray-500 animate-spin" />
      </aside>
    )
  }

  if (!visualId) {
    return (
      <aside className="w-80 shrink-0 bg-gray-900 border-l border-gray-800 flex items-center justify-center">
        <p className="text-xs text-gray-600">Select a visual from the list</p>
      </aside>
    )
  }

  return (
    <aside className="w-80 shrink-0 bg-gray-900 border-l border-gray-800 overflow-y-auto">
      {/* Visual header — title + type toggle */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="h-4 w-4 text-blue-400 shrink-0" />
          <input
            type="text"
            value={definition.title}
            onChange={(e) => patchDefinition({ title: e.target.value })}
            className="flex-1 bg-transparent text-sm font-medium text-gray-100 focus:outline-none placeholder-gray-600 min-w-0"
            placeholder="Visual title…"
          />
          {isConfirmed ? (
            <span title="Confirmed">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            </span>
          ) : (
            <button
              onClick={() => setShowConfirmDialog(true)}
              title="Confirm"
              className="p-1 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors shrink-0">
              <CheckCircle2 className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-1 bg-gray-800 rounded-md p-0.5">
          {(['kpi', 'chart'] as const).map((t) => (
              <button key={t} onClick={() => patchDefinition({ visualType: t })}
              className={`flex-1 px-3 py-1 text-xs rounded transition-colors capitalize
                ${definition.visualType === t ? 'bg-blue-400 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              {t === 'kpi' ? 'KPI' : 'Chart'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-5">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Data Source</p>
          <SourcePanel
            definition={definition}
            onChange={(p) => patchDefinition(p)}
            dataset={dataset}
            onDatasetLoad={setDataset}
          />
        </div>

        <div className="border-t border-gray-800" />

        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            {definition.visualType === 'kpi' ? 'KPI Config' : 'Chart Config'}
          </p>
          {definition.visualType === 'kpi' ? (
            <KPIPanel
              config={{ ...defaultKPIConfig(), ...definition.kpiConfig }}
              rowMembers={rowMembers}
              colMembers={colMembers}
              onChange={patchKPI}
            />
          ) : (
            <ChartPanel
              config={{ ...defaultChartConfig(), ...definition.chartConfig }}
              rowMembers={rowMembers}
              colMembers={colMembers}
              onChange={patchChart}
            />
          )}
        </div>
      </div>

      {showConfirmDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60"
          onClick={() => setShowConfirmDialog(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[400px] p-6"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-100">Confirm visual</p>
                <p className="text-xs text-gray-400 mt-1">
                  I confirm this visual is accurate and ready for inclusion in a published pack.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors">
                Cancel
              </button>
              <button onClick={handleConfirm}
                className="px-4 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 text-gray-100
                        text-xs px-4 py-2 rounded-lg shadow-lg border border-gray-700 z-50">
          {toast}
        </div>
      )}
    </aside>
  )
}
