import type { RawDataset } from './api'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CSVFormat = 'pivoted' | 'flat'

export interface CSVParseResult {
  format: CSVFormat
  raw: string[][]
  // flat only
  fields: string[]
  numericFields: string[]
  textFields: string[]
  uniqueValues: Record<string, string[]>
}

export interface PivotConfig {
  rowField: string
  colField: string
  valueField: string
  filters: { field: string; value: string }[]
}

// ─── CSV text → 2D array ──────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current.trim())
  return cells
}

export function parseCSVText(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter(l => l.trim())
    .map(parseCSVLine)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normaliseNumeric(s: string): string {
  // Strip thousands separators, convert accounting brackets: (1225) → -1225
  const stripped = s.replace(/,/g, '').trim()
  if (/^\([\d.]+\)$/.test(stripped)) return '-' + stripped.slice(1, -1)
  return stripped
}

function isNumericCell(s: string): boolean {
  if (!s || s === '') return true  // blank = null value, acceptable
  return !isNaN(Number(normaliseNumeric(s)))
}

function toNumber(s: string): number | null {
  if (!s || s === '') return null
  const n = Number(normaliseNumeric(s))
  return isNaN(n) ? null : n
}

// ─── Auto-detect format ───────────────────────────────────────────────────────

export function detectAndParse(raw: string[][]): CSVParseResult {
  if (raw.length < 2) throw new Error('CSV must have at least 2 rows including a header row')

  // Normalise ragged rows — trim or pad each row to match the header column count
  const colCount = raw[0].length
  const normalised = [raw[0], ...raw.slice(1).map(row => {
    if (row.length === colCount) return row
    const trimmed = row.slice(0, colCount)
    while (trimmed.length < colCount) trimmed.push('')
    return trimmed
  })]

  // Pre-pivoted: every data cell (row 1+, col 1+) is numeric or blank
  const dataCells = normalised.slice(1).flatMap(row => row.slice(1))
  const isPivoted = dataCells.length > 0 && dataCells.every(isNumericCell)

  if (isPivoted) {
    return { format: 'pivoted', raw: normalised, fields: [], numericFields: [], textFields: [], uniqueValues: {} }
  }

  // Flat tabular format
  const fields = normalised[0]
  const dataRows = normalised.slice(1)

  const numericFields = fields.filter((_, i) => {
    const vals = dataRows.map(r => r[i] ?? '').filter(v => v !== '')
    return vals.length > 0 && vals.every(isNumericCell)
  })
  const textFields = fields.filter(f => !numericFields.includes(f))

  const uniqueValues: Record<string, string[]> = {}
  for (const field of textFields) {
    const idx = fields.indexOf(field)
    uniqueValues[field] = [...new Set(dataRows.map(r => r[idx] ?? '').filter(Boolean))]
  }

  return { format: 'flat', raw: normalised, fields, numericFields, textFields, uniqueValues }
}

// ─── Preview table (first 5 data rows after pivot) ───────────────────────────

export interface PreviewTable {
  colHeaders: string[]
  rows: { label: string; values: (number | null)[] }[]
}

export function buildPreview(result: CSVParseResult, pivot?: PivotConfig, rowDimName?: string, colDimName?: string, swapAxes?: boolean): PreviewTable {
  const ds = buildRawDataset(result, pivot, rowDimName, colDimName, 'preview', swapAxes)
  const colHeaders = ds.axes[0].tuples.map(t => t.members[0])
  const rowLabels = ds.axes[1].tuples.map(t => t.members[0])
  const rows = rowLabels.slice(0, 6).map((label, rowIdx) => ({
    label,
    values: ds.axes[0].tuples.map((_, colIdx) => ds.cells[rowIdx]?.[colIdx] ?? null),
  }))
  return { colHeaders, rows }
}

// ─── Build RawDataset ─────────────────────────────────────────────────────────

export function buildRawDataset(
  result: CSVParseResult,
  pivot: PivotConfig | undefined,
  rowDimName: string | undefined,
  colDimName: string | undefined,
  filename: string,
  swapAxes?: boolean,
): RawDataset {
  if (result.format === 'pivoted') {
    return buildFromPivoted(result.raw, rowDimName ?? 'Rows', colDimName ?? 'Columns', filename, swapAxes)
  }
  if (!pivot) throw new Error('Pivot config required for flat CSV')
  return buildFromFlat(result.raw, pivot, filename)
}

function buildFromPivoted(raw: string[][], rowDimName: string, colDimName: string, filename: string, swapAxes?: boolean): RawDataset {
  // CSV as-is: first row = col headers, first col = row labels
  const csvColMembers = raw[0].slice(1)
  const csvRowMembers = raw.slice(1).map(r => r[0])

  // cells[rowIdx][colIdx] — matches ReportRenderer's read convention
  const csvCells: (number | null)[][] = raw.slice(1).map(row =>
    csvColMembers.map((_, ci) => toNumber(row[ci + 1] ?? ''))
  )

  if (swapAxes) {
    // Transpose: treat CSV rows as report columns, CSV columns as report rows
    // axes[0] = report columns = csvRowMembers, axes[1] = report rows = csvColMembers
    // After transpose: cells[newRowIdx][newColIdx] = csvCells[newColIdx][newRowIdx]
    const cells: (number | null)[][] = csvColMembers.map((_, ci) =>
      csvRowMembers.map((_, ri) => csvCells[ri][ci])
    )
    return {
      status: 'ok', cube: '__csv__', view: filename, context: '',
      axes: [
        { hierarchies: [colDimName], tuples: csvRowMembers.map(m => ({ members: [m] })) },
        { hierarchies: [rowDimName], tuples: csvColMembers.map(m => ({ members: [m] })) },
        { hierarchies: [], tuples: [] },
      ],
      cells,
    }
  }

  return {
    status: 'ok', cube: '__csv__', view: filename, context: '',
    axes: [
      { hierarchies: [colDimName], tuples: csvColMembers.map(m => ({ members: [m] })) },
      { hierarchies: [rowDimName], tuples: csvRowMembers.map(m => ({ members: [m] })) },
      { hierarchies: [], tuples: [] },
    ],
    cells: csvCells,
  }
}

function buildFromFlat(raw: string[][], pivot: PivotConfig, filename: string): RawDataset {
  const fields = raw[0]
  let dataRows = raw.slice(1)

  const rowIdx = fields.indexOf(pivot.rowField)
  const colIdx = fields.indexOf(pivot.colField)
  const valIdx = fields.indexOf(pivot.valueField)

  // Apply filters
  for (const f of pivot.filters) {
    const fi = fields.indexOf(f.field)
    dataRows = dataRows.filter(r => r[fi] === f.value)
  }

  // Preserve order of first appearance
  const rowMembers = [...new Set(dataRows.map(r => r[rowIdx]).filter(Boolean))]
  const colMembers = [...new Set(dataRows.map(r => r[colIdx]).filter(Boolean))]

  // Value lookup: rowMember → colMember → value
  const lookup = new Map<string, Map<string, number | null>>()
  for (const row of dataRows) {
    const rm = row[rowIdx]
    const cm = row[colIdx]
    if (!rm || !cm) continue
    if (!lookup.has(rm)) lookup.set(rm, new Map())
    lookup.get(rm)!.set(cm, toNumber(row[valIdx] ?? ''))
  }

  // cells[rowIdx][colIdx] — matches ReportRenderer's read convention
  const cells: (number | null)[][] = rowMembers.map(rm =>
    colMembers.map(cm => lookup.get(rm)?.get(cm) ?? null)
  )

  // Context axis from filters (static selectors)
  const contextHierarchies = pivot.filters.map(f => f.field)
  const contextTuples = pivot.filters.length > 0
    ? [{ members: pivot.filters.map(f => f.value) }]
    : []

  return {
    status: 'ok',
    cube: '__csv__',
    view: filename,
    context: '',
    axes: [
      { hierarchies: [pivot.colField], tuples: colMembers.map(m => ({ members: [m] })) },
      { hierarchies: [pivot.rowField], tuples: rowMembers.map(m => ({ members: [m] })) },
      { hierarchies: contextHierarchies, tuples: contextTuples },
    ],
    cells,
  }
}
