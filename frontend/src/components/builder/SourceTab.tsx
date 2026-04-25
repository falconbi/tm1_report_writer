import { useState, useEffect, useRef } from 'react'
import { Loader2, AlertCircle, Lock, Unlock, Upload, RotateCcw, ChevronDown, RefreshCw } from 'lucide-react'
import { useReportStore } from '../../store/useReportStore'
import { api } from '../../lib/api'
import { Selector } from '../../types/report'
import {
  parseCSVText, detectAndParse, buildRawDataset, buildPreview,
  CSVParseResult, PivotConfig, PreviewTable,
} from '../../lib/csvParser'
import type { DataColumn, Row } from '../../types/report'

type SourceMode = 'tm1' | 'csv'

export default function SourceTab() {
  const { definition, setTitle, setSource, setSelectors, setDataset, setColumns, setRows, updateColumn, dataset } = useReportStore()

  // ── TM1 mode state ──────────────────────────────────────────────────────────
  const [tm1Enabled, setTm1Enabled] = useState<boolean | null>(null)
  const [cubes, setCubes] = useState<string[]>([])
  const [views, setViews] = useState<string[]>([])
  const [loadingCubes, setLoadingCubes] = useState(false)
  const [loadingViews, setLoadingViews] = useState(false)
  const [tm1Error, setTm1Error] = useState('')

  // ── Mode ─────────────────────────────────────────────────────────────────────
  const isCSVSource = definition.cube === '__csv__'
  const [sourceMode, setSourceMode] = useState<SourceMode>(isCSVSource ? 'csv' : 'tm1')

  // ── CSV state ────────────────────────────────────────────────────────────────
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null)
  const [formatOverride, setFormatOverride] = useState<'auto' | 'pivoted' | 'flat'>('auto')
  const [csvFilename, setCsvFilename] = useState(isCSVSource ? definition.view : '')
  const [rowDimName, setRowDimName] = useState('Rows')
  const [colDimName, setColDimName] = useState('Columns')
  const [swapAxes, setSwapAxes] = useState(false)
  const [pivot, setPivot] = useState<PivotConfig>({
    rowField: '', colField: '', valueField: '', filters: [],
  })
  const [preview, setPreview] = useState<PreviewTable | null>(null)
  const [csvLoaded, setCsvLoaded] = useState(isCSVSource)
  const [refreshError, setRefreshError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const refreshRef = useRef<HTMLInputElement>(null)

  // Effective format — override wins over auto-detection
  const effectiveFormat = parseResult
    ? (formatOverride !== 'auto' ? formatOverride : parseResult.format)
    : null

  // ── Reset CSV state when report changes ──────────────────────────────────────
  useEffect(() => {
    const isCSV = definition.cube === '__csv__'
    setSourceMode(isCSV ? 'csv' : (tm1Enabled === false ? 'csv' : 'tm1'))
    setCsvFilename(isCSV ? definition.view : '')
    setCsvLoaded(isCSV)
    setParseResult(null)
    setPreview(null)
    setSwapAxes(false)
    setFormatOverride('auto')
    setPivot({ rowField: '', colField: '', valueField: '', filters: [] })
  }, [definition.id])

  // ── On mount: check TM1 status ───────────────────────────────────────────────
  useEffect(() => {
    api.getTm1Status().then(({ enabled }) => {
      setTm1Enabled(enabled)
      if (!enabled && !isCSVSource) setSourceMode('csv')
    }).catch(() => setTm1Enabled(false))
  }, [])

  // ── Load cubes when in TM1 mode ──────────────────────────────────────────────
  useEffect(() => {
    if (sourceMode !== 'tm1') return
    setLoadingCubes(true)
    api.getCubes()
      .then(d => setCubes(d.cubes))
      .catch(() => setTm1Error('Could not connect to TM1'))
      .finally(() => setLoadingCubes(false))
  }, [sourceMode])

  // ── Load views when cube changes ─────────────────────────────────────────────
  useEffect(() => {
    if (!definition.cube || definition.cube === '__csv__') { setViews([]); return }
    setLoadingViews(true)
    api.getViews(definition.cube)
      .then(d => setViews(d.views.filter(v => v.startsWith('SYS'))))
      .catch(() => setTm1Error('Failed to load views'))
      .finally(() => setLoadingViews(false))
  }, [definition.cube])

  // ── Populate selectors from dataset axis 2 ───────────────────────────────────
  useEffect(() => {
    if (!dataset?.axes[2]) return
    const axis2 = dataset.axes[2]
    if (!axis2.tuples.length) return
    const defaults = axis2.tuples[0].members
    const existing = new Map((definition.selectors ?? []).map(s => [s.dimension, s]))
    const selectors: Selector[] = axis2.hierarchies.map((dim, i) => {
      const prev = existing.get(dim)
      return {
        dimension: dim,
        label: prev?.label ?? dim,
        selected: prev?.selected ?? defaults[i],
        elements: [],
        locked: prev?.locked ?? true,
        role: prev?.role ?? 'none',
        roleLabel: prev?.roleLabel,
      }
    })
    setSelectors(selectors)
  }, [dataset])

  // ── Rebuild preview whenever pivot config or format changes ──────────────────
  useEffect(() => {
    if (!parseResult) return
    try {
      const resultWithFormat = effectiveFormat && effectiveFormat !== parseResult.format
        ? { ...parseResult, format: effectiveFormat as 'pivoted' | 'flat' }
        : parseResult
      const p = buildPreview(resultWithFormat, pivot, rowDimName, colDimName, swapAxes)
      setPreview(p)
    } catch {
      setPreview(null)
    }
  }, [parseResult, effectiveFormat, pivot, rowDimName, colDimName])

  // ── Auto-wire first sensible pivot defaults for flat format ───────────────────
  useEffect(() => {
    if (!parseResult || effectiveFormat !== 'flat') return
    const { textFields, numericFields } = parseResult
    setPivot(prev => ({
      ...prev,
      rowField: prev.rowField || textFields[0] || '',
      colField: prev.colField || textFields[1] || '',
      valueField: prev.valueField || numericFields[0] || '',
    }))
  }, [parseResult])

  // ── TM1 handlers ─────────────────────────────────────────────────────────────
  const handleCubeChange = (cube: string) => setSource(cube, '')
  const handleViewChange = (view: string) => setSource(definition.cube, view)

  const toggleLocked = (dimension: string) => {
    setSelectors((definition.selectors ?? []).map(s =>
      s.dimension === dimension ? { ...s, locked: !s.locked } : s
    ))
  }

  // ── CSV handlers ──────────────────────────────────────────────────────────────
  const handleFile = (file: File) => {
    setCsvFilename(file.name)
    setCsvLoaded(false)
    setParseResult(null)
    setPreview(null)
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const raw = parseCSVText(text)
      const result = detectAndParse(raw)
      setParseResult(result)
      // Reset dim names on new file
      setRowDimName('Rows')
      setColDimName('Columns')
      setSwapAxes(false)
      setFormatOverride('auto')
      setPivot({ rowField: '', colField: '', valueField: '', filters: [] })
    }
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith('.csv')) handleFile(file)
  }

  const handleConfirmCSV = () => {
    if (!parseResult) return
    const resultWithFormat = effectiveFormat !== parseResult.format
      ? { ...parseResult, format: effectiveFormat as 'pivoted' | 'flat' }
      : parseResult
    const rawDataset = buildRawDataset(resultWithFormat, pivot, rowDimName, colDimName, csvFilename, swapAxes)
    setDataset(rawDataset)
    setSource('__csv__', csvFilename)  // clears columns/rows/selectors

    // Auto-populate columns from CSV headers
    const colMembers = rawDataset.axes[0].tuples.map(t => t.members[0])
    const autoColumns: DataColumn[] = colMembers.map(member => ({
      id: crypto.randomUUID(),
      member,
      label: member,
      show: true,
      highlight: false,
      width: 'normal',
    }))
    setColumns(autoColumns)

    // Auto-populate rows from CSV row members
    const rowMembers = rawDataset.axes[1].tuples.map(t => t.members[0])
    const autoRows: Row[] = rowMembers.map(member => ({
      id: crypto.randomUUID(),
      member,
      label: member,
      type: 'data',
      bold: false,
      italic: false,
      underline: false,
      fontSize: 'md',
      indent: 0,
      rowHeight: 'normal',
      borderAbove: 'none',
      borderBelow: 'none',
      signFlip: false,
    }))
    setRows(autoRows)

    // Selectors populated by the dataset useEffect
    setCsvLoaded(true)
    setParseResult(null)  // switch SourceTab to "loaded" state
  }

  // ── CSV refresh — same structure, new values ──────────────────────────────────
  const handleRefreshFile = (file: File) => {
    setRefreshError('')
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const text = e.target?.result as string
        const raw = parseCSVText(text)
        // Parse using the same format settings that were used originally
        const parsed = detectAndParse(raw)
        const resultWithFormat: CSVParseResult = { ...parsed, format: effectiveFormat as 'pivoted' | 'flat' || parsed.format }
        const newDataset = buildRawDataset(resultWithFormat, pivot, rowDimName, colDimName, file.name, swapAxes)

        // Validate structure — same number of columns and rows
        const existingCols = definition.columns.length
        const existingRows = definition.rows.length
        const newCols = newDataset.axes[0].tuples.length
        const newRows = newDataset.axes[1].tuples.length
        if (existingCols > 0 && newCols !== existingCols) {
          setRefreshError(`Column count mismatch: expected ${existingCols}, got ${newCols}`)
          return
        }
        if (existingRows > 0 && newRows !== existingRows) {
          setRefreshError(`Row count mismatch: expected ${existingRows}, got ${newRows}`)
          return
        }

        // Update dataset
        setDataset(newDataset)
        setCsvFilename(file.name)

        // Re-map column member names in case period labels changed (e.g. "2025 $M" → "2026 $M")
        const newColMembers = newDataset.axes[0].tuples.map(t => t.members[0])
        definition.columns.forEach((col, i) => {
          if ('member' in col && newColMembers[i] && col.member !== newColMembers[i]) {
            updateColumn(col.id, { member: newColMembers[i] } as Partial<typeof col>)
          }
        })
      } catch (err) {
        setRefreshError(err instanceof Error ? err.message : 'Failed to parse CSV')
      }
    }
    reader.readAsText(file)
  }

  const canConfirm = parseResult && (
    effectiveFormat === 'pivoted' ||
    (pivot.rowField && pivot.colField && pivot.valueField &&
      pivot.rowField !== pivot.colField)
  )

  // ── Filter helpers ────────────────────────────────────────────────────────────
  const availableFilterFields = effectiveFormat === 'flat' && parseResult?.format === 'flat'
    ? parseResult.textFields.filter(f => f !== pivot.rowField && f !== pivot.colField)
    : []

  const addFilter = (field: string) => {
    if (pivot.filters.find(f => f.field === field)) return
    const firstVal = parseResult?.uniqueValues[field]?.[0] ?? ''
    setPivot(p => ({ ...p, filters: [...p.filters, { field, value: firstVal }] }))
  }

  const removeFilter = (field: string) => {
    setPivot(p => ({ ...p, filters: p.filters.filter(f => f.field !== field) }))
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Report title */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Report Title</label>
        <input
          type="text"
          value={definition.title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Profit and Loss Statement"
          className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm
                     text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Source mode toggle — only shown when TM1 is available */}
      {tm1Enabled && (
        <div className="flex rounded-md overflow-hidden border border-gray-700 text-xs">
          <button
            onClick={() => { setSourceMode('tm1'); setCsvLoaded(false) }}
            className={`flex-1 py-1.5 transition-colors ${sourceMode === 'tm1' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}
          >
            TM1 Connection
          </button>
          <button
            onClick={() => setSourceMode('csv')}
            className={`flex-1 py-1.5 transition-colors ${sourceMode === 'csv' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}
          >
            CSV Upload
          </button>
        </div>
      )}

      {/* ── TM1 mode ── */}
      {sourceMode === 'tm1' && (
        <>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Cube
              {loadingCubes && <Loader2 className="inline h-3 w-3 ml-1 animate-spin" />}
            </label>
            <select
              value={definition.cube === '__csv__' ? '' : definition.cube}
              onChange={e => handleCubeChange(e.target.value)}
              disabled={loadingCubes}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm
                         text-gray-100 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            >
              <option value="">Select cube…</option>
              {cubes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              SYS View
              {loadingViews && <Loader2 className="inline h-3 w-3 ml-1 animate-spin" />}
            </label>
            <select
              value={definition.cube === '__csv__' ? '' : definition.view}
              onChange={e => handleViewChange(e.target.value)}
              disabled={!definition.cube || definition.cube === '__csv__' || loadingViews}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm
                         text-gray-100 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            >
              <option value="">Select SYS view…</option>
              {views.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            {definition.cube && definition.cube !== '__csv__' && !loadingViews && views.length === 0 && (
              <p className="text-xs text-yellow-600 mt-1">No SYS views found for this cube</p>
            )}
          </div>

          {tm1Error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950 rounded-md px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {tm1Error}
            </div>
          )}
        </>
      )}

      {/* ── CSV mode ── */}
      {sourceMode === 'csv' && (
        <div className="space-y-4">

          {/* File drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-700 rounded-lg p-5 text-center cursor-pointer
                       hover:border-blue-600 hover:bg-gray-800/50 transition-colors"
          >
            <Upload className="h-5 w-5 mx-auto mb-2 text-gray-500" />
            {csvFilename && !parseResult ? (
              <p className="text-xs text-gray-400">{csvFilename}</p>
            ) : csvFilename ? (
              <p className="text-xs text-blue-400">{csvFilename}</p>
            ) : (
              <p className="text-xs text-gray-500">Drop a CSV file here or click to browse</p>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </div>

          {/* Already loaded summary */}
          {csvLoaded && !parseResult && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between bg-green-950/40 border border-green-800/40 rounded-md px-3 py-2">
                <span className="text-xs text-green-400 truncate mr-2">CSV loaded: {csvFilename}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => refreshRef.current?.click()}
                    title="Refresh data — upload new CSV with same structure"
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Refresh
                  </button>
                  <button
                    onClick={() => fileRef.current?.click()}
                    title="Replace — upload new CSV and reconfigure"
                    className="text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {refreshError && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {refreshError}
                </p>
              )}
              <input
                ref={refreshRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleRefreshFile(f); e.target.value = '' }}
              />
            </div>
          )}

          {/* ── Format detection + override ── */}
          {parseResult && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 shrink-0">Format:</span>
              <div className="flex rounded overflow-hidden border border-gray-700 text-xs flex-1">
                <button
                  onClick={() => setFormatOverride('auto')}
                  className={`flex-1 py-1 transition-colors ${formatOverride === 'auto' ? 'bg-gray-700 text-gray-200' : 'bg-gray-800 text-gray-500 hover:text-gray-300'}`}
                >
                  Auto ({parseResult.format === 'pivoted' ? 'cross-tab' : 'tabular'})
                </button>
                <button
                  onClick={() => setFormatOverride('pivoted')}
                  className={`flex-1 py-1 transition-colors ${formatOverride === 'pivoted' ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-500 hover:text-gray-300'}`}
                >
                  Cross-tab
                </button>
                <button
                  onClick={() => setFormatOverride('flat')}
                  className={`flex-1 py-1 transition-colors ${formatOverride === 'flat' ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-500 hover:text-gray-300'}`}
                >
                  Tabular
                </button>
              </div>
            </div>
          )}

          {/* ── Pivoted format: just name the dimensions ── */}
          {effectiveFormat === 'pivoted' && parseResult && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Cross-tab format —{' '}
                <span className="text-gray-500">
                  {parseResult.raw[0].length - 1} columns × {parseResult.raw.length - 1} rows
                </span>
              </p>

              {/* Swap axes */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={swapAxes}
                  onChange={e => setSwapAxes(e.target.checked)}
                  className="rounded"
                />
                <span className="text-xs text-gray-400">
                  Swap rows and columns
                  <span className="text-gray-600 ml-1">(use if periods are rows in your CSV)</span>
                </span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Row dimension name</label>
                  <input
                    value={rowDimName}
                    onChange={e => setRowDimName(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs
                               text-gray-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Column dimension name</label>
                  <input
                    value={colDimName}
                    onChange={e => setColDimName(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs
                               text-gray-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Flat format: pivot builder ── */}
          {effectiveFormat === 'flat' && parseResult?.format === 'flat' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Tabular format —{' '}
                <span className="text-gray-500">{parseResult.fields.join(', ')}</span>
              </p>

              {/* Row / Column / Value */}
              <div className="space-y-2">
                {(['rowField', 'colField', 'valueField'] as const).map(key => {
                  const label = key === 'rowField' ? 'Row dimension' : key === 'colField' ? 'Column dimension' : 'Value field'
                  const options = key === 'valueField' ? parseResult.numericFields : parseResult.textFields
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 w-32 shrink-0">{label}</label>
                      <select
                        value={pivot[key]}
                        onChange={e => setPivot(p => ({ ...p, [key]: e.target.value }))}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs
                                   text-gray-100 focus:outline-none focus:border-blue-500"
                      >
                        <option value="">Select…</option>
                        {options.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>

              {/* Filters */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-500">Filters (slice by)</span>
                  {availableFilterFields.length > 0 && (
                    <div className="relative group">
                      <button className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                        + Add <ChevronDown className="h-3 w-3" />
                      </button>
                      <div className="absolute right-0 top-5 bg-gray-800 border border-gray-700 rounded shadow-lg z-10
                                      hidden group-hover:block min-w-28">
                        {availableFilterFields.map(f => (
                          <button
                            key={f}
                            onClick={() => addFilter(f)}
                            disabled={!!pivot.filters.find(pf => pf.field === f)}
                            className="block w-full text-left px-3 py-1.5 text-xs text-gray-300
                                       hover:bg-gray-700 disabled:opacity-40"
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {pivot.filters.map(f => (
                  <div key={f.field} className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs text-gray-400 w-24 shrink-0 truncate">{f.field}</span>
                    <select
                      value={f.value}
                      onChange={e => setPivot(p => ({
                        ...p,
                        filters: p.filters.map(pf => pf.field === f.field ? { ...pf, value: e.target.value } : pf)
                      }))}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs
                                 text-gray-100 focus:outline-none focus:border-blue-500"
                    >
                      {(parseResult.uniqueValues[f.field] ?? []).map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeFilter(f.field)}
                      className="text-gray-600 hover:text-red-400 text-xs"
                    >✕</button>
                  </div>
                ))}
                {pivot.filters.length === 0 && (
                  <p className="text-xs text-gray-700">No filters — all rows included</p>
                )}
              </div>
            </div>
          )}

          {/* Preview table */}
          {preview && preview.rows.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Preview</p>
              <div className="overflow-x-auto rounded border border-gray-800">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-800">
                      <th className="text-left px-2 py-1 text-gray-500 font-normal"></th>
                      {preview.colHeaders.slice(0, 6).map(h => (
                        <th key={h} className="text-right px-2 py-1 text-gray-400 font-medium">{h}</th>
                      ))}
                      {preview.colHeaders.length > 6 && (
                        <th className="text-right px-2 py-1 text-gray-600">…</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map(row => (
                      <tr key={row.label} className="border-t border-gray-800">
                        <td className="px-2 py-1 text-gray-300">{row.label}</td>
                        {row.values.slice(0, 6).map((v, i) => (
                          <td key={i} className="text-right px-2 py-1 text-gray-400">
                            {v === null ? '' : v.toLocaleString()}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Confirm button */}
          {parseResult && (
            <button
              onClick={handleConfirmCSV}
              disabled={!canConfirm}
              className="w-full py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-500
                         text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Load into Report
            </button>
          )}
        </div>
      )}

      {/* ── Selectors (both modes) ── */}
      {(definition.selectors?.length ?? 0) > 0 && (
        <div>
          <div className="border-t border-gray-800 mb-4" />
          <p className="text-xs text-gray-400 mb-1">Context dimensions</p>
          <p className="text-xs text-gray-600 mb-3">
            {isCSVSource
              ? 'Static filters from CSV — fixed in viewer.'
              : 'Unlocked dims are user-selectable in the Viewer.'}
          </p>
          <div className="space-y-2">
            {definition.selectors.map(sel => (
              <div key={sel.dimension} className="bg-gray-800 rounded-md p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-300 flex-1 truncate">{sel.dimension}</span>
                  {!isCSVSource && (
                    <button
                      onClick={() => toggleLocked(sel.dimension)}
                      title={sel.locked ? 'Locked — click to allow viewer to change' : 'Unlocked — click to lock'}
                      className={`p-1 rounded transition-colors ${
                        sel.locked ? 'text-gray-500 hover:text-yellow-400' : 'text-blue-400 hover:text-blue-300'
                      }`}
                    >
                      {sel.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  value={sel.label}
                  onChange={e => setSelectors(
                    (definition.selectors ?? []).map(s =>
                      s.dimension === sel.dimension ? { ...s, label: e.target.value } : s
                    )
                  )}
                  placeholder={sel.dimension}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs
                             text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />

                <div className="flex items-center gap-1.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    isCSVSource ? 'bg-gray-700 text-gray-500' :
                    sel.locked ? 'bg-gray-700 text-gray-500' : 'bg-blue-900 text-blue-300'
                  }`}>
                    {isCSVSource ? 'Fixed (CSV)' : sel.locked ? 'Locked' : 'Viewer can change'}
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
