import { useEffect, useRef, useState } from 'react'
import { Loader2, BarChart3, FileUp, ChevronDown } from 'lucide-react'
import { api, RawDataset } from '../../lib/api'
import { VisualDefinition, KPIConfig, ChartConfig, VisualType, ChartType } from '../../types/report'
import { useVisualStore } from '../../store/useVisualStore'
import { parseCSVText, detectAndParse, buildRawDataset, buildPreview, CSVParseResult, PivotConfig } from '../../lib/csvParser'

interface Props {
  visualId: string | null
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
  const isCsv = definition.cube === '__csv__'
  const [sourceType, setSourceType] = useState<'tm1' | 'csv'>(isCsv ? 'csv' : 'tm1')
  const [cubes, setCubes] = useState<string[]>([])
  const [views, setViews] = useState<string[]>([])
  const [loadingCubes, setLoadingCubes] = useState(false)
  const [loadingViews, setLoadingViews] = useState(false)
  const [loadingData, setLoadingData] = useState(false)

  // CSV state
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null)
  const [csvFilename, setCsvFilename] = useState(isCsv ? definition.view : '')
  const [formatOverride, setFormatOverride] = useState<'auto' | 'pivoted' | 'flat'>('auto')
  const [pivot, setPivot] = useState<PivotConfig>({ rowField: '', colField: '', valueField: '', filters: [] })
  const fileRef = useRef<HTMLInputElement>(null)

  const effectiveFormat = parseResult
    ? (formatOverride !== 'auto' ? formatOverride : parseResult.format)
    : null

  // Auto-wire flat pivot defaults
  useEffect(() => {
    if (!parseResult || effectiveFormat !== 'flat') return
    const { textFields, numericFields } = parseResult
    setPivot(p => ({
      ...p,
      rowField: p.rowField || textFields[0] || '',
      colField: p.colField || textFields[1] || '',
      valueField: p.valueField || numericFields[0] || '',
    }))
  }, [parseResult, effectiveFormat])

  useEffect(() => {
    if (sourceType !== 'tm1') return
    setLoadingCubes(true)
    api.getCubes().then((d) => setCubes(d.cubes)).finally(() => setLoadingCubes(false))
  }, [sourceType])

  useEffect(() => {
    if (sourceType !== 'tm1' || !definition.cube || definition.cube === '__csv__') { setViews([]); return }
    setLoadingViews(true)
    api.getViews(definition.cube)
      .then((d) => setViews(d.views.filter((v) => v.startsWith('SYS'))))
      .finally(() => setLoadingViews(false))
  }, [definition.cube, sourceType])

  useEffect(() => {
    if (!definition.cube || !definition.view || definition.cube === '__csv__') return
    setLoadingData(true)
    api.getDataset(definition.cube, definition.view)
      .then((ds) => onDatasetLoad(ds))
      .catch(() => onDatasetLoad(null))
      .finally(() => setLoadingData(false))
  }, [definition.cube, definition.view])

  useEffect(() => {
    if (isCsv && definition.csvDataset && !dataset) onDatasetLoad(definition.csvDataset)
  }, [])

  const handleCSVFile = (file: File) => {
    setCsvFilename(file.name)
    setParseResult(null)
    setFormatOverride('auto')
    setPivot({ rowField: '', colField: '', valueField: '', filters: [] })
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const raw = parseCSVText(e.target?.result as string)
        setParseResult(detectAndParse(raw))
      } catch (err) {
        setCsvFilename('')
        alert(err instanceof Error ? err.message : 'Parse error')
      }
    }
    reader.readAsText(file)
  }

  const handleConfirm = () => {
    if (!parseResult) return
    const result = effectiveFormat !== parseResult.format
      ? { ...parseResult, format: effectiveFormat as 'pivoted' | 'flat' }
      : parseResult
    const ds = buildRawDataset(result, pivot, 'Rows', 'Columns', csvFilename)
    onDatasetLoad(ds)
    onChange({ cube: '__csv__', view: csvFilename, csvDataset: ds })
    setParseResult(null)
  }

  const canConfirm = parseResult && (
    effectiveFormat === 'pivoted' ||
    (pivot.rowField && pivot.colField && pivot.valueField && pivot.rowField !== pivot.colField)
  )

  const preview = parseResult ? (() => {
    try {
      const result = effectiveFormat !== parseResult.format
        ? { ...parseResult, format: effectiveFormat as 'pivoted' | 'flat' }
        : parseResult
      return buildPreview(result, pivot)
    } catch { return null }
  })() : null

  const availableFilterFields = effectiveFormat === 'flat' && parseResult
    ? parseResult.textFields.filter(f => f !== pivot.rowField && f !== pivot.colField)
    : []

  const rowMembers = dataset?.axes[1]?.tuples.map((t) => t.members.join(' / ')) ?? []
  const colMembers = dataset?.axes[0]?.tuples.map((t) => t.members.join(' / ')) ?? []

  return (
    <div className="space-y-3">
      {/* Source type toggle */}
      <div className="flex gap-1 bg-gray-800 rounded p-0.5">
        {(['tm1', 'csv'] as const).map((t) => (
          <button key={t} onClick={() => setSourceType(t)}
            className={`flex-1 py-1 text-xs rounded transition-colors
              ${sourceType === t ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
            {t === 'tm1' ? 'TM1 View' : 'CSV File'}
          </button>
        ))}
      </div>

      {sourceType === 'tm1' ? (
        <>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Cube {loadingCubes && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}</label>
            <select value={definition.cube === '__csv__' ? '' : definition.cube}
              onChange={(e) => onChange({ cube: e.target.value, view: '' })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-blue-500">
              <option value="">Select cube…</option>
              {cubes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">SYS View {loadingViews && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}</label>
            <select value={definition.view} onChange={(e) => onChange({ view: e.target.value })}
              disabled={!definition.cube || definition.cube === '__csv__'}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-blue-500 disabled:opacity-40">
              <option value="">Select view…</option>
              {views.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          {loadingData && <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 className="h-3 w-3 animate-spin" /> Fetching data…</div>}
        </>
      ) : (
        <div className="space-y-3">
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCSVFile(f); e.target.value = '' }} />

          {/* Loaded state */}
          {dataset && isCsv && !parseResult ? (
            <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-800 rounded text-xs">
              <FileUp className="h-3.5 w-3.5 text-green-400 shrink-0" />
              <span className="flex-1 truncate text-gray-300">{definition.view}</span>
              <button onClick={() => fileRef.current?.click()} className="text-blue-400 hover:text-blue-300 shrink-0">Replace</button>
            </div>
          ) : !parseResult ? (
            <button onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-gray-600 rounded text-xs text-gray-400 hover:text-gray-200 hover:border-gray-400 transition-colors">
              <FileUp className="h-3.5 w-3.5" /> Upload CSV
            </button>
          ) : null}

          {/* Format override */}
          {parseResult && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 shrink-0">Format:</span>
                <div className="flex rounded overflow-hidden border border-gray-700 text-xs flex-1">
                  {(['auto', 'pivoted', 'flat'] as const).map((f) => (
                    <button key={f} onClick={() => setFormatOverride(f)}
                      className={`flex-1 py-1 transition-colors ${formatOverride === f ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-500 hover:text-gray-300'}`}>
                      {f === 'auto' ? `Auto (${parseResult.format === 'pivoted' ? 'cross-tab' : 'tabular'})` : f === 'pivoted' ? 'Cross-tab' : 'Tabular'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pivot config for flat */}
              {effectiveFormat === 'flat' && parseResult.format === 'flat' && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">Fields: {parseResult.fields.join(', ')}</p>
                  {(['rowField', 'colField', 'valueField'] as const).map(key => {
                    const label = key === 'rowField' ? 'Row dim' : key === 'colField' ? 'Column dim' : 'Value'
                    const options = key === 'valueField' ? parseResult.numericFields : parseResult.textFields
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <label className="text-xs text-gray-500 w-20 shrink-0">{label}</label>
                        <select value={pivot[key]} onChange={(e) => setPivot(p => ({ ...p, [key]: e.target.value }))}
                          className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-blue-500">
                          <option value="">Select…</option>
                          {options.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                    )
                  })}

                  {/* Filters */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">Filters</span>
                      {availableFilterFields.length > 0 && (
                        <div className="relative group">
                          <button className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">+ Add <ChevronDown className="h-3 w-3" /></button>
                          <div className="absolute right-0 top-5 bg-gray-800 border border-gray-700 rounded shadow-lg z-10 hidden group-hover:block min-w-28">
                            {availableFilterFields.map(f => (
                              <button key={f} onClick={() => {
                                if (pivot.filters.find(pf => pf.field === f)) return
                                const firstVal = parseResult.uniqueValues[f]?.[0] ?? ''
                                setPivot(p => ({ ...p, filters: [...p.filters, { field: f, value: firstVal }] }))
                              }} className="block w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700">{f}</button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {pivot.filters.map(f => (
                      <div key={f.field} className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-400 w-20 shrink-0 truncate">{f.field}</span>
                        <select value={f.value}
                          onChange={(e) => setPivot(p => ({ ...p, filters: p.filters.map(pf => pf.field === f.field ? { ...pf, value: e.target.value } : pf) }))}
                          className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-blue-500">
                          {(parseResult.uniqueValues[f.field] ?? []).map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                        <button onClick={() => setPivot(p => ({ ...p, filters: p.filters.filter(pf => pf.field !== f.field) }))} className="text-gray-600 hover:text-red-400 text-xs">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview */}
              {preview && preview.rows.length > 0 && (
                <div className="overflow-x-auto rounded border border-gray-800">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-gray-800">
                      <th className="text-left px-2 py-1 text-gray-500 font-normal"></th>
                      {preview.colHeaders.slice(0, 5).map(h => <th key={h} className="text-right px-2 py-1 text-gray-400 font-medium">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {preview.rows.map(row => (
                        <tr key={row.label} className="border-t border-gray-800">
                          <td className="px-2 py-1 text-gray-300">{row.label}</td>
                          {row.values.slice(0, 5).map((v, i) => <td key={i} className="text-right px-2 py-1 text-gray-400">{v === null ? '' : v.toLocaleString()}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <button onClick={handleConfirm} disabled={!canConfirm}
                className="w-full py-1.5 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Load into Visual
              </button>
            </>
          )}
        </div>
      )}

      {dataset && rowMembers.length > 0 && !parseResult && (
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

export default function VisualPropertiesPanel({ visualId }: Props) {
  const { definition, dataset, setDefinition, patchDefinition, setDataset } = useVisualStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!visualId || visualId === 'new') { setLoading(false); return }
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

    </aside>
  )
}
