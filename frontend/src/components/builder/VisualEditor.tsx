import { useState, useEffect, useCallback } from 'react'
import { X, Save, Upload, Loader2, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react'
import { api, RawDataset } from '../../lib/api'
import { VisualDefinition, KPIConfig, ChartConfig, VisualType, ChartType } from '../../types/report'
import VisualRenderer from '../shared/VisualRenderer'

interface Props {
  visualId: string
  initialIsConfirmed: boolean
  initialConfirmedAt?: string
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
  onDatasetLoad,
}: {
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
                ${(config.trendDirection ?? 'up-good') === d ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}>
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
                ${config.chartType === t ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}>
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

// ─── Main editor ──────────────────────────────────────────────────────────────

export default function VisualEditor({ visualId, initialIsConfirmed, initialConfirmedAt, onClose, onSaved, onDeleted }: Props) {
  const [definition, setDefinition] = useState<VisualDefinition>(defaultDefinition(visualId))
  const [dataset, setDataset] = useState<RawDataset | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isConfirmed, setIsConfirmed] = useState(initialIsConfirmed)
  const [confirmedAt, setConfirmedAt] = useState(initialConfirmedAt)
  const [toast, setToast] = useState('')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

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
        setIsConfirmed(v.isConfirmed)
      })
      .finally(() => setLoading(false))
  }, [visualId])

  const patchDef = useCallback((patch: Partial<VisualDefinition>) => {
    setDefinition((prev) => ({ ...prev, ...patch }))
    setIsConfirmed(false)
  }, [])

  const patchKPI = (patch: Partial<KPIConfig>) => {
    setDefinition((prev) => ({
      ...prev,
      kpiConfig: { ...defaultKPIConfig(), ...prev.kpiConfig, ...patch },
    }))
    setIsConfirmed(false)
  }

  const patchChart = (patch: Partial<ChartConfig>) => {
    setDefinition((prev) => ({
      ...prev,
      chartConfig: { ...defaultChartConfig(), ...prev.chartConfig, ...patch },
    }))
    setIsConfirmed(false)
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

  const handleConfirm = async () => {
    try {
      const res = await api.confirmVisual(visualId)
      setIsConfirmed(true)
      setConfirmedAt(res.confirmedAt)
      setShowConfirmDialog(false)
      showToast('Visual confirmed')
      onSaved()
    } catch {
      showToast('Confirm failed')
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
        <header className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-3 shrink-0">
          <TrendingUp className="h-4 w-4 text-blue-400 shrink-0" />
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
                  ${definition.visualType === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                {t === 'kpi' ? 'KPI' : 'Chart'}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {isConfirmed ? (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Confirmed {confirmedAt ? new Date(confirmedAt).toLocaleDateString() : ''}
              </span>
            ) : (
              <button onClick={() => setShowConfirmDialog(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                           bg-emerald-700 hover:bg-emerald-600 text-white transition-colors">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Confirm
              </button>
            )}
            <button onClick={handleSaveDraft} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                         bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-40 transition-colors">
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button onClick={handlePublish} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                         bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition-colors">
              <Upload className="h-3.5 w-3.5" />
              Publish
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-200 transition-colors">
              <X className="h-4 w-4" />
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

            <div className="border-t border-gray-800 pt-3">
              <button onClick={handleDelete}
                className="w-full text-xs text-red-500 hover:text-red-400 hover:bg-gray-800 py-1.5 rounded transition-colors">
                Delete Visual
              </button>
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

        {/* Confirm dialog */}
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
