import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Save, Upload, Loader2, BarChart3, Trash2, RefreshCw } from 'lucide-react'
import { api, RawDataset } from '../../lib/api'
import { VisualDefinition, KPIConfig, ChartConfig, VisualType, ChartType } from '../../types/report'
import VisualRenderer from '../shared/VisualRenderer'

interface Props {
  visualId: string
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

function defaultDefinition(id: string): VisualDefinition {
  return {
    id,
    title: 'Untitled Visual',
    visualType: 'kpi',
    cube: '',
    view: '',
    selectors: [],
    numberFormat: { scale: 'thousands', decimals: 0, negativeStyle: 'brackets', thousandsSeparator: true },
  }
}

// ─── Source picker sub-panel ──────────────────────────────────────────────────

function SourcePanel({
  definition,
  onChange,
  dataset,
  loadingData,
  onRefreshData,
}: {
  definition: VisualDefinition
  onChange: (patch: Partial<VisualDefinition>) => void
  dataset: RawDataset | null
  loadingData: boolean
  onRefreshData: () => void
}) {
  const [cubes, setCubes] = useState<string[]>([])
  const [views, setViews] = useState<string[]>([])
  const [loadingCubes, setLoadingCubes] = useState(false)
  const [loadingViews, setLoadingViews] = useState(false)

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

  const rowMembers = dataset?.axes[1]?.tuples.map((t) => t.members.join(' / ')) ?? []
  const colMembers = dataset?.axes[0]?.tuples.map((t) => t.members.join(' / ')) ?? []
  const canRefresh = !!(definition.cube && definition.view)

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Cube {loadingCubes && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}</label>
        <select value={definition.cube} onChange={(e) => onChange({ cube: e.target.value, view: '' })}
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-blue-400">
          <option value="">Select cube…</option>
          {cubes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div>
        <label className="text-xs text-gray-400 mb-1 block">SYS View {loadingViews && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}</label>
        <select value={definition.view} onChange={(e) => onChange({ view: e.target.value })}
          disabled={!definition.cube}
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-blue-400 disabled:opacity-40">
          <option value="">Select view…</option>
          {views.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      <button
        onClick={onRefreshData}
        disabled={!canRefresh || loadingData}
        className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        {loadingData
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : <RefreshCw className="h-3 w-3" />
        }
        {loadingData ? 'Fetching data…' : dataset ? 'Refresh Data' : 'Load Data'}
      </button>

      {dataset && rowMembers.length > 0 && !loadingData && (
        <div className="text-xs text-gray-500">
          {rowMembers.length} rows · {colMembers.length} columns loaded
        </div>
      )}
    </div>
  )
}

// ─── KPI config panel ─────────────────────────────────────────────────────────

function KPIPanel({
  config,
  rowMembers,
  colMembers,
  onChange,
}: {
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
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-blue-400">
            <option value="">Select row…</option>
            {rowMembers.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Value column</label>
          <select value={config.valueColumn} onChange={(e) => onChange({ valueColumn: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-blue-400">
            <option value="">Select column…</option>
            {colMembers.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Comparison column</label>
          <select value={config.comparisonColumn ?? ''} onChange={(e) => onChange({ comparisonColumn: e.target.value || undefined })}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-blue-400">
            <option value="">None</option>
            {colMembers.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Comparison label</label>
          <input type="text" value={config.comparisonLabel ?? ''} onChange={(e) => onChange({ comparisonLabel: e.target.value || undefined })}
            placeholder="e.g. vs Budget"
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-400" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Unit</label>
          <input type="text" value={config.unit ?? ''} onChange={(e) => onChange({ unit: e.target.value || undefined })}
            placeholder="e.g. %"
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-400" />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Prefix</label>
          <input type="text" value={config.prefix ?? ''} onChange={(e) => onChange({ prefix: e.target.value || undefined })}
            placeholder="e.g. $"
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-400" />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Scale</label>
          <select value={config.scale ?? 'inherit'} onChange={(e) => onChange({ scale: e.target.value === 'inherit' ? undefined : e.target.value as 'units' | 'thousands' | 'millions' })}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-blue-400">
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

// ─── Chart config panel ───────────────────────────────────────────────────────

function ChartPanel({
  config,
  rowMembers,
  colMembers,
  onChange,
}: {
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

      {/* Display toggles */}
      <div className="flex gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={config.showLegend ?? true}
            onChange={(e) => onChange({ showLegend: e.target.checked })} className="accent-blue-500" />
          <span className="text-xs text-gray-400">Legend</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={config.showLabels ?? true}
            onChange={(e) => onChange({ showLabels: e.target.checked })} className="accent-blue-500" />
          <span className="text-xs text-gray-400">Labels</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={config.showGrid ?? true}
            onChange={(e) => onChange({ showGrid: e.target.checked })} className="accent-blue-500" />
          <span className="text-xs text-gray-400">Grid</span>
        </label>
      </div>

      {/* Font size controls */}
      <div className="space-y-1.5">
        {(config.showLegend ?? true) && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-16 shrink-0">Legend sz</span>
            <div className="flex gap-1">
              {([8, 10, 12] as const).map((sz) => (
                <button key={sz} onClick={() => onChange({ legendFontSize: sz })}
                  className={`px-2 py-0.5 text-xs rounded transition-colors
                    ${(config.legendFontSize ?? 10) === sz ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}>
                  {sz === 8 ? 'S' : sz === 10 ? 'M' : 'L'}
                </button>
              ))}
            </div>
          </div>
        )}
        {(config.showLabels ?? true) && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-16 shrink-0">Labels sz</span>
            <div className="flex gap-1">
              {([8, 10, 12] as const).map((sz) => (
                <button key={sz} onClick={() => onChange({ labelFontSize: sz })}
                  className={`px-2 py-0.5 text-xs rounded transition-colors
                    ${(config.labelFontSize ?? 10) === sz ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}>
                  {sz === 8 ? 'S' : sz === 10 ? 'M' : 'L'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main editor ──────────────────────────────────────────────────────────────

export default function VisualEditor({ visualId, onClose, onSaved, onDeleted }: Props) {
  const [definition, setDefinition] = useState<VisualDefinition>(defaultDefinition(visualId))
  const [dataset, setDataset] = useState<RawDataset | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [visualStatus, setVisualStatus] = useState<string>('draft')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    api.getVisual(visualId)
      .then((v) => {
        const def = v.definition as Partial<VisualDefinition>
        setDefinition({
          ...defaultDefinition(visualId),
          ...def,
          id: visualId,
          title: v.title,
          visualType: (v.visualType as VisualType) ?? 'kpi',
        })
        setVisualStatus(v.status)
      })
      .finally(() => setLoading(false))
  }, [visualId])

  const handleRefreshData = useCallback(async () => {
    if (!definition.cube || !definition.view) return
    setLoadingData(true)
    try {
      const now = new Date().toISOString()
      const ds = await api.getDataset(definition.cube, definition.view)
      setDataset(ds)
      // Always save draft with refresh timestamp; if published, mark yellow for re-review
      await api.saveVisualDraft(visualId, definition.title, definition.visualType, definition, now)
      if (visualStatus === 'published') {
        setVisualStatus('draft')
        showToast('Data refreshed — please review and re-publish')
      }
      onSaved()
    } catch {
      showToast('Failed to fetch data')
    } finally {
      setLoadingData(false)
    }
  }, [definition, visualId, visualStatus, onSaved])

  const patchDef = useCallback((patch: Partial<VisualDefinition>) => {
    setDefinition((prev) => ({ ...prev, ...patch }))
  }, [])

  const patchKPI = (patch: Partial<KPIConfig>) => {
    setDefinition((prev) => ({
      ...prev,
      kpiConfig: { ...defaultKPIConfig(), ...prev.kpiConfig, ...patch },
    }))
  }

  const patchChart = (patch: Partial<ChartConfig>) => {
    setDefinition((prev) => ({
      ...prev,
      chartConfig: { ...defaultChartConfig(), ...prev.chartConfig, ...patch },
    }))
  }

  const handleSaveDraft = async () => {
    setSaving(true)
    try {
      await api.saveVisualDraft(visualId, definition.title, definition.visualType, definition)
      showToast('Draft saved')
      onSaved()
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    setSaving(true)
    try {
      await api.publishVisual(visualId, definition.title, definition.visualType, definition)
      showToast('Published')
      onSaved()
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Publish failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this visual? This cannot be undone.')) return
    await api.deleteVisual(visualId)
    onDeleted()
  }

  const rowMembers = dataset?.axes[1]?.tuples.map((t) => t.members.join(' / ')) ?? []
  const colMembers = dataset?.axes[0]?.tuples.map((t) => t.members.join(' / ')) ?? []

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-black/60">
      <div className="flex flex-col h-full w-full bg-gray-900 overflow-hidden">

        {/* Top bar */}
        <header className="h-11 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-3 shrink-0">
          <button
            onClick={onClose}
            title="Back"
            className="p-2 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <BarChart3 className="h-4 w-4 text-blue-400 shrink-0" />
          <input
            type="text"
            value={definition.title}
            onChange={(e) => patchDef({ title: e.target.value })}
            className="bg-transparent text-sm font-medium text-gray-100 focus:outline-none flex-1 max-w-sm placeholder-gray-600"
            placeholder="Visual title…"
          />

          {/* Visual type toggle */}
          <div className="flex gap-1 bg-gray-800 rounded-md p-0.5">
            {(['kpi', 'chart'] as VisualType[]).map((t) => (
              <button key={t} onClick={() => patchDef({ visualType: t })}
                className={`px-3 py-1 text-xs rounded transition-colors capitalize
                  ${definition.visualType === t ? 'bg-blue-400 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                {t === 'kpi' ? 'KPI' : 'Chart'}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1">
            <button onClick={handleSaveDraft} disabled={saving}
              title="Save Draft"
              className="p-2 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-800
                         disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <Save className="h-4 w-4" />
            </button>

            <button onClick={handlePublish} disabled={saving}
              title="Publish"
              className="p-2 rounded text-blue-400 hover:text-blue-300 hover:bg-blue-900/50
                         disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <Upload className="h-4 w-4" />
            </button>

            <button onClick={handleDelete}
              title="Delete"
              className="p-2 rounded text-red-400 hover:text-red-300 hover:bg-red-900/50 transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>

          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">

          {/* Left panel — config */}
          <div className="w-80 shrink-0 bg-gray-900 border-r border-gray-800 overflow-y-auto p-4 space-y-5">

            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Data Source</p>
              <SourcePanel
                definition={definition}
                onChange={patchDef}
                dataset={dataset}
                loadingData={loadingData}
                onRefreshData={handleRefreshData}
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

          {/* Right — preview */}
          <div className="flex-1 overflow-auto bg-gray-950 flex items-center justify-center p-8">
            <div className="bg-white rounded-xl shadow-xl overflow-hidden"
              style={{ width: definition.visualType === 'kpi' ? 280 : 560, minHeight: 160 }}>
              <VisualRenderer definition={definition} dataset={dataset} />
            </div>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 text-gray-100
                          text-xs px-4 py-2 rounded-lg shadow-lg border border-gray-700 z-50">
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}

function defaultKPIConfig(): KPIConfig {
  return { valueRow: '', valueColumn: '', trendDirection: 'up-good' }
}

function defaultChartConfig(): ChartConfig {
  return { chartType: 'bar', selectedRows: [], selectedColumns: [], showLegend: true, showGrid: true }
}
