import { ReportDefinition, Row, DataColumn, CalcColumn, CFRule, isCalcColumn } from '../../types/report'
import { RawDataset } from '../../lib/api'

interface Props {
  definition: ReportDefinition
  dataset: RawDataset
  onNoteRefClick?: (ref: string) => void
}

export default function ReportRenderer({ definition, dataset, onNoteRefClick }: Props) {
  const { rows, columns, numberFormat } = definition

  const colTuples = dataset.axes[0]?.tuples ?? []
  const rowTuples = dataset.axes[1]?.tuples ?? []

  const rowIndexMap = new Map(rowTuples.map((t, i) => [t.members.join(' / '), i]))
  const colIndexMap = new Map(colTuples.map((t, i) => [t.members.join(' / '), i]))

  const getRawValue = (rowMember: string, colMember: string): number | null => {
    const ri = rowIndexMap.get(rowMember)
    const ci = colIndexMap.get(colMember)
    if (ri === undefined || ci === undefined) return null
    return dataset.cells[ri]?.[ci] ?? null
  }

  const getCalcValue = (rowMember: string, col: CalcColumn): number | null => {
    const a = getRawValue(rowMember, col.colA)
    const b = getRawValue(rowMember, col.colB)
    if (a === null || b === null) return null
    if (col.calcType === 'variance') return a - b
    if (col.calcType === 'pctVariance') return b !== 0 ? ((a - b) / Math.abs(b)) * 100 : null
    if (col.calcType === 'pctOfBase') return b !== 0 ? (a / b) * 100 : null
    return null
  }

  const isPct = (col: CalcColumn) => col.calcType === 'pctVariance' || col.calcType === 'pctOfBase'

  const formatValue = (raw: number | null, signFlip: boolean, pct = false): string => {
    if (raw === null) return '—'
    const val = signFlip ? raw * -1 : raw
    if (val === 0) return '—'

    if (pct) {
      const formatted = Math.abs(val).toFixed(1)
      return val < 0 ? `(${formatted}%)` : `${formatted}%`
    }

    const scale = numberFormat.scale === 'thousands' ? 1000
      : numberFormat.scale === 'millions' ? 1000000 : 1
    const scaled = val / scale
    const formatted = Math.abs(scaled).toLocaleString('en-US', {
      minimumFractionDigits: numberFormat.decimals,
      maximumFractionDigits: numberFormat.decimals,
    })
    if (val < 0 && numberFormat.negativeStyle === 'brackets') return `(${formatted})`
    if (val < 0) return `-${formatted}`
    return formatted
  }

  const matchesCFRule = (raw: number | null, rule: CFRule): boolean => {
    if (raw === null) return false
    const v = raw
    const { operator, valueA, valueB } = rule
    if (operator === '>')       return v > valueA
    if (operator === '>=')      return v >= valueA
    if (operator === '<')       return v < valueA
    if (operator === '<=')      return v <= valueA
    if (operator === '=')       return v === valueA
    if (operator === '!=')      return v !== valueA
    if (operator === 'between') return v >= valueA && v <= (valueB ?? valueA)
    return false
  }

  const getCFRule = (raw: number | null, row: Row, colId: string): CFRule | null => {
    for (const rule of definition.cfRules) {
      if (rule.scope === 'column' && rule.scopeTarget !== colId) continue
      if (rule.scope === 'row'    && rule.scopeTarget !== row.id) continue
      if (matchesCFRule(raw, rule)) return rule
    }
    return null
  }

  const isUnfavorable = (raw: number | null, col: DataColumn | CalcColumn): boolean => {
    if (raw === null) return false
    if (!isCalcColumn(col)) return raw < 0
    const favorable = col.favorable ?? 'positive'
    return favorable === 'positive' ? raw < 0 : raw > 0
  }

  // Visible columns — fall back to all TM1 columns if none configured
  const visibleCols: (DataColumn | CalcColumn)[] = columns.length > 0
    ? columns.filter((c) => c.show !== false)
    : colTuples.map((t) => ({
        id: t.members.join('/'),
        member: t.members.join(' / '),
        label: t.members.join(' / '),
        show: true,
        highlight: false,
        width: 'normal' as const,
      }))

  // Rows — fall back to all TM1 rows if none configured
  const renderRows: Row[] = rows.length > 0 ? rows : rowTuples.map((t) => ({
    id: t.members.join('/'),
    member: t.members.join(' / '),
    label: t.members.join(' / '),
    type: 'data' as const,
    bold: false,
    italic: false,
    underline: false,
    fontSize: 'md' as const,
    rowHeight: 'normal' as const,
    indent: 0 as const,
    signFlip: false,
    borderAbove: 'none' as const,
    borderBelow: 'none' as const,
  }))

  return (
    <div className="bg-white font-sans text-gray-900 shadow-lg rounded overflow-auto">
      {definition.title && (
        <div className="px-5 pt-4 pb-1">
          <h1 className="text-sm font-semibold text-gray-900">{definition.title}</h1>
          {definition.header.subtitle && (
            <p className="text-xs text-gray-400 mt-0.5">{definition.header.subtitle}</p>
          )}
        </div>
      )}

      {dataset.context && (
        <div className="px-5 pb-2">
          <p className="text-xs text-gray-400">{dataset.context}</p>
        </div>
      )}

      <table className="w-full border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          {/* Row label column — 30% of page width, min 140px */}
          <col style={{ width: '30%' }} />
          {visibleCols.map((col, i) => {
            const flex = col.width === 'narrow' ? 1 : col.width === 'wide' ? 2 : 1.5
            return <col key={i} style={{ width: `${flex * (70 / visibleCols.reduce((a, c) => a + (c.width === 'narrow' ? 1 : c.width === 'wide' ? 2 : 1.5), 0)) }%` }} />
          })}
        </colgroup>
        <thead>
          <tr className="border-b-2 border-gray-300">
            <th className="px-4 py-1 text-left text-xs font-semibold text-gray-500" />
            {visibleCols.map((col, i) => {
              const hBg = col.headerBackground
              const hColor = col.headerColor
              return (
                <th key={i}
                  className={`px-3 py-1 text-right text-[9px] font-semibold
                    ${!hBg && col.highlight ? 'bg-blue-50' : ''}
                    ${!hColor && col.highlight ? 'text-blue-700' : ''}
                    ${!hColor && !col.highlight ? (isCalcColumn(col) ? 'text-gray-400' : 'text-gray-600') : ''}
                    ${isCalcColumn(col) ? 'italic' : ''}`}
                  style={{
                    ...(hBg ? { backgroundColor: hBg } : {}),
                    ...(hColor ? { color: hColor } : {}),
                  }}>
                  {col.label}
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody>
          {renderRows.map((row) => {
            if (row.type === 'spacer') {
              return <tr key={row.id} className="h-3"><td colSpan={visibleCols.length + 1} /></tr>
            }
            if (row.type === 'header') {
              return (
                <tr key={row.id} className="bg-gray-50">
                  <td colSpan={visibleCols.length + 1}
                    className="py-0.5 text-[9px] font-semibold text-gray-500 uppercase tracking-wider"
                    style={{ paddingLeft: `${0.5 + row.indent * 0.5}rem` }}>
                    {row.label}
                    {row.noteRef && (
                      <sup className="ml-0.5 font-normal">
                        {onNoteRefClick
                          ? <button onClick={() => onNoteRefClick(row.noteRef!)}
                              className="text-blue-500 hover:text-blue-700 hover:underline">{row.noteRef}</button>
                          : <span className="text-blue-500">{row.noteRef}</span>
                        }
                      </sup>
                    )}
                  </td>
                </tr>
              )
            }

            const borderAbove = row.borderAbove === 'single' ? 'border-t border-gray-300'
              : row.borderAbove === 'double' ? 'border-t-2 border-gray-400' : ''
            const borderBelow = row.borderBelow === 'single' ? 'border-b border-gray-300'
              : row.borderBelow === 'double' ? 'border-b-2 border-gray-400' : ''
            const isTotal = row.type === 'total' || row.type === 'subtotal'

            const rowBg = row.rowBackground
              ?? (isTotal ? '#f9fafb' : undefined)

            const pyClass = row.rowHeight === 'compact' ? 'py-0'
              : row.rowHeight === 'tall' ? 'py-2' : 'py-0.5'

            const fontSizeClass = row.fontSize === 'sm' ? 'text-[7px]'
              : row.fontSize === 'lg' ? 'text-[10px]' : 'text-[8px]'

            return (
              <tr key={row.id}
                className={`${borderAbove} ${borderBelow}`}
                style={{ backgroundColor: rowBg }}>

                <td
                  className={`${pyClass} ${fontSizeClass} overflow-hidden
                    ${row.bold || isTotal ? 'font-semibold' : 'font-normal'}
                    ${row.italic ? 'italic' : ''}
                    ${row.underline ? 'underline' : ''}`}
                  style={{
                    paddingLeft: `${0.5 + (row.indent ?? 0) * 0.5}rem`,
                    paddingRight: '0.5rem',
                    color: row.labelColor ?? (row.rowBackground === '#1e293b' ? '#f1f5f9' : '#1f2937'),
                  }}>
                  <span className="block truncate">
                    {row.label}
                    {row.noteRef && (
                      <sup className="ml-0.5 font-normal">
                        {onNoteRefClick
                          ? <button onClick={() => onNoteRefClick(row.noteRef!)}
                              className="text-blue-500 hover:text-blue-700 hover:underline">{row.noteRef}</button>
                          : <span className="text-blue-500">{row.noteRef}</span>
                        }
                      </sup>
                    )}
                  </span>
                </td>

                {visibleCols.map((col, ci) => {
                  const raw = isCalcColumn(col)
                    ? getCalcValue(row.member, col)
                    : getRawValue(row.member, col.member)
                  const unfav = isUnfavorable(raw, col)
                  const pct = isCalcColumn(col) && isPct(col)
                  const cfRule = getCFRule(raw, row, col.id)

                  // Number colour priority: CF rule > row override > unfavorable red > dark-row auto > default
                  const darkRow = row.rowBackground === '#1e293b'
                  const numColor = cfRule?.color
                    ?? row.numberColor
                    ?? (unfav ? '#dc2626' : (darkRow ? '#f1f5f9' : '#111827'))

                  // Cell background priority: CF rule > row bg > column bg > highlight > none
                  const cellBg = cfRule?.background
                    ?? row.rowBackground
                    ?? col.columnBackground
                    ?? (col.highlight ? '#eff6ff' : undefined)

                  const cfBold   = cfRule?.bold   ?? false
                  const cfItalic = cfRule?.italic ?? false

                  return (
                    <td key={ci}
                      className={`px-3 ${pyClass} text-right ${fontSizeClass} tabular-nums
                        ${row.bold || isTotal || cfBold ? 'font-semibold' : ''}
                        ${cfItalic ? 'italic' : ''}`}
                      style={{
                        color: numColor,
                        ...(cellBg ? { backgroundColor: cellBg } : {}),
                      }}>
                      {formatValue(raw, isCalcColumn(col) ? false : row.signFlip, pct)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Footer */}
      {(definition.header.confidentiality || definition.header.footer) && (
        <div className="px-5 py-2 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-400">{definition.header.confidentiality}</span>
          <span className="text-xs text-gray-400">{definition.header.footer}</span>
        </div>
      )}

      <div className="h-4" />
    </div>
  )
}
